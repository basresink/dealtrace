// P05 op databaseniveau: fase, reis en status veranderen alleen via het meldpunt,
// één actieve inschrijving per account, reisgeschiedenis alleen toevoegen voor de
// app, standaardreis per organisatie en cross-tenant op de nieuwe tabellen.
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

describe('meldpunt in de database', () => {
  it('een rechtstreekse fasewissel (zoals PUT met fase_id) wordt geweigerd', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`update accounts set fase_id = 'benaderd' where id = 'pr-01'`))).rejects.toThrow(/alleen via het meldpunt/)
    await expect(alsOrg('org-voltvast', () => app.query(`update accounts set nb_status = 'nee' where id = 'pr-01'`))).rejects.toThrow(/alleen via het meldpunt/)
  })
  it('met het meldpunt aan mag het wel; andere velden altijd', async () => {
    await alsOrg('org-voltvast', async () => {
      await app.query(`update accounts set city = 'Elders' where id = 'pr-01'`)
      await app.query(`select set_config('dealtrace.meldpunt', 'aan', true)`)
      const r = await app.query(`update accounts set fase_id = 'benaderd' where id = 'pr-01'`)
      expect(r.rowCount).toBe(1)
    })
  })
  it('een account zit in hoogstens één actieve reis', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(
      `insert into prospectreizen (organisation_id, reistemplate_id, account_id, fase_id, nb_status) values ('org-voltvast', 'reis-standaard-org-voltvast', 'pr-01', 'gevonden', 'nieuw')`,
    ))).rejects.toThrow(/prospectreizen_een_actief/)
  })
  it('de reisgeschiedenis is alleen toevoegen voor de app', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`update reisgeschiedenis set reden = 'x'`))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', () => app.query(`delete from reisgeschiedenis`))).rejects.toThrow(/permission denied/)
  })
  it('een account verwijderen neemt inschrijving en geschiedenis mee', async () => {
    await alsOrg('org-voltvast', async () => {
      await app.query(`delete from accounts where id = 'pr-02'`)
      const n = await app.query(`select (select count(*) from prospectreizen where account_id = 'pr-02')::int + (select count(*) from reisgeschiedenis where account_id = 'pr-02')::int as n`)
      expect(n.rows[0].n).toBe(0)
    })
  })
})

describe('standaardreis en isolatie', () => {
  it('elke klantorganisatie heeft precies één standaardreis met tien fases en startactiviteiten', async () => {
    const r = await beheer.query(`select organisation_id, jsonb_array_length(data->'fases') as n, (select count(*)::int from activiteitstemplates a where a.reistemplate_id = r.id) as acts
      from reistemplates r where is_standaard order by organisation_id`)
    expect(r.rows.map((x) => x.organisation_id)).toEqual(['org-tweede', 'org-voltvast'])
    expect(r.rows.every((x) => x.n === 10 && x.acts > 0)).toBe(true)
    await expect(beheer.query(`insert into reistemplates (organisation_id, naam, is_standaard, data) values ('org-voltvast', 'Tweede standaard', true, '{}')`)).rejects.toThrow(/reistemplates_standaard_uniek/)
  })
  it('elk prospect van de seed staat in een fase met een inschrijving', async () => {
    const r = await beheer.query(`select count(*)::int as zonder from accounts a where a.account_kind = 'prospect'
      and (a.fase_id is null or not exists (select 1 from prospectreizen p where p.account_id = a.id))`)
    expect(r.rows[0].zonder).toBe(0)
  })
  it('een andere organisatie ziet geen doelgroepen, reizen, inschrijvingen of geschiedenis', async () => {
    await beheer.query(`insert into doelgroepen (organisation_id, naam, status) values ('org-voltvast', 'Alleen Voltvast', 'actief')`)
    const r = await alsOrg('org-tweede', async () => [
      (await app.query(`select count(*)::int n from doelgroepen`)).rows[0].n,
      (await app.query(`select count(*)::int n from reistemplates where organisation_id = 'org-voltvast'`)).rows[0].n,
      (await app.query(`select count(*)::int n from prospectreizen`)).rows[0].n,
      (await app.query(`select count(*)::int n from reisgeschiedenis`)).rows[0].n,
    ])
    expect(r).toEqual([0, 0, 0, 0])
    await expect(alsOrg('org-tweede', () => app.query(`insert into doelgroepen (organisation_id, naam) values ('org-voltvast', 'X')`))).rejects.toThrow(/row-level security/)
  })
  it('accounts op nee hebben een reden, afkoeling en terugkomdatum (seed)', async () => {
    const r = await beheer.query(`select count(*)::int as n from accounts where nb_status = 'nee' and (terug_op is null or data->'nee'->>'reden' is null or data->'nee'->'afkoeling' is null)`)
    expect(r.rows[0].n).toBe(0)
  })
})
