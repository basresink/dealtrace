// Testronde (okt 2026) op databaseniveau: de seed is consistent (klasse volgt uit het aantal
// medewerkers, B02) en een motorrun geeft per persoon per dag hooguit het startplafond (B08).
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { STARTPLAFOND_STANDAARD, klasseVoorOmvang, omvangVan, type Klasse } from '../../shared/ritmematrix'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { draaiMotor } = await import('../../server/utils/motor')

let pool: pg.Pool
class Terug extends Error {}
async function inVoltvast<T>(werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', 'org-voltvast', true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

describe('B02 klassen in de seed', () => {
  it('neutrale namen, grenzen per klasse en een laagste klasse zonder ondergrens', async () => {
    const klassen = await inVoltvast(async (tx) => ((await tx.execute(sql`select value from org_settings where key = 'klassen'`)).rows[0] as any).value as Klasse[])
    const prospects = klassen.filter((k) => k.tabblad !== 'Klanten')
    expect(prospects.map((k) => k.naam)).toEqual(['A · Groot', 'B · Middel', 'C · Klein', 'D · Zeer klein'])
    expect(prospects.every((k) => Number.isInteger(k.minMedewerkers))).toBe(true)
    expect(Math.min(...prospects.map((k) => k.minMedewerkers!))).toBe(0)
    expect(JSON.stringify(klassen)).not.toContain('Aantal monteurs')
  })
  it('elke prospect met een omvang heeft de klasse die daaruit volgt', async () => {
    const { klassen, rijen } = await inVoltvast(async (tx) => ({
      klassen: ((await tx.execute(sql`select value from org_settings where key = 'klassen'`)).rows[0] as any).value as Klasse[],
      rijen: (await tx.execute(sql`select id, klasse, data from accounts where account_kind = 'prospect' and id not like 'eva-%'`)).rows as { id: string; klasse: string | null; data: any }[],
    }))
    const prospectKlassen = klassen.filter((k) => k.tabblad !== 'Klanten')
    const fout = rijen.filter((a) => omvangVan(a.data) !== null && (a.data?.herkomst?.klasse?.bron ?? null) !== 'hand' && a.klasse !== klasseVoorOmvang(omvangVan(a.data), prospectKlassen))
    expect(fout.map((a) => `${a.id}: ${a.klasse} bij ${omvangVan(a.data)}`)).toEqual([])
    // Zonder omvang geen klasse: de gegenereerde accounts zetten de klasse niet meer los van de omvang.
    expect(rijen.filter((a) => a.id.startsWith('pr-g') && omvangVan(a.data) === null && a.klasse)).toEqual([])
  })
})

describe('B08 startactiviteiten onder het dagplafond', () => {
  it('na een motorrun heeft niemand meer startactiviteiten op een dag dan het plafond', async () => {
    const perDag = await inVoltvast(async (tx) => {
      await tx.execute(sql`delete from tasks where rule_id = 'start'`)
      await draaiMotor(tx, 'org-voltvast', { soort: 'handmatig', nu: new Date() })
      return (await tx.execute(sql`select owner_id, to_char(due_date at time zone 'Europe/Amsterdam', 'YYYY-MM-DD') as dag, count(*)::int as n
        from tasks where rule_id = 'start' and status = 'open' group by 1, 2`)).rows as { owner_id: string; dag: string; n: number }[]
    })
    expect(perDag.length).toBeGreaterThan(0)
    expect(Math.max(...perDag.map((r) => r.n))).toBeLessThanOrEqual(STARTPLAFOND_STANDAARD)
  })
})
