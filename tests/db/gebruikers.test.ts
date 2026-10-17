// Pakket B (gebruikers en teams) op databaseniveau: archiveren met overdracht, heractiveren binnen de seats,
// laatste beheerder, wijzigen (e-mail, eigen portefeuille), een team verwijderen alleen als het leeg is, en
// geen toegang tot een gebruiker van een andere organisatie. Elke test draait in een transactie die terugrolt.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const gb = await import('../../server/utils/gebruikers')

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
const mira = { id: 'u-06', rol: 'beheerder' }
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const tel = async (tx: any, q: any) => Number((await rijen(tx, q))[0]?.n ?? 0)

/** Geeft een gebruiker een eigen prospect met een open taak en een lopende reeks. */
async function metWerk(tx: any, gebruiker: string) {
  const acc = `acc-test-${gebruiker}`
  await tx.execute(sql`insert into accounts (id, organisation_id, name, owner_id, data) values (${acc}, ${ORG}, 'Testbedrijf Overdracht', ${gebruiker}, '{}')`)
  await tx.execute(sql`insert into tasks (organisation_id, owner_id, account_id, title, status) values (${ORG}, ${gebruiker}, ${acc}, 'Testtaak bij account', 'open')`)
  await tx.execute(sql`insert into tasks (organisation_id, owner_id, title, status) values (${ORG}, ${gebruiker}, 'Testtaak los', 'open')`)
  await tx.execute(sql`insert into reeksen (organisation_id, account_id, naam, owner_id, status) values (${ORG}, ${acc}, 'Testreeks', ${gebruiker}, 'loopt')`)
  return acc
}

describe('Gebruikers: archiveren met overdracht', () => {
  it('toont vooraf wat er verhuist, met de manager van het team als standaard', async () => {
    await inOrg(ORG, async (tx) => {
      await metWerk(tx, 'u-01')
      const s = await gb.overdrachtStand(tx, 'u-01')
      expect(s.standaard).toBe('u-04')
      expect(s.prospects).toBeGreaterThanOrEqual(1)
      expect(s.taken).toBeGreaterThanOrEqual(2)
      expect(s.reeksen).toBeGreaterThanOrEqual(1)
      expect(s.ontvangers.map((o) => o.id)).not.toContain('u-01')
    })
  })

  it('verplicht een ontvanger en draagt prospects, open taken en reeksen over, met audit', async () => {
    await inOrg(ORG, async (tx) => {
      const acc = await metWerk(tx, 'u-01')
      const voor = await gb.overdrachtStand(tx, 'u-01')
      await expect(gb.archiveerMetOverdracht(tx, ORG, mira, 'u-01', null)).rejects.toMatchObject({ statusCode: 422 })
      await expect(gb.archiveerMetOverdracht(tx, ORG, mira, 'u-01', 'u-t2')).rejects.toMatchObject({ statusCode: 422 })
      const r = await gb.archiveerMetOverdracht(tx, ORG, mira, 'u-01', 'u-04')
      expect(r.overdracht).toMatchObject({ naar: 'u-04', prospects: voor.prospects, taken: voor.taken, reeksen: voor.reeksen })
      expect(await tel(tx, sql`select count(*)::int n from accounts where owner_id = 'u-01'`)).toBe(0)
      expect(await tel(tx, sql`select count(*)::int n from tasks where owner_id = 'u-01' and status in ('open', 'bezig')`)).toBe(0)
      expect(await tel(tx, sql`select count(*)::int n from reeksen where owner_id = 'u-01' and status in ('loopt', 'gepauzeerd')`)).toBe(0)
      expect((await rijen(tx, sql`select owner_id from accounts where id = ${acc}`))[0].owner_id).toBe('u-04')
      expect((await rijen(tx, sql`select status from users where id = 'u-01'`))[0].status).toBe('gearchiveerd')
      expect(await tel(tx, sql`select count(*)::int n from audit_events where action = 'gebruiker.archiveren' and resource_id = 'u-01'`)).toBe(1)
      expect(await tel(tx, sql`select count(*)::int n from audit_events where action = 'account.eigenaar' and resource_id = ${acc}`)).toBe(1)
    })
  })

  it('zonder werk op naam mag archiveren zonder ontvanger', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into users (id, organisation_id, name, email, role, niveau, status, werkplek, data) values ('u-leeg', ${ORG}, 'Testgebruiker Leeg', 'leeg@voltvast.test', 'accountmanager', 'beginner', 'actief', 'binnendienst', '{}')`)
      const r = await gb.archiveerMetOverdracht(tx, ORG, mira, 'u-leeg', null)
      expect(r.overdracht).toMatchObject({ naar: null, prospects: 0, taken: 0, reeksen: 0 })
    })
  })

  it('niet jezelf en niet de laatste beheerder', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(gb.archiveerMetOverdracht(tx, ORG, mira, 'u-06', 'u-04')).rejects.toMatchObject({ statusCode: 409 })
      await expect(gb.archiveerMetOverdracht(tx, ORG, { id: 'u-04', rol: 'beheerder' }, 'u-06', 'u-04')).rejects.toMatchObject({ statusCode: 409, statusMessage: 'De laatste beheerder kun je niet archiveren' })
    })
  })
})

describe('Gebruikers: heractiveren', () => {
  it('lukt binnen de seats en geeft 409 met aanvragen als alle seats in gebruik zijn', async () => {
    await inOrg(ORG, async (tx) => {
      await gb.archiveerMetOverdracht(tx, ORG, mira, 'u-02', 'u-04')
      const seats = Number((await rijen(tx, sql`select (contract->>'seats')::int s from organisations where id = ${ORG}`))[0].s)
      const actief = await tel(tx, sql`select count(*)::int n from users where status <> 'gearchiveerd'`)
      for (let i = actief; i < seats; i++) {
        await tx.execute(sql`insert into users (id, organisation_id, name, email, role, niveau, status, werkplek, data) values (${`u-vul-${i}`}, ${ORG}, ${`Testgebruiker Vul ${i}`}, ${`vul${i}@voltvast.test`}, 'accountmanager', 'beginner', 'uitgenodigd', 'binnendienst', '{}')`)
      }
      await expect(gb.heractiveerGebruiker(tx, ORG, mira, 'u-02')).rejects.toMatchObject({ statusCode: 409, data: { aanvragen: true } })
      await tx.execute(sql`update users set status = 'gearchiveerd' where id like 'u-vul-%'`)
      const terug = await gb.heractiveerGebruiker(tx, ORG, mira, 'u-02')
      expect(['actief', 'uitgenodigd']).toContain(terug.status)
      expect(await tel(tx, sql`select count(*)::int n from audit_events where action = 'gebruiker.heractiveren' and resource_id = 'u-02'`)).toBe(1)
      await expect(gb.heractiveerGebruiker(tx, ORG, mira, 'u-02')).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  it('ziet geen gebruiker van een andere organisatie', async () => {
    await inOrg('org-tweede', async (tx) => {
      await expect(gb.overdrachtStand(tx, 'u-01')).rejects.toMatchObject({ statusCode: 404 })
      await expect(gb.heractiveerGebruiker(tx, 'org-tweede', { id: 'u-t1' }, 'u-01')).rejects.toMatchObject({ statusCode: 404 })
      await expect(gb.archiveerMetOverdracht(tx, 'org-tweede', { id: 'u-t1', rol: 'beheerder' }, 'u-01', 'u-t2')).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})

describe('Gebruikers: wijzigen', () => {
  it('controleert naam, e-mail en eigen portefeuille', async () => {
    await inOrg(ORG, async (tx) => {
      const [joost] = await rijen(tx, sql`select * from users where id = 'u-04'`)
      const doel = { ...joost, name: joost.name, email: joost.email, data: joost.data ?? {} } as any
      expect(() => gb.persoonWijziging(doel, { naam: ' ' }, 'salesmanager')).toThrow(/Naam/)
      expect(() => gb.persoonWijziging(doel, { email: 'geen-adres' }, 'salesmanager')).toThrow(/e-mailadres/)
      expect(() => gb.persoonWijziging(doel, { eigenPortefeuille: true }, 'accountmanager')).toThrow(/salesmanager/)
      const w = gb.persoonWijziging(doel, { naam: 'Testgebruiker Joost Nieuw', email: ' JOOST.NIEUW@voltvast.test ', eigenPortefeuille: true }, 'salesmanager')
      expect(w).toMatchObject({ name: 'Testgebruiker Joost Nieuw', email: 'joost.nieuw@voltvast.test', data: { eigenPortefeuille: true } })
      expect(gb.persoonWijziging(doel, { naam: joost.name, email: joost.email }, 'salesmanager')).toEqual({})
    })
  })
})

describe('Teams verwijderen', () => {
  it('alleen een leeg team; met leden of teamregels 409 met uitleg', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(gb.verwijderTeam(tx, ORG, mira, 'team-noord')).rejects.toMatchObject({ statusCode: 409, statusMessage: expect.stringMatching(/ander team/) })
      await tx.execute(sql`insert into teams (id, organisation_id, naam, manager_ids, gekoppelde_teams, data) values ('team-leeg', ${ORG}, 'Team Leeg', '{}', '{}', '{}'), ('team-regel', ${ORG}, 'Team Regel', '{}', '{}', '{}')`)
      await tx.execute(sql`update teams set gekoppelde_teams = array['team-leeg'] where id = 'team-zuid'`)
      await tx.execute(sql`insert into activity_rules (organisation_id, naam, scope, team_id, data) values (${ORG}, 'Testregel team', 'team', 'team-regel', '{}')`)
      await expect(gb.verwijderTeam(tx, ORG, mira, 'team-regel')).rejects.toMatchObject({ statusCode: 409, statusMessage: expect.stringMatching(/Regels/) })
      expect(await gb.verwijderTeam(tx, ORG, mira, 'team-leeg')).toEqual({ ok: true })
      expect(await tel(tx, sql`select count(*)::int n from teams where id = 'team-leeg'`)).toBe(0)
      expect((await rijen(tx, sql`select gekoppelde_teams from teams where id = 'team-zuid'`))[0].gekoppelde_teams).toEqual([])
      expect(await tel(tx, sql`select count(*)::int n from audit_events where action = 'team.verwijderen' and resource_id = 'team-leeg'`)).toBe(1)
      await expect(gb.verwijderTeam(tx, ORG, mira, 'team-onbekend')).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
