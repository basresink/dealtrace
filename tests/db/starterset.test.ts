// "Starterset terugzetten" houdt de id's van regels met dezelfde code, zodat open taken en inzichten aan
// hun regel blijven hangen en de motor erop blijft ontdubbelen.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { zetStartersetTerug } = await import('../../server/utils/motor')

let pool: pg.Pool
class Terug extends Error {}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

it('na terugzetten heeft elke regel van de starterset nog hetzelfde id', async () => {
  const db = drizzle(pool, { schema })
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', 'org-voltvast', true)`)
    const ids = async () => ((await tx.execute(sql`select code, id from activity_rules where scope = 'organisatie' order by code`)).rows as { code: string; id: string }[])
    const voor = await ids()
    await zetStartersetTerug(tx as any, 'org-voltvast')
    const na = await ids()
    expect(na).toHaveLength(23)
    expect(na).toEqual(voor)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
})
