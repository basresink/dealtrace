// Status prospect (koud, lauw, warm, heet) op databaseniveau: bewaren in accounts.data met een auditregel,
// wissen met null, weigeren van een onbekende waarde en van een klant, rechten (eigenaar en beheerder wel, een
// collega niet), de telling en de lijst op Mijn dashboard, en de aanvulling van Eva's seed die idempotent is.
// Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const ps = await import('../../server/utils/prospectStatus')
const dash = await import('../../server/utils/dashboard')
const { seedEvaStatus } = await import('../../server/db/seedEvaStatus')

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
const ACC = 'pr-g01'
const eigenaar = { id: 'u-01', rol: 'accountmanager' }
const collega = { id: 'u-02', rol: 'accountmanager' }
const beheerder = { id: 'u-06', rol: 'beheerder' }
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const fout = async (p: Promise<unknown>) => { try { await p; return null } catch (e: any) { return e } }

describe('status prospect bewaren', () => {
  it('de eigenaar zet de status; data en audit (van, naar) kloppen; dezelfde waarde nog eens is geen wijziging', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update accounts set owner_id = 'u-01', data = data - 'prospectStatus' where id = ${ACC}`)
      const r = await ps.zetProspectStatus(tx, ORG, eigenaar, ACC, 'warm')
      expect(r).toEqual({ id: ACC, prospectStatus: 'warm', gewijzigd: true })
      const a = await rij(tx, sql`select data from accounts where id = ${ACC}`)
      expect(a.data.prospectStatus).toBe('warm')
      expect(a.data.prospectStatusDoor).toBe('u-01')
      await ps.zetProspectStatus(tx, ORG, eigenaar, ACC, 'heet')
      const audit = (await tx.execute(sql`select actor_id, changes from audit_events where action = 'account.prospectStatus' and resource_id = ${ACC} order by occurred_at`)).rows as any[]
      expect(audit.map((x) => x.changes)).toEqual(expect.arrayContaining([{ van: null, naar: 'warm' }, { van: 'warm', naar: 'heet' }]))
      expect(audit.every((x) => x.actor_id === 'u-01')).toBe(true)
      expect((await ps.zetProspectStatus(tx, ORG, eigenaar, ACC, 'heet')).gewijzigd).toBe(false)
      expect(((await tx.execute(sql`select 1 from audit_events where action = 'account.prospectStatus' and resource_id = ${ACC}`)).rows as any[]).length).toBe(2)
    })
  })

  it('null wist de status met een auditregel', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update accounts set owner_id = 'u-01', data = data || '{"prospectStatus": "koud"}'::jsonb where id = ${ACC}`)
      await ps.zetProspectStatus(tx, ORG, eigenaar, ACC, null)
      const a = await rij(tx, sql`select data from accounts where id = ${ACC}`)
      expect(a.data.prospectStatus).toBeUndefined()
      const audit = await rij(tx, sql`select changes from audit_events where action = 'account.prospectStatus' and resource_id = ${ACC}`)
      expect(audit.changes).toEqual({ van: 'koud', naar: null })
    })
  })

  it('weigert een onbekende waarde (422), een klant (422) en een onbekend account (404)', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await fout(ps.zetProspectStatus(tx, ORG, beheerder, ACC, 'gloeiend')))?.statusCode).toBe(422)
      const klant = await rij(tx, sql`select id from accounts where account_kind = 'klant' limit 1`)
      expect((await fout(ps.zetProspectStatus(tx, ORG, beheerder, klant.id, 'warm')))?.statusCode).toBe(422)
      expect((await fout(ps.zetProspectStatus(tx, ORG, beheerder, 'bestaat-niet', 'warm')))?.statusCode).toBe(404)
    })
  })

  it('rechten: een collega niet (403), de beheerder wel', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update accounts set owner_id = 'u-01', data = data - 'prospectStatus' where id = ${ACC}`)
      const e = await fout(ps.zetProspectStatus(tx, ORG, collega, ACC, 'warm'))
      expect(e?.statusCode).toBe(403)
      expect((await rij(tx, sql`select data->>'prospectStatus' as s from accounts where id = ${ACC}`)).s).toBeNull()
      expect((await ps.zetProspectStatus(tx, ORG, beheerder, ACC, 'lauw')).prospectStatus).toBe('lauw')
    })
  })

  it('een andere organisatie ziet het account niet (RLS): 404', async () => {
    const ander = 'org-tweede'
    await inOrg(ander, async (tx) => {
      expect((await fout(ps.zetProspectStatus(tx, ander, beheerder, ACC, 'warm')))?.statusCode).toBe(404)
    })
  })
})

describe('Mijn dashboard: telling en lijst per status', () => {
  const opties = { vergelijken: false, dekking: true, funnel: true, funnelDetails: false }
  it('de telling in het dashboard en de lijst achter een kolom komen overeen', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update accounts set data = data - 'prospectStatus' where owner_id = 'u-01'`)
      await tx.execute(sql`update accounts set data = data || '{"prospectStatus": "heet"}'::jsonb where id = ${ACC} and owner_id = 'u-01'`)
      const d = await dash.mijnDashboard(tx, 'u-01', {}, opties)
      const heet = d.statusProspects.kolommen.find((k) => k.sleutel === 'heet')!
      expect(heet.aantal).toBe(1)
      const lijst = await dash.dashboardLijst(tx, 'u-01', { blok: 'status', sleutel: 'heet' }, opties)
      expect(lijst.items.map((i) => i.accountId)).toEqual([ACC])
      expect(lijst.items[0]!.prospectStatus).toBe('heet')
      const geen = await dash.dashboardLijst(tx, 'u-01', { blok: 'status', sleutel: 'geen' }, opties)
      expect(geen.items.length).toBe(d.statusProspects.zonder)
      expect((await fout(dash.dashboardLijst(tx, 'u-01', { blok: 'status', sleutel: 'gloeiend' }, opties)))?.statusCode).toBe(400)
      expect((await fout(dash.dashboardLijst(tx, 'u-01', { blok: 'dekking', sleutel: '7' }, { ...opties, dekking: false })))?.statusCode).toBe(403)
    })
  })
})

describe('seed: status voor Eva', () => {
  it('geeft een deel van Eva\'s prospects een status, raakt een bestaande status niet en is idempotent', async () => {
    const client = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL })
    await client.connect()
    try {
      await client.query('begin')
      const telling = async () => (await client.query(`select data->>'prospectStatus' as s, count(*)::int as n from accounts where owner_id = 'u-07' and account_kind = 'prospect' and gedeactiveerd_op is null group by 1`)).rows as { s: string | null; n: number }[]
      const voor = await telling()
      expect(voor.filter((r) => r.s).reduce((s, r) => s + r.n, 0)).toBeGreaterThan(0)
      const eentje = (await client.query(`select id from accounts where owner_id = 'u-07' and account_kind = 'prospect' and data ? 'prospectStatus' order by id limit 1`)).rows[0].id
      await client.query(`update accounts set data = data || '{"prospectStatus": "koud"}'::jsonb where id = $1`, [eentje])
      expect(await seedEvaStatus(client, ORG)).toBe(0)
      expect((await client.query(`select data->>'prospectStatus' as s from accounts where id = $1`, [eentje])).rows[0].s).toBe('koud')
      const zonder = voor.find((r) => !r.s)?.n ?? 0
      expect(zonder).toBeGreaterThan(0)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  })
})
