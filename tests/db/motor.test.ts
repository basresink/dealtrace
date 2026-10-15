// P06 op databaseniveau: starterset per organisatie, cross-tenant op regels, runs,
// taken en inzichten, runs alleen bijwerken in de verslagkolommen, scopecontroles.
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

describe('regels en motor', () => {
  it('elke klantorganisatie heeft de 23 regels van de starterset, allemaal met een trigger', async () => {
    const r = await beheer.query(`select organisation_id, count(*)::int n, count(*) filter (where data->'trigger'->>'patroon' is null)::int zonder from activity_rules group by 1 order by 1`)
    expect(r.rows).toEqual([{ organisation_id: 'org-tweede', n: 23, zonder: 0 }, { organisation_id: 'org-voltvast', n: 23, zonder: 0 }])
  })
  it('regels, runs, taken en inzichten van A zijn onzichtbaar voor B', async () => {
    await beheer.query(`insert into rule_runs (organisation_id, soort) values ('org-voltvast', 'handmatig')`)
    await beheer.query(`insert into tasks (organisation_id, title) values ('org-voltvast', 'Alleen Voltvast')`)
    await beheer.query(`insert into signals (organisation_id, type, title) values ('org-voltvast', 'x', 'Alleen Voltvast')`)
    const r = await alsOrg('org-tweede', async () => [
      (await app.query(`select count(*)::int n from activity_rules where organisation_id = 'org-voltvast'`)).rows[0].n,
      (await app.query(`select count(*)::int n from rule_runs`)).rows[0].n,
      (await app.query(`select count(*)::int n from tasks`)).rows[0].n,
      (await app.query(`select count(*)::int n from signals`)).rows[0].n,
    ])
    expect(r).toEqual([0, 0, 0, 0])
    await expect(alsOrg('org-tweede', () => app.query(`insert into activity_rules (organisation_id, naam, data) values ('org-voltvast', 'X', '{}')`))).rejects.toThrow(/row-level security/)
  })
  it('een run is een log: alleen de verslagkolommen zijn bij te werken, verwijderen kan niet', async () => {
    await alsOrg('org-voltvast', async () => {
      const { rows } = await app.query(`insert into rule_runs (organisation_id, soort) values ('org-voltvast', 'uur') returning id`)
      await app.query(`update rule_runs set eind_op = now(), taken = 3 where id = $1`, [rows[0].id])
    })
    await expect(alsOrg('org-voltvast', () => app.query(`update rule_runs set soort = 'handmatig'`))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', () => app.query(`delete from rule_runs`))).rejects.toThrow(/permission denied/)
  })
  it('een persoonlijke regel heeft een eigenaar, een teamregel een team', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`insert into activity_rules (organisation_id, naam, scope, data) values ('org-voltvast', 'X', 'persoonlijk', '{}')`))).rejects.toThrow(/check constraint/)
    await expect(alsOrg('org-voltvast', () => app.query(`insert into activity_rules (organisation_id, naam, scope, data) values ('org-voltvast', 'X', 'team', '{}')`))).rejects.toThrow(/check constraint/)
  })
})
