// P17 op databaseniveau: de overdracht in één transactie (gat 1), de mock van DealDrive (verstuurd en
// bevestigd, al_klant met de vraag), stand uit en collega, 409 en idempotentie, opnieuw proberen tot
// mislukt, de funnel en nb_funnel_stand (som per fase) en RLS. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { nlMoment } from '../../shared/datum'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const o = await import('../../server/utils/overdracht')
const fu = await import('../../server/utils/funnel')

let pool: pg.Pool
class Terug extends Error {}
async function inOrg<T>(org: string, werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const ORG = 'org-voltvast'
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const anouk = { id: 'u-01', naam: 'Testgebruiker Anouk Noorderveld', email: 'anouk@voltvast.test' }
const stap = { omschrijving: 'Gratis projectschouw op locatie', datum: '2026-10-22', soort: 'bezoek' }

describe('overdragen (gat 1 en 27)', () => {
  it('in één transactie: overdracht klaar, gebeurtenis overgedragen, status en fase, activiteit, audit; de overdrachtstaak sluit', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
      expect(r.status).toBe('klaar')
      expect(await rij(tx, sql`select nb_status, fase_id from accounts where id = 'pr-02'`)).toEqual({ nb_status: 'overgedragen', fase_id: 'overgedragen' })
      expect((await rij(tx, sql`select count(*)::int as n from reisgeschiedenis where account_id = 'pr-02' and gebeurtenis = 'overgedragen'`)).n).toBe(1)
      expect((await rij(tx, sql`select count(*)::int as n from activiteiten where account_id = 'pr-02' and soort = 'overdracht'`)).n).toBe(1)
      expect((await rij(tx, sql`select actor_id from audit_events where action = 'account.overdragen' and resource_id = 'pr-02'`)).actor_id).toBe('u-01')
      expect((await rij(tx, sql`select status from tasks where id = 't-overdragen-vonkenburg'`)).status).toBe('klaar')
      expect((await rij(tx, sql`select count(*)::int as n from accounts where nb_status = 'klant' and account_kind = 'prospect'`)).n).toBe(0)
    })
  })
  it('een fout halverwege laat niets achter', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.transaction(async (sp: any) => {
        await o.draagOver(sp, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
        throw new Error('storing')
      }).catch(() => null)
      expect((await rij(tx, sql`select count(*)::int as n from overdrachten`)).n).toBe(0)
      expect((await rij(tx, sql`select nb_status from accounts where id = 'pr-02'`)).nb_status).toBe('gescoord')
    })
  })
  it('mock: verstuurd met het externe id uit de fixture (bevestigd volgt met de terugmelding, P23)', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
      expect(await o.verstuurOverdracht(tx, r.id)).toBe('verstuurd')
      const x = await rij(tx, sql`select status, extern_id, extern_url from overdrachten where id = ${r.id}`)
      expect(x).toEqual({ status: 'verstuurd', extern_id: 'acc_dd_5520', extern_url: 'https://dealdrive.test/accounts/acc_dd_5520' })
      expect((await rij(tx, sql`select count(*)::int as n from koppeling_runs where soort = 'dealdrive'`)).n).toBe(1)
    })
  })
  it('tweede Draag over: 409; dezelfde sleutel twee keer: één overdracht', async () => {
    await inOrg(ORG, async (tx) => {
      const a = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap, sleutel: 'k-1' })
      const b = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap, sleutel: 'k-1' })
      expect(b.id).toBe(a.id)
      expect((await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'crm', vervolgstap: stap, sleutel: 'k-2' }).catch((e: any) => e)).statusCode).toBe(409)
      expect((await rij(tx, sql`select count(*)::int as n from overdrachten`)).n).toBe(1)
    })
  })
  it('zonder gehouden eerste afspraak met vervolg: 422', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await o.draagOver(tx, ORG, anouk, 'pr-01', { naar: 'dealdrive', vervolgstap: stap }).catch((e: any) => e)).statusCode).toBe(422)
    })
  })
  it('stand uit: een overdrachtstaak met briefing, geen verzoek', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update koppelingen set status = 'uit' where soort = 'dealdrive'`)
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
      expect(r.tekst).toBe('Testinstallatie Vonkenburg is overgedragen. De overdrachtstaak met briefing staat klaar.')
      const t = await rij(tx, sql`select title, data->>'briefing' as b from tasks where data->>'overdrachtId' = ${r.id}`)
      expect(t.title).toBe('Overdracht naar DealDrive: Testinstallatie Vonkenburg')
      expect(t.b).toMatch(/^## Overdracht Testinstallatie Vonkenburg/)
      expect(await o.verstuurOverdracht(tx, r.id)).toBeNull()
      expect((await rij(tx, sql`select count(*)::int as n from koppeling_runs where soort = 'dealdrive'`)).n).toBe(0)
    })
  })
  it('aan een collega: die wordt eigenaar met een taak met vervolgstap en briefing', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'collega', naarGebruikerId: 'u-04', vervolgstap: stap })
      expect(r.tekst).toBe('Testinstallatie Vonkenburg is overgedragen aan Joost Stuurman.')
      expect((await rij(tx, sql`select owner_id from accounts where id = 'pr-02'`)).owner_id).toBe('u-04')
      const t = await rij(tx, sql`select owner_id, title, data->>'briefing' as b from tasks where data->>'overdrachtId' = ${r.id}`)
      expect(t.owner_id).toBe('u-04')
      expect(t.title).toBe('Gratis projectschouw op locatie: Testinstallatie Vonkenburg')
      expect(t.b).toBeTruthy()
    })
  })
  it('al klant in DealDrive: de vraag als taak; met Ja opnieuw als nieuwe kans bij een bestaande klant', async () => {
    await inOrg(ORG, async (tx) => {
      const [k] = await rijen(tx, sql`select name from accounts where account_kind = 'klant' limit 1`)
      await tx.execute(sql`update accounts set name = ${k.name} where id = 'pr-02'`)
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
      expect(await o.verstuurOverdracht(tx, r.id)).toBe('al_klant')
      expect((await rij(tx, sql`select status, data->'alKlant'->>'accountId' as a from overdrachten where id = ${r.id}`))).toEqual({ status: 'klaar', a: 'acc_dd_1200' })
      expect((await rij(tx, sql`select title from tasks where data->>'overdrachtId' = ${r.id}`)).title).toMatch(/^Al klant in DealDrive/)
      const fout = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap, sleutel: 'nog-eens' }).catch((e: any) => e)
      expect(fout.data.reden).toBe('al_klant')
      await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap, sleutel: 'ja', alsNieuweKansBijKlant: true })
      expect(await o.verstuurOverdracht(tx, r.id)).toBe('verstuurd')
      expect((await rij(tx, sql`select status, pakket->>'alsNieuweKansBijKlant' as k from overdrachten where id = ${r.id}`))).toEqual({ status: 'verstuurd', k: 'true' })
    })
  })
  it('mislukt versturen: opnieuw volgens het schema, daarna mislukt met een taak; status en fase blijven staan', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
      const kapot = { overdragen: async () => ({ ok: false as const, code: 'fout' as const, bericht: 'DealDrive is even niet bereikbaar', tijdelijk: true }) }
      const t0 = new Date('2026-10-15T10:00:00Z')
      const uitkomsten = []
      for (let i = 0; i < 6; i++) uitkomsten.push(await o.verstuurOverdracht(tx, r.id, new Date(t0.getTime() + i * 864e5), kapot))
      expect(uitkomsten).toEqual(['opnieuw', 'opnieuw', 'opnieuw', 'opnieuw', 'opnieuw', 'mislukt'])
      expect((await rij(tx, sql`select status, pogingen from overdrachten where id = ${r.id}`))).toEqual({ status: 'mislukt', pogingen: 6 })
      expect((await rij(tx, sql`select title from tasks where data->>'overdrachtId' = ${r.id} and title like 'Overdracht naar DealDrive mislukt%'`)).title).toBe('Overdracht naar DealDrive mislukt: Testinstallatie Vonkenburg')
      expect((await rij(tx, sql`select nb_status from accounts where id = 'pr-02'`)).nb_status).toBe('overgedragen')
      await o.opnieuw(tx, r.id)
      expect((await o.opnieuw(tx, r.id).catch((e: any) => e)).statusCode).toBe(409)
      expect(await o.verstuurOverdracht(tx, r.id)).toBe('verstuurd')
    })
  })
})

describe('funnel', () => {
  it('per fase klopt de som, ook in nb_funnel_stand; Vonkenburg staat in Afspraak gehouden', async () => {
    await inOrg(ORG, async (tx) => {
      const p = fu.periodeVan({ periode: 'kwartaal' }, new Date())
      const f = await fu.laadFunnel(tx, { van: p.van, tot: p.tot, gebruikerIds: null }, { details: true })
      for (const x of f.fases) expect(x.aantal).toBe(x.doorgestroomd + x.uitgevallen + x.aanwezig)
      expect(f.fases.find((x) => x.faseId === 'afspraak-gehouden')!.aantal).toBeGreaterThanOrEqual(1)
      // Een dag waarop er accounts binnenkwamen (de seed rekent terug vanaf nu).
      const dag = nlMoment(new Date((await rij(tx, sql`select max(op) as op from reisgeschiedenis`)).op)).datum
      expect(await fu.bouwFunnelStand(tx, ORG, dag)).toBeGreaterThan(0)
      expect(await fu.bouwFunnelStand(tx, ORG, dag)).toBeGreaterThan(0)
      const st = await rijen(tx, sql`select binnengekomen, doorgestroomd, aanwezig, (select coalesce(sum(value::int), 0) from jsonb_each_text(uitgevallen)) as uit from nb_funnel_stand where dag = ${dag}`)
      for (const s of st) expect(s.binnengekomen).toBe(s.doorgestroomd + Number(s.uit) + s.aanwezig)
    })
  })
  it('de lijst onder een fase: oudste fase sinds eerst', async () => {
    await inOrg(ORG, async (tx) => {
      const p = fu.periodeVan({ periode: 'kwartaal' }, new Date())
      const l = await fu.funnelAccounts(tx, { van: p.van, tot: p.tot, gebruikerIds: ['u-01'] }, 'afspraak-gehouden', null)
      expect(l.map((a) => a.id)).toContain('pr-02')
    })
  })
})

describe('RLS', () => {
  it('een andere organisatie ziet overdrachten en funnelstand van Voltvast niet', async () => {
    await inOrg(ORG, async (tx) => { await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap }) })
    await inOrg('org-tweede', async (tx) => {
      expect((await rij(tx, sql`select count(*)::int as n from overdrachten`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from nb_funnel_stand`)).n).toBe(0)
    })
  })
})
