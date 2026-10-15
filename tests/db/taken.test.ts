// P07 op databaseniveau: de startset van ritmes, cross-tenant op ritmes, en een dubbele
// mutatie uit de wachtrij kan niet twee keer worden vastgelegd.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let app: pg.Client
let beheer: pg.Client
async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
beforeAll(async () => {
  app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect()
  beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect()
})
afterAll(async () => { await app.end(); await beheer.end() })

describe('hercontactritmes en wachtrij', () => {
  it('elke klantorganisatie heeft de vier ritmes van de startset', async () => {
    const r = await beheer.query(`select organisation_id, string_agg(naam, ', ' order by naam) as namen from hercontactritmes group by 1 order by 1`)
    expect(r.rows).toEqual([
      { organisation_id: 'org-tweede', namen: 'Buitendienst koud, Koud, Warm, Winback' },
      { organisation_id: 'org-voltvast', namen: 'Buitendienst koud, Koud, Warm, Winback' },
    ])
  })
  it('een andere organisatie ziet de ritmes niet', async () => {
    const n = await alsOrg('org-tweede', async () => (await app.query(`select count(*)::int n from hercontactritmes where organisation_id = 'org-voltvast'`)).rows[0].n)
    expect(n).toBe(0)
  })
  it('dezelfde idempotentiesleutel kan maar één keer worden vastgelegd', async () => {
    await alsOrg('org-voltvast', async () => {
      await app.query(`insert into mutaties (id, organisation_id, user_id, tabel, op, record_id, resultaat) values ('dubbel-1', 'org-voltvast', 'u-03', 'tasks', 'patch', 't1', '{}')`)
      await expect(app.query(`insert into mutaties (id, organisation_id, user_id, tabel, op, record_id, resultaat) values ('dubbel-1', 'org-voltvast', 'u-03', 'tasks', 'patch', 't1', '{}')`)).rejects.toThrow(/duplicate key/)
    })
  })
  it('prospects in Gekwalificeerd lopen in een ritme (seed)', async () => {
    const r = await beheer.query(`select count(*)::int n from accounts where fase_id = 'gekwalificeerd' and nb_status = 'in reis' and not (data->'reis'->'ritme'->>'actief')::boolean`)
    expect(r.rows[0].n).toBe(0)
  })
})
