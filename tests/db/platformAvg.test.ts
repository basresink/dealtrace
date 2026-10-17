// Pakket C op databaseniveau (migratie 0075): de platformrol leest van een klant alleen getallen via
// dealtrace_platform_avg en dealtrace_platform_prompts, nooit records; de app-rol kan die functies niet
// aanroepen; de platformrol mag een eigen AI-koppeling van een klant weghalen. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

let pool: pg.Pool
class Terug extends Error {}
const ORG = 'org-voltvast'
async function inTx<T>(werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${ORG}, true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
const alsPlatform = (tx: any) => tx.execute(sql`set local role dealtrace_platform`)
const terugNaarApp = (tx: any) => tx.execute(sql`reset role`)
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const fout = async (tx: any, p: () => Promise<unknown>) => { await tx.execute(sql`savepoint t`); try { await p(); return null } catch (e: any) { return e?.cause?.message ?? e.message } finally { await tx.execute(sql`rollback to savepoint t`) } }
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

describe('Data en AVG voor de founder', () => {
  it('de tellingen kloppen met wat de klant zelf ziet, en bevatten geen namen of teksten', async () => {
    await inTx(async (tx) => {
      const eigen = await rij(tx, sql`select
        (select count(*)::int from accounts where gedeactiveerd_op is null) as accounts,
        (select count(*)::int from contacts) as contacten,
        (select count(*)::int from activiteiten) as activiteiten`)
      await alsPlatform(tx)
      const t = await rij(tx, sql`select * from dealtrace_platform_avg(${ORG})`)
      expect(t).toMatchObject({ accounts: eigen.accounts, contacten: eigen.contacten, activiteiten: eigen.activiteiten })
      expect(t.accounts).toBeGreaterThan(0)
      expect(t.prospects + t.klanten).toBe(t.accounts)
      expect(Object.values(t.accounts_per_bron as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(t.accounts + t.gedeactiveerd)
      const tekst = JSON.stringify(t)
      expect(tekst).not.toMatch(/@/)
      // Een andere klant telt los.
      const ander = await rij(tx, sql`select * from dealtrace_platform_avg('org-tweede')`)
      expect(ander.accounts).not.toBe(t.accounts)
    })
  })

  it('een export door de beheerder telt mee als laatste export', async () => {
    await inTx(async (tx) => {
      await tx.execute(sql`insert into audit_events (id, occurred_at, organisation_id, actor_id, action, resource_type, resource_id) values (gen_random_uuid()::text, now(), ${ORG}, 'u-06', 'organisatie.export', 'organisatie', ${ORG})`)
      await alsPlatform(tx)
      const t = await rij(tx, sql`select laatste_export, exports_12m from dealtrace_platform_avg(${ORG})`)
      expect(t.laatste_export).not.toBeNull()
      expect(t.exports_12m).toBeGreaterThanOrEqual(1)
    })
  })

  it('de platformrol leest geen klantrecords; de app-rol kan de platformfuncties niet aanroepen', async () => {
    await inTx(async (tx) => {
      expect(await fout(tx, () => tx.execute(sql`select * from dealtrace_platform_avg(${ORG})`))).toMatch(/permission denied/)
      expect(await fout(tx, () => tx.execute(sql`select * from dealtrace_platform_prompts(${ORG})`))).toMatch(/permission denied/)
      await alsPlatform(tx)
      for (const t of ['accounts', 'contacts', 'activiteiten', 'activiteit_verslagen', 'bijlagen', 'leads']) {
        expect(await fout(tx, () => tx.execute(sql.raw(`select * from ${t} limit 1`))), t).toMatch(/permission denied/)
      }
      // Ook de prompttekst van een klant blijft buiten bereik.
      expect(await rijen(tx, sql`select * from prompt_versies where organisation_id is not null`)).toEqual([])
    })
  })

  it('eigen prompts van een klant: slot, aantal versies en datum, zonder tekst', async () => {
    await inTx(async (tx) => {
      await tx.execute(sql`insert into prompt_versies (slot, laag, organisation_id, versie, tekst, auteur_id) values ('briefing', 'organisatie', ${ORG}, 1, 'Eigen tekst', 'u-06'), ('briefing', 'organisatie', ${ORG}, 2, 'Eigen tekst 2', 'u-06')`)
      await alsPlatform(tx)
      const r = await rijen(tx, sql`select * from dealtrace_platform_prompts(${ORG})`)
      expect(r).toHaveLength(1)
      expect(r[0]).toMatchObject({ slot: 'briefing', versies: 2, laatste_versie: 2 })
      expect(Object.keys(r[0])).not.toContain('tekst')
      expect(await rijen(tx, sql`select * from dealtrace_platform_prompts('org-tweede')`)).toEqual([])
    })
  })

  it('de platformrol haalt een eigen AI-koppeling van een klant weg; de platformrij blijft', async () => {
    await inTx(async (tx) => {
      await alsPlatform(tx)
      await tx.execute(sql`insert into llm_connections (organisation_id, provider, door) values (${ORG}, 'mock', 'u-founder'), (null, 'claude', 'u-founder')`)
      await tx.execute(sql`delete from llm_connections where organisation_id = ${ORG}`)
      expect((await rij(tx, sql`select count(*)::int as n from llm_connections where organisation_id = ${ORG}`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from llm_connections where organisation_id is null`)).n).toBe(1)
      await terugNaarApp(tx)
      expect(await fout(tx, () => tx.execute(sql`delete from llm_connections`))).toMatch(/permission denied/)
    })
  })
})
