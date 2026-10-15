// RLS en rechten op databaseniveau (bouwplan 10.1). Draait via pnpm test:db op een wegwerpdatabase.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const APP = process.env.TEST_APP_URL!
const BEHEER = process.env.TEST_BEHEER_URL!
let app: pg.Client
let beheer: pg.Client

async function alsOrg<T>(org: string | null, werk: (c: pg.Client) => Promise<T>): Promise<T> {
  await app.query('begin')
  try {
    if (org) await app.query(`select set_config('app.organisation_id', $1, true)`, [org])
    return await werk(app)
  } finally {
    await app.query('rollback')
  }
}

beforeAll(async () => {
  app = new pg.Client({ connectionString: APP }); await app.connect()
  beheer = new pg.Client({ connectionString: BEHEER }); await beheer.connect()
})
afterAll(async () => { await app.end(); await beheer.end() })

describe('RLS', () => {
  it('zonder organisatie ziet de app niemand', async () => {
    const r = await alsOrg(null, (c) => c.query('select id from users'))
    expect(r.rowCount).toBe(0)
  })
  it('ziet alleen de eigen organisatie', async () => {
    const volt = await alsOrg('org-voltvast', (c) => c.query('select distinct organisation_id from users'))
    expect(volt.rows.map((r) => r.organisation_id)).toEqual(['org-voltvast'])
    const tweede = await alsOrg('org-tweede', (c) => c.query(`select id from users where id = 'u-02'`))
    expect(tweede.rowCount).toBe(0)
  })
  it('kan niet schrijven in een andere organisatie', async () => {
    await expect(alsOrg('org-tweede', (c) => c.query(`insert into activiteiten (organisation_id, soort) values ('org-voltvast', 'bel')`))).rejects.toThrow(/row-level security/)
  })
  it('meldingen van een andere organisatie blijven onzichtbaar', async () => {
    const r = await alsOrg('org-tweede', (c) => c.query('select id from notificaties'))
    expect(r.rowCount).toBe(0)
  })
})

describe('Rechten van de app-rol', () => {
  it('activiteiten zijn alleen toevoegen', async () => {
    await alsOrg('org-voltvast', async (c) => {
      await c.query(`insert into activiteiten (organisation_id, soort) values ('org-voltvast', 'bel')`)
      await expect(c.query(`update activiteiten set soort = 'mail'`)).rejects.toThrow(/permission denied/)
    })
  })
  it('features per niveau kan de app niet wijzigen', async () => {
    await expect(alsOrg('org-voltvast', (c) => c.query(`update functies_per_niveau set aan = true`))).rejects.toThrow(/permission denied/)
  })
  it('organisaties aanmaken kan de app niet', async () => {
    await expect(alsOrg('org-voltvast', (c) => c.query(`insert into organisations (id, name) values ('x', 'X')`))).rejects.toThrow(/permission denied/)
  })
  it('de app-rol omzeilt RLS niet', async () => {
    const r = await beheer.query(`select rolbypassrls, rolsuper from pg_roles where rolname = 'dealtrace_app'`)
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false })
  })
})

describe('Startindeling en hulpfuncties', () => {
  it('functies_per_niveau is gevuld met algemene regels', async () => {
    const r = await beheer.query('select count(*)::int as n from functies_per_niveau where organisation_id is null')
    expect(r.rows[0].n).toBeGreaterThan(0)
  })
  it('sessiegebruiker is op te zoeken voordat de organisatie bekend is', async () => {
    const r = await alsOrg(null, (c) => c.query(`select id, organisation_id from dealtrace_sessie_gebruiker('u-02')`))
    expect(r.rows[0]).toMatchObject({ id: 'u-02', organisation_id: 'org-voltvast' })
  })
})
