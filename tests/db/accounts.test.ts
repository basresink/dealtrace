// P03 op databaseniveau: cascade bij verwijderen, contact altijd bij een account
// van dezelfde organisatie, cross-tenant op eigen velden, en de expressie-index.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let app: pg.Client
async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
beforeAll(async () => { app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect() })
afterAll(async () => { await app.end() })

describe('accounts en contacten', () => {
  it('verwijderen neemt de contacten mee (cascade)', async () => {
    await alsOrg('org-voltvast', async () => {
      const voor = await app.query(`select count(*)::int n from contacts where account_id = 'pr-01'`)
      expect(voor.rows[0].n).toBeGreaterThan(0)
      await app.query(`delete from accounts where id = 'pr-01'`)
      const na = await app.query(`select count(*)::int n from contacts where account_id = 'pr-01'`)
      expect(na.rows[0].n).toBe(0)
    })
  })
  it('een contact zonder account kan niet bestaan', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`insert into contacts (organisation_id, account_id, last_name) values ('org-voltvast', null, 'X')`))).rejects.toThrow()
  })
  it('een contact kan niet aan een account van een andere organisatie hangen', async () => {
    await expect(alsOrg('org-tweede', () => app.query(`insert into contacts (organisation_id, account_id, last_name) values ('org-tweede', 'pr-02', 'X')`))).rejects.toThrow()
  })
  it('een andere organisatie ziet geen accounts, contacten of eigen velden', async () => {
    const r = await alsOrg('org-tweede', async () => [
      (await app.query('select count(*)::int n from accounts')).rows[0].n,
      (await app.query('select count(*)::int n from contacts')).rows[0].n,
      (await app.query('select count(*)::int n from eigen_velden')).rows[0].n,
    ])
    expect(r).toEqual([0, 0, 0])
    await expect(alsOrg('org-tweede', () => app.query(`insert into eigen_velden (organisation_id, object, sleutel, naam, type) values ('org-voltvast', 'account', 'x', 'X', 'tekst')`))).rejects.toThrow(/row-level security/)
  })
})

describe('filterbaar eigen veld', () => {
  it('maakt een expressie-index, idempotent', async () => {
    await alsOrg('org-voltvast', async () => {
      const r1 = await app.query(`select dealtrace_index_eigen_veld('org-voltvast', 'account', 'aantal_monteurs', 'getal') as naam`)
      const r2 = await app.query(`select dealtrace_index_eigen_veld('org-voltvast', 'account', 'aantal_monteurs', 'getal') as naam`)
      expect(r1.rows[0].naam).toBe(r2.rows[0].naam)
      const idx = await app.query(`select indexdef from pg_indexes where indexname = $1`, [r1.rows[0].naam])
      expect(idx.rows[0].indexdef).toContain('aantal_monteurs')
    })
  })
  it('weigert een ongeldige sleutel (geen SQL in de sleutel)', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`select dealtrace_index_eigen_veld('org-voltvast', 'account', 'x''); drop table accounts; --', 'tekst')`))).rejects.toThrow(/Ongeldige sleutel/)
  })
})

describe('import', () => {
  it('een batch van organisatie A is voor B onzichtbaar en niet te wijzigen', async () => {
    await alsOrg('org-voltvast', async () => {
      await app.query(`insert into import_batches (id, organisation_id, gebruiker_id, bestandsnaam, soort, bron_label, status) values ('ib-test', 'org-voltvast', 'u-03', 'x.csv', 'bedrijven', 'Test', 'verwerkt')`)
      await app.query('savepoint s')
      await app.query(`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await app.query(`select count(*)::int n from import_batches where id = 'ib-test'`)).rows[0].n).toBe(0)
      expect((await app.query(`update import_batches set status = 'teruggedraaid' where id = 'ib-test'`)).rowCount).toBe(0)
    })
  })
})
