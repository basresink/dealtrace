// Platformscheiding op databaseniveau (P02): de database zegt nee.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let app: pg.Client
let beheer: pg.Client

async function inTransactie<T>(c: pg.Client, werk: () => Promise<T>, voor = ''): Promise<T> {
  await c.query('begin')
  try {
    if (voor) await c.query(voor)
    return await werk()
  } finally {
    await c.query('rollback')
  }
}
const alsPlatform = <T>(werk: () => Promise<T>) => inTransactie(app, werk, 'set local role dealtrace_platform')
const alsOrg = <T>(org: string, werk: () => Promise<T>) => inTransactie(app, werk, `select set_config('app.organisation_id', '${org}', true)`)

beforeAll(async () => {
  app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect()
  beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect()
})
afterAll(async () => { await app.end(); await beheer.end() })

describe('dealtrace_platform', () => {
  it('ziet organisaties over alle klanten heen', async () => {
    const r = await alsPlatform(() => app.query('select id from organisations'))
    expect(r.rows.map((x) => x.id)).toEqual(expect.arrayContaining(['org-voltvast', 'org-tweede', 'org-dealtrace']))
  })
  it('leest geen klantdata', async () => {
    for (const t of ['activiteiten', 'notificaties', 'persoonlijke_instellingen', 'mutaties']) {
      await expect(alsPlatform(() => app.query(`select * from ${t} limit 1`)), t).rejects.toThrow(/permission denied/)
    }
  })
  it('de tellingen geven alleen getallen, geen klantrecords', async () => {
    const r = await alsPlatform(() => app.query('select * from dealtrace_platform_tellingen()'))
    expect(r.fields.map((f) => f.name).sort()).toEqual(['activiteiten_30d', 'gebruikers', 'laatste_activiteit', 'laatste_inlog', 'met_login', 'organisation_id'])
    expect(r.rows.some((x) => x.organisation_id === 'org-dealtrace')).toBe(false)
  })
})

describe('dealtrace_app zonder set role', () => {
  it('erft niets van dealtrace_platform', async () => {
    const r = await beheer.query(`select rolinherit from pg_roles where rolname = 'dealtrace_app'`)
    expect(r.rows[0].rolinherit).toBe(false)
    const orgs = await alsOrg('org-voltvast', () => app.query('select id from organisations'))
    expect(orgs.rows.map((x) => x.id)).toEqual(['org-voltvast'])
  })
  it('kan de platformfuncties en platformtabellen niet gebruiken', async () => {
    await expect(alsOrg('org-voltvast', () => app.query('select * from dealtrace_platform_tellingen()'))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', () => app.query('select * from platform_audit'))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', () => app.query('select * from org_gezondheid'))).rejects.toThrow(/permission denied/)
  })
  it('mag de founders een melding sturen, zonder iets terug te lezen', async () => {
    const r = await alsOrg('org-voltvast', () => app.query(`select dealtrace_meld_founders('Test', 'Test', null)`))
    expect(r.rows).toHaveLength(1)
  })
})

describe('rol founder', () => {
  it('de app en het platform kunnen niemand founder maken', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`update users set role = 'founder' where id = 'u-02'`))).rejects.toThrow(/founder/)
    await expect(alsPlatform(() => app.query(`update users set role = 'founder' where id = 'u-02'`))).rejects.toThrow(/founder/)
    await expect(alsPlatform(() => app.query(`insert into users (id, organisation_id, email, name, role) values ('x', 'org-voltvast', 'x@x.test', 'X', 'founder')`))).rejects.toThrow(/founder/)
  })
  it('de migratierol wel', async () => {
    await inTransactie(beheer, async () => {
      await beheer.query(`update users set role = 'founder' where id = 'u-02'`)
    })
  })
})

describe('platform_audit', () => {
  it('is alleen toevoegen, ook voor de eigenaar', async () => {
    await inTransactie(beheer, async () => {
      await beheer.query(`insert into platform_audit (actor_id, handeling) values ('test', 'test')`)
      await expect(beheer.query(`update platform_audit set handeling = 'x'`)).rejects.toThrow(/alleen toevoegen/)
    })
    await inTransactie(beheer, async () => {
      await beheer.query(`insert into platform_audit (actor_id, handeling) values ('test', 'test')`)
      await expect(beheer.query(`delete from platform_audit`)).rejects.toThrow(/alleen toevoegen/)
    })
  })
})
