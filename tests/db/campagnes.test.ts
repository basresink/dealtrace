// P16 op databaseniveau: maken (overslaan met reden, varianten en vvVersies bewaard), activeren
// (kanaaldekking, capaciteit met bevestiging van de salesmanager, startdatum), taken gespreid over de
// koude belblokken, kolomwissel via rondAf (gat 38), een campagnetaak afronden schuift het item door,
// de afsluiter, de achterstand voor SR11 en RLS. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { nlMoment, plusDagen } from '../../shared/datum'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const c = await import('../../server/utils/campagnes')
const { rondAf } = await import('../../server/utils/taken')

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
const eva = { id: 'u-07', rol: 'accountmanager', naam: 'Testgebruiker Eva Ervaren' }
const joost = { id: 'u-04', rol: 'salesmanager', naam: 'Testgebruiker Joost' }
const vandaag = nlMoment(new Date()).datum
/** Twintig prospects zonder ritme of campagne, voor de test van Eva en met een (fictief) nummer. */
const vrij = async (tx: any, n = 20) => {
  const ids = (await rijen(tx, sql`select a.id from accounts a where a.account_kind = 'prospect' and a.nb_status <> 'nee' and not coalesce((a.data->'reis'->'ritme'->>'actief')::boolean, false)
    and a.data->>'partnerId' is null and not exists (select 1 from campagne_items ci where ci.account_id = a.id) order by a.name limit ${n}`)).map((r) => r.id as string)
  await tx.execute(sql`update accounts set owner_id = 'u-07', data = data || '{"telefoon": "+31850009999"}'::jsonb where id = any(string_to_array(${ids.join(',')}, ','))`)
  return ids
}
const maakKoud = async (tx: any, ids: string[], extra: object = {}) => c.maak(tx, ORG, eva, { bron: { soort: 'vrij', accountIds: ids }, soort: 'koude-belcampagne', brancheId: 'br-01', winpuntId: 'wp-01', varianten: [{ naam: 'A' }, { naam: 'B' }], ...extra })

describe('maken', () => {
  it('een account in een ritme of in een andere campagne kan niet mee: 400 met lijst', async () => {
    await inOrg(ORG, async (tx) => {
      const [ritme] = (await rijen(tx, sql`select id from accounts where (data->'reis'->'ritme'->>'actief')::boolean limit 1`)).map((r) => r.id)
      const [inCp] = (await rijen(tx, sql`select account_id from campagne_items where campagne_id = 'cp-01' and kolom = 'gespot' limit 1`)).map((r) => r.account_id)
      const fout = await maakKoud(tx, [ritme, inCp], { accountIds: [ritme, inCp] }).catch((e: any) => e)
      expect(fout.statusCode).toBe(400)
      expect(fout.data.overgeslagen.map((o: any) => o.reden).sort()).toEqual(['zit al in een campagne', 'zit al in een ritme'])
    })
  })
  it('concept met items; varianten en vvVersies blijven bewaard (gat 13)', async () => {
    await inOrg(ORG, async (tx) => {
      const ids = await vrij(tx)
      const r = await maakKoud(tx, ids)
      expect(r.accounts).toBe(ids.length)
      const cp = await rij(tx, sql`select status, started_at, data from campagnes where id = ${r.id}`)
      expect(cp.status).toBe('concept')
      expect(cp.started_at).toBeNull()
      expect(cp.data.varianten).toHaveLength(2)
      expect(Object.keys(cp.data.vvVersies).length).toBeGreaterThan(0)
      expect((await rij(tx, sql`select count(*)::int as n from campagne_items where campagne_id = ${r.id} and kolom = 'gespot'`)).n).toBe(ids.length)
    })
  })
  it('voorbereid: br-03 geeft de gele dekkingsmelding en het advies eerst referenties', async () => {
    await inOrg(ORG, async (tx) => {
      const ids = (await rijen(tx, sql`select id from accounts where vv_branche_id = 'br-03'`)).map((r) => r.id)
      const v = await c.voorbereid(tx, { id: 'u-05', rol: 'accountmanager' }, { bron: { soort: 'vrij', accountIds: ids }, soort: 'bezoektour', brancheId: 'br-03' })
      expect(v.brancheMelding).toMatch(/nog geen eigen verhaal en belofte/)
      expect(v.brancheAdvies).toBe('Eerst referenties en verhaal, dan volume.')
    })
  })
})

describe('activeren', () => {
  it('kanaaldekking onder 80 procent: 400 met de aantallen', async () => {
    await inOrg(ORG, async (tx) => {
      const ids = await vrij(tx)
      const r = await maakKoud(tx, ids)
      const weg = ids.slice(0, 6)
      await tx.execute(sql`update contacts set data = data - 'telefoon' - 'mobiel' where account_id = any(string_to_array(${weg.join(',')}, ','))`)
      await tx.execute(sql`update accounts set data = data - 'telefoon' where id = any(string_to_array(${weg.join(',')}, ','))`)
      const fout = await c.activeerCampagne(tx, ORG, eva, r.id).catch((e: any) => e)
      expect(fout.statusCode).toBe(400)
      expect(fout.message).toMatch(/van de \d+ accounts hebben een telefoonnummer/)
    })
  })
  it('boven capaciteit: 403 capaciteit; met bevestiging een taak voor de salesmanager; de salesmanager activeert', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update users set data = data || '{"belblokken": {"blokken": []}}'::jsonb where id = 'u-07'`)
      const r = await maakKoud(tx, await vrij(tx))
      const fout = await c.activeerCampagne(tx, ORG, eva, r.id).catch((e: any) => e)
      expect(fout.statusCode).toBe(403)
      expect(fout.data.reden).toBe('capaciteit')
      const w = await c.activeerCampagne(tx, ORG, eva, r.id, { bevestigd: true })
      expect(w.status).toBe('wacht')
      const t = await rij(tx, sql`select owner_id, title from tasks where campaign_id = ${r.id} and title like 'Bevestig campagne%'`)
      expect(t.owner_id).toBe('u-04')
      const a = await c.activeerCampagne(tx, ORG, joost, r.id)
      expect(a.status).toBe('actief')
      const cp = await rij(tx, sql`select status, to_char(started_at, 'YYYY-MM-DD') as start from campagnes where id = ${r.id}`)
      expect(cp).toEqual({ status: 'actief', start: vandaag })
    })
  })
  it('activeren zet de startdatum en spreidt de taken over de koude belblokken, met titel en campaign_id', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await maakKoud(tx, await vrij(tx), { naam: 'Testronde' })
      const a = await c.activeerCampagne(tx, ORG, eva, r.id)
      expect(a.taken).toBe(20)
      expect(a.tekst).toMatch(/gespreid over je koude belblokken/)
      const taken = await rijen(tx, sql`select title, action_type, to_char(due_date at time zone 'Europe/Amsterdam', 'YYYY-MM-DD') as dag, data from tasks where campaign_id = ${r.id}`)
      expect(taken).toHaveLength(20)
      expect(taken.every((t) => / \(Testronde\)$/.test(t.title) && t.title.startsWith('Bel ') && t.action_type === 'bellen' && t.dag >= vandaag && t.data.campagneId === r.id)).toBe(true)
      // Nog een keer: geen dubbele taken voor items met een open taak.
      expect((await c.maakTaken(tx, ORG, r.id, null)).aantal).toBe(0)
    })
  })
})

describe('bord en taak lopen nooit uiteen (gat 38)', () => {
  it('kolomwissel naar Afgewezen zonder uitkomst: 400; met uitkomst wordt de taak afgerond via rondAf', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await maakKoud(tx, await vrij(tx))
      await c.activeerCampagne(tx, ORG, eva, r.id)
      const [acc] = (await rijen(tx, sql`select account_id from campagne_items where campagne_id = ${r.id} limit 1`)).map((x) => x.account_id)
      expect((await c.kolomWissel(tx, ORG, 'u-07', r.id, acc, { kolom: 'afgewezen' }).catch((e: any) => e)).statusCode).toBe(400)
      await c.kolomWissel(tx, ORG, 'u-07', r.id, acc, { kolom: 'afgewezen', uitkomst: 'geen_interesse', reden: 'Geen budget', winpuntUitgevoerd: false })
      const t = await rij(tx, sql`select status, uitkomst from tasks where campaign_id = ${r.id} and account_id = ${acc}`)
      expect(t).toEqual({ status: 'klaar', uitkomst: 'geen_interesse' })
      const it = await rij(tx, sql`select kolom, winpunt_uitgevoerd from campagne_items where campagne_id = ${r.id} and account_id = ${acc}`)
      expect(it).toEqual({ kolom: 'afgewezen', winpunt_uitgevoerd: false })
      expect((await rij(tx, sql`select nb_status from accounts where id = ${acc}`)).nb_status).toBe('nee')
    })
  })
  it('een campagnetaak afronden met een uitkomst schuift het item door; afspraak haalt het einddoel', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await maakKoud(tx, await vrij(tx))
      await c.activeerCampagne(tx, ORG, eva, r.id)
      const [t1, t2] = await rijen(tx, sql`select id, account_id from tasks where campaign_id = ${r.id} order by account_id limit 2`)
      await rondAf(tx, t1.id, { uitkomst: 'geen_reactie' } as any, 'u-07')
      await rondAf(tx, t2.id, { uitkomst: 'afspraak' } as any, 'u-07')
      const i1 = await rij(tx, sql`select kolom, poging from campagne_items where campagne_id = ${r.id} and account_id = ${t1.account_id}`)
      const i2 = await rij(tx, sql`select kolom, einddoel_gehaald from campagne_items where campagne_id = ${r.id} and account_id = ${t2.account_id}`)
      expect(i1).toEqual({ kolom: 'benaderd', poging: 1 })
      expect(i2).toEqual({ kolom: 'afspraak', einddoel_gehaald: true })
    })
  })
})

describe('afsluiter, achterstand en RLS', () => {
  it('na de einddatum gaat een actieve campagne naar Afgerond met samenvatting', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update campagnes set started_at = ${plusDagen(vandaag, -30)}, ends_at = ${plusDagen(vandaag, -1)} where id = 'cp-01'`)
      expect(await c.sluitAf(tx)).toBeGreaterThanOrEqual(1)
      const cp = await rij(tx, sql`select status, data->'resultaat' as r from campagnes where id = 'cp-01'`)
      expect(cp.status).toBe('afgerond')
      expect(cp.r).toMatchObject({ accounts: 30, afsprakenGepland: 4 })
      expect(cp.r).not.toHaveProperty('pipeline')
    })
  })
  it('een campagne die 10 punten of meer achterloopt, geeft achterstand voor SR11 (cadans 2)', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update campagnes set started_at = ${plusDagen(vandaag, -18)}, ends_at = ${plusDagen(vandaag, 3)} where id = 'cp-01'`)
      const m = await c.achterstandPerAccount(tx)
      const [acc] = (await rijen(tx, sql`select account_id from campagne_items where campagne_id = 'cp-01' limit 1`)).map((x) => x.account_id)
      expect(m.get(acc)![0]!.achterstand).toBeGreaterThanOrEqual(10)
      const sr11 = await rij(tx, sql`select cadans_dagen, data->'gevolg'->>'taaksjabloon' as t from activity_rules where code = 'SR11'`)
      expect(sr11).toEqual({ cadans_dagen: 2, t: 'Campagne loopt achter' })
    })
  })
  it('RLS: een andere organisatie ziet de campagnes en items van Voltvast niet', async () => {
    await inOrg('org-tweede', async (tx) => {
      expect((await rij(tx, sql`select count(*)::int as n from campagnes`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from campagne_items`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from campagnesoorten`)).n).toBe(8)
    })
  })
})
