// P25 op databaseniveau: versies van artikelen per organisatie (RLS), controlevragen bij gelezen, vragen
// zonder antwoord per organisatie, en de statistiek van de founder via de platformrol.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let app: pg.Client
async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
const fout = async (p: () => Promise<unknown>) => { await app.query('savepoint t'); try { await p(); return null } catch (e: any) { return e.message as string } finally { await app.query('rollback to savepoint t') } }
beforeAll(async () => { app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect() })
afterAll(async () => { await app.end() })

describe('helpcenter compleet', () => {
  it('een eigen artikel met versie: onzichtbaar voor B; de app schrijft geen platformversie', async () => {
    await alsOrg('org-voltvast', async () => {
      const { rows: [a] } = await app.query(`insert into help_artikelen (organisation_id, collectie, categorie, slug, titel, status) values ('org-voltvast', 'newbusiness', 'Bezwaren', 'ons-bezwarenboek', 'Ons bezwarenboek', 'concept') returning id`)
      await app.query(`insert into help_artikel_versies (artikel_id, organisation_id, versie, titel, data) values ($1, 'org-voltvast', 1, 'Ons bezwarenboek', '{}')`, [a.id])
      expect(await fout(() => app.query(`insert into help_artikel_versies (artikel_id, organisation_id, versie, titel, data) values ($1, null, 2, 'x', '{}')`, [a.id]))).toMatch(/row-level security/)
      await app.query(`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await app.query(`select count(*)::int n from help_artikel_versies`)).rows[0].n).toBe(0)
      expect((await app.query(`select count(*)::int n from help_artikelen where slug = 'ons-bezwarenboek'`)).rows[0].n).toBe(0)
    })
  })
  it('gelezen bewaart het aantal goede controlevragen; vragen zonder antwoord blijven in de eigen organisatie', async () => {
    await alsOrg('org-voltvast', async () => {
      const { rows: [a] } = await app.query(`select id from help_artikelen where slug = 'om-de-afspraak-vragen'`)
      await app.query(`insert into help_gelezen (organisation_id, gebruiker_id, artikel_id, vragen_goed) values ('org-voltvast', 'u-01', $1, 2)`, [a.id])
      expect((await app.query(`select vragen_goed from help_gelezen where artikel_id = $1`, [a.id])).rows[0].vragen_goed).toBe(2)
      await app.query(`insert into help_zoekopdrachten (organisation_id, term, resultaten, soort) values ('org-voltvast', 'hoe exporteer ik naar excel', 0, 'vraag')`)
      await app.query(`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await app.query(`select count(*)::int n from help_zoekopdrachten where soort = 'vraag'`)).rows[0].n).toBe(0)
      await app.query(`set local role dealtrace_platform`)
      expect((await app.query(`select * from dealtrace_platform_help_vragen()`)).rows.map((r: any) => r.term)).toContain('hoe exporteer ik naar excel')
      expect((await app.query(`select count(*)::int n from dealtrace_platform_help_statistiek()`)).rows[0].n).toBeGreaterThan(100)
    })
  })
})
