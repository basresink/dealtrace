// P21 op databaseniveau: teamtabel tegen de lijsten, 403 buiten de eigen teams, gedeelde punten en
// privénotities, Verplaats met reden en audit, herberekening van nb_kpi_dag, de Coach en het
// verbetervoorstel, en RLS op de coachingtabellen.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const team = await import('../../server/utils/team')
const coaching = await import('../../server/utils/coaching')
const { coachVoorstel, maandVerbetervoorstel } = await import('../../server/utils/agents/coach')
const { leesAudit } = await import('../../server/utils/auditLijst')
const { AUDIT_PERIODEN } = await import('../../shared/audit')

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
const joost = { id: 'u-04', rol: 'salesmanager' }
const nu = new Date()
const maand = { van: new Date(nu.getTime() - 28 * 864e5).toISOString().slice(0, 10), tot: nu.toISOString().slice(0, 10) }

describe('Team', () => {
  it('elke cel heeft precies zoveel records als de lijst die hij opent', async () => {
    await inOrg(ORG, async (tx) => {
      const t = await team.teamOverzicht(tx, joost, 'team-binnendienst', maand, nu)
      const sanne = t.rijen.find((r: any) => r.id === 'u-03')!
      expect(sanne.kpi.pogingen).toBeGreaterThan(50)
      const r = await team.ruw(tx, ['u-03'], maand, nu)
      for (const [m, w] of [['pogingen', sanne.kpi.pogingen], ['gesprekken', sanne.kpi.gesprekken], ['beslisser', sanne.kpi.beslisser], ['afspraken', sanne.kpi.afspraken], ['achterstallig', sanne.achterstallig]] as const) {
        expect(team.celRecords(r, 'u-03', m)).toHaveLength(w)
      }
      expect(t.aandachtspunten.length).toBeLessThanOrEqual(5)
    })
  })
  it('een salesmanager van Team Noord krijgt 403 op Team Zuid; een beheerder niet', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into users (id, organisation_id, name, email, role, niveau, status, team_id, data) values ('u-sm2', ${ORG}, 'Testgebruiker Noor Noord', 'noor@voltvast.test', 'salesmanager', 'expert', 'actief', 'team-organisatie', '{}')`)
      await tx.execute(sql`update teams set manager_ids = array['u-sm2'] where id = 'team-noord'`)
      const noor = { id: 'u-sm2', rol: 'salesmanager' }
      await expect(team.teamOverzicht(tx, noor, 'team-zuid', maand, nu)).rejects.toMatchObject({ statusCode: 403 })
      await expect(team.vereisTeamlid(tx, noor, 'u-02')).rejects.toMatchObject({ statusCode: 403 })
      expect((await team.teamOverzicht(tx, noor, 'team-noord', maand, nu)).rijen.map((r: any) => r.id).sort()).toEqual(['u-01', 'u-05'])
      expect((await team.teamOverzicht(tx, { id: 'u-06', rol: 'beheerder' }, 'team-zuid', maand, nu)).team.id).toBe('team-zuid')
    })
  })
  it('Verplaats vraagt een reden en schrijft een auditregel per account', async () => {
    await inOrg(ORG, async (tx) => {
      const ids = (await rijen(tx, sql`select id from accounts where owner_id = 'u-01' and account_kind = 'prospect' order by id limit 3`)).map((r) => r.id)
      await expect(team.verplaatsAccounts(tx, ORG, joost, { accountIds: ids, naarGebruiker: 'u-05', reden: ' ' })).rejects.toMatchObject({ statusCode: 422 })
      expect(await team.verplaatsAccounts(tx, ORG, joost, { accountIds: ids, naarGebruiker: 'u-05', reden: 'Verlof' })).toEqual({ aantal: 3 })
      expect((await rij(tx, sql`select count(*)::int n from accounts where owner_id = 'u-05' and id = any(string_to_array(${ids.join(',')}, ','))`)).n).toBe(3)
      const a = await rijen(tx, sql`select metadata->>'reden' as reden from audit_events where action = 'account.eigenaar' and resource_id = any(string_to_array(${ids.join(',')}, ','))`)
      expect(a).toHaveLength(3)
      expect(a.every((x) => x.reden === 'Verlof')).toBe(true)
    })
  })
})

describe('Coaching', () => {
  it('Mijn resultaten toont alleen gedeelde punten en nooit een privénotitie; de manager ziet beide', async () => {
    await inOrg(ORG, async (tx) => {
      const m = await coaching.mijnResultaten(tx, { id: 'u-03' }, { vergelijken: true }, nu)
      expect(m.punten.map((p: any) => p.tekst)).toEqual(['Sluit elk gesprek af met een voorstel voor een afspraak.'])
      expect(m.afspraken.map((a: any) => a.soort)).toEqual(['afspraak'])
      expect(JSON.stringify(m)).not.toContain('twijfelt over de doelgroep')
      expect(JSON.stringify(m)).not.toMatch(/Anouk|Lieke|Eva/)
      const k = await coaching.coachingKaart(tx, joost, 'u-03', nu)
      expect(k.prive.map((p: any) => p.tekst)).toEqual(['Sanne twijfelt over de doelgroep; volgende keer naar vragen.'])
      expect(k.sessie!.punten).toHaveLength(2)
      expect(k.gesprekken.length).toBeLessThanOrEqual(3)
    })
  })
  it('zonder vergelijking geen trend en geen teamgemiddelde (Beginner)', async () => {
    await inOrg(ORG, async (tx) => {
      const m = await coaching.mijnResultaten(tx, { id: 'u-02' }, { vergelijken: false }, nu)
      expect(m.trend).toBeNull()
      expect(m.team).toBeNull()
    })
  })
  it('de Coach geeft hoogstens drie punten, elk met cijfers en een bestaand artikel', async () => {
    await inOrg(ORG, async (tx) => {
      const c = await coaching.cijfers(tx, { id: 'u-03', werkplek: 'binnendienst', team_id: 'team-binnendienst' }, nu)
      const p = await coachVoorstel(tx, ORG, { id: 'u-04', niveau: 'expert', data: {} }, { id: 'u-03', naam: 'Sanne' }, { cijfers: { ...c.kpi }, team: c.team ?? {}, verslagen: [] })
      expect(p.length).toBeGreaterThan(0)
      expect(p.length).toBeLessThanOrEqual(3)
      const slugs = (await rijen(tx, sql`select slug from help_artikelen`)).map((r) => r.slug)
      for (const x of p) { expect(slugs).toContain(x.artikelSleutel); expect(x.onderbouwing.cijfers.some((c: string) => /\d/.test(c))).toBe(true) }
    })
  })
  it('het verbetervoorstel: één per reisversie met minstens 20 accounts per maand', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await maandVerbetervoorstel(tx, ORG, nu)
      expect(r.gemaakt).toBeGreaterThan(0)
      const n = (await rij(tx, sql`select count(*)::int n from signals where type = 'verbetervoorstel' and owner_id = 'u-04'`)).n
      await maandVerbetervoorstel(tx, ORG, nu)
      expect((await rij(tx, sql`select count(*)::int n from signals where type = 'verbetervoorstel' and owner_id = 'u-04'`)).n).toBe(n)
    })
  })
})

describe('testronde 2, manager', () => {
  it('B3 en B7: open taken per persoon en één chip per fase in de werkverdeling', async () => {
    await inOrg(ORG, async (tx) => {
      const t = await team.teamOverzicht(tx, joost, 'team-binnendienst', maand, nu)
      const sanne = t.rijen.find((r: any) => r.id === 'u-03')!
      expect(sanne.openTaken).toBe((await rij(tx, sql`select count(*)::int n from tasks where owner_id = 'u-03' and status in ('open', 'bezig')`)).n)
      for (const p of t.werkverdeling) expect(new Set(p.fases.map((f: any) => f.fase)).size).toBe(p.fases.length)
    })
  })
  it('B4: een afspraak uit coaching wordt een taak voor de verkoper, met melding naar de taak en audit', async () => {
    await inOrg(ORG, async (tx) => {
      const [n] = await rijen(tx, sql`insert into coaching_notities (organisation_id, gebruiker_id, manager_id, soort, tekst, termijn, data) values (${ORG}, 'u-03', 'u-04', 'afspraak', 'Elke dag twee belblokken', '2026-10-23', '{}'::jsonb) returning id`)
      const taakId = await coaching.afspraakAlsTaak(tx, ORG, 'u-04', 'u-03', { id: n.id, tekst: 'Elke dag twee belblokken', termijn: '2026-10-23' }, nu)
      const t = await rij(tx, sql`select owner_id, status, title, due_date, data from tasks where id = ${taakId}`)
      expect(t).toMatchObject({ owner_id: 'u-03', status: 'open', title: 'Coachingafspraak: Elke dag twee belblokken' })
      expect(t.data.herkomst.bron).toBe('coaching')
      expect(new Date(t.due_date).toISOString()).toBe('2026-10-23T07:00:00.000Z')
      expect((await rij(tx, sql`select data->>'taakId' as t from coaching_notities where id = ${n.id}`)).t).toBe(taakId)
      expect((await rij(tx, sql`select link from notificaties where gebruiker_id = 'u-03' and titel = 'Coachingafspraak gedeeld' order by op desc limit 1`)).link).toBe(`/taken?taak=${taakId}`)
      expect((await rij(tx, sql`select actor_id, metadata->>'gebruiker' as g from audit_events where action = 'coaching.afspraak' and resource_id = ${taakId}`))).toEqual({ actor_id: 'u-04', g: 'u-03' })
      // Zonder termijn: het eerste werkmoment.
      const zonder = await coaching.afspraakAlsTaak(tx, ORG, 'u-04', 'u-03', { id: n.id, tekst: 'Script oefenen' }, nu)
      expect(new Date((await rij(tx, sql`select due_date from tasks where id = ${zonder}`)).due_date).getTime()).toBeGreaterThanOrEqual(nu.getTime() - 3600_000)
    })
  })
  it('B5: een gesprek afronden zet afgerond met audit, één keer; buiten je team 403', async () => {
    await inOrg(ORG, async (tx) => {
      const s = await rij(tx, sql`select id from coaching_sessies where gebruiker_id = 'u-03' order by datum desc limit 1`)
      await expect(coaching.rondSessieAf(tx, ORG, { id: 'u-01', rol: 'accountmanager' }, s.id, nu)).rejects.toMatchObject({ statusCode: 403 })
      const a = await coaching.rondSessieAf(tx, ORG, joost, s.id, nu)
      expect(a.door).toBe('u-04')
      await coaching.rondSessieAf(tx, ORG, joost, s.id, nu)
      expect((await rij(tx, sql`select count(*)::int n from audit_events where action = 'coaching.afronden' and resource_id = ${s.id}`)).n).toBe(1)
      const k = await coaching.coachingKaart(tx, joost, 'u-03', nu)
      expect(k.sessie!.afgerond).toBeTruthy()
      expect(k.historie[0]!.afgerond).toBe(true)
      expect(k.vandaag).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
  it('B9: de audit toont de naam van het object en filtert op vandaag', async () => {
    await inOrg(ORG, async (tx) => {
      const acc = await rij(tx, sql`select id, name from accounts where owner_id = 'u-03' order by id limit 1`)
      await tx.execute(sql`insert into audit_events (id, organisation_id, actor_id, action, resource_type, resource_id, occurred_at) values (${crypto.randomUUID()}, ${ORG}, 'u-04', 'account.eigenaar', 'accounts', ${acc.id}, now())`)
      await tx.execute(sql`insert into audit_events (id, organisation_id, actor_id, action, resource_type, resource_id, occurred_at) values (${crypto.randomUUID()}, ${ORG}, 'u-04', 'gebruiker.niveau', 'users', 'u-03', now())`)
      const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(nu)
      const { regels } = await leesAudit(tx, { gebruiker: { id: 'u-06', rol: 'beheerder' } } as any, { van: vandaag, persoon: 'u-04' }, 5000)
      for (const r of regels) expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(r.op))).toBe(vandaag)
      expect(AUDIT_PERIODEN[0]).toMatchObject({ sleutel: 'vandaag', label: 'Vandaag', dagen: 1 })
      expect(regels.find((r) => r.objectId === acc.id)!.objectNaam).toBe(acc.name)
      expect(regels.find((r) => r.objectId === 'u-03' && r.object === 'users')!.objectNaam).toMatch(/Sanne/)
    })
  })
})

describe('afgeleide tabellen en RLS', () => {
  it('nb_kpi_dag is zonder verlies opnieuw te berekenen', async () => {
    await inOrg(ORG, async (tx) => {
      await team.herberekenKpi(tx, ORG, maand)
      const a = await rijen(tx, sql`select gebruiker_id, datum::text, metriek, waarde::float from nb_kpi_dag order by 1, 2, 3`)
      expect(a.length).toBeGreaterThan(0)
      await team.herberekenKpi(tx, ORG, maand)
      expect(await rijen(tx, sql`select gebruiker_id, datum::text, metriek, waarde::float from nb_kpi_dag order by 1, 2, 3`)).toEqual(a)
    })
  })
  it('coachingnotities en sessies van Voltvast zijn onzichtbaar voor Tweede', async () => {
    await inOrg('org-tweede', async (tx) => {
      expect(await rijen(tx, sql`select 1 from coaching_notities`)).toEqual([])
      expect(await rijen(tx, sql`select 1 from coaching_sessies`)).toEqual([])
    })
  })
})
