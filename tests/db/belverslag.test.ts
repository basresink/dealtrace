// Gespreksverslag na het afronden van een beltaak (migratie 0063): een nieuwe regel in activiteit_verslagen bij
// de vastgelegde belactiviteit; de log en de aanvullende tabel blijven alleen-toevoegen voor de app; de
// kaarttabbladen tonen verslag en transcript samen bij de belactiviteit; een andere organisatie ziet niets.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { rondAf } = await import('../../server/utils/taken')
const { verslagNaAfronden } = await import('../../server/utils/belverslag')
const { kaartTabbladen } = await import('../../server/utils/kaartTabbladen')

let pool: pg.Pool
class Terug extends Error {}
async function inOrg<T>(org: string, werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const ORG = 'org-voltvast'
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
/** De melding van Postgres achter de fout van Drizzle. */
const pgFout = async (p: Promise<unknown>) => { try { await p; return 'geen fout' } catch (e: any) { return String(e?.cause?.message ?? e?.message) } }

async function beltaak(tx: any, verslag: string | null) {
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, contact_id, action_type, title, status, priority, data)
    values (${id}, ${ORG}, 'u-07', 'eva-a08', 'eva-a08-c1', 'bellen', 'Testbeltaak verslag', 'open', 'middel', ${JSON.stringify(verslag ? { verslag: { tekst: verslag, bron: 'getypt' } } : {})}::jsonb)`)
  return id
}

describe('verslag na afronden bij de belactiviteit', () => {
  it('open taak: geen regel; na afronden een nieuwe regel bij de belactiviteit, de nieuwste geldt', async () => {
    await inOrg(ORG, async (tx) => {
      const id = await beltaak(tx, 'Verslag voor het afronden.')
      expect(await verslagNaAfronden(tx, id, { tekst: 'x', bron: 'getypt' }, 'u-07')).toBeNull()
      await rondAf(tx, id, { uitkomst: 'voicemail' } as any, 'u-07')
      const act = await rij(tx, sql`select id, data->>'verslag' as verslag from activiteiten where task_id = ${id}`)
      expect(act.verslag).toBe('Verslag voor het afronden.')
      expect(await verslagNaAfronden(tx, id, { tekst: 'Eerste aanvulling.', bron: 'getypt' }, 'u-07')).toBe(act.id)
      expect(await verslagNaAfronden(tx, id, { tekst: 'Teruggebeld, demo in maart.', bron: 'ingesproken' }, 'u-07')).toBe(act.id)
      expect((await rij(tx, sql`select count(*)::int n from activiteit_verslagen where activiteit_id = ${act.id}`)).n).toBe(2)
      // De log zelf is niet gewijzigd.
      expect((await rij(tx, sql`select data->>'verslag' as v from activiteiten where id = ${act.id}`)).v).toBe('Verslag voor het afronden.')

      await tx.execute(sql`insert into transcripten (organisation_id, record_soort, record_id, tekst, dienst) values (${ORG}, 'tasks', ${id}, 'Klant: demo in maart graag.', 'geplakt')`)
      for (const contactId of [null, 'eva-a08-c1']) {
        const t = await kaartTabbladen(tx, { account: { id: 'eva-a08', naam: 'Test', ids: ['eva-a08'] }, contactId, gebruikerId: 'u-07' })
        const v = t.verslagen.filter((x: any) => x.taskId === id)
        expect(v).toHaveLength(1)
        expect(v[0]).toMatchObject({ id: `bel-${act.id}`, bronLabel: 'Belactiviteit', titel: 'Testbeltaak verslag', tekst: 'Teruggebeld, demo in maart.', activiteitId: act.id, transcript: { tekst: 'Klant: demo in maart graag.' } })
        expect(t.momenten.find((m: any) => m.id === act.id)).toMatchObject({ verslag: 'Teruggebeld, demo in maart.', transcript: true, taskId: id })
      }
      // Wissen is ook een nieuwe regel: daarna geen verslag meer, wel het transcript.
      await verslagNaAfronden(tx, id, null, 'u-07')
      const t = await kaartTabbladen(tx, { account: { id: 'eva-a08', naam: 'Test', ids: ['eva-a08'] }, gebruikerId: 'u-07' })
      expect(t.verslagen.find((x: any) => x.taskId === id)).toMatchObject({ tekst: '', transcript: { tekst: 'Klant: demo in maart graag.' } })
    })
  })

  it('de app mag activiteit_verslagen niet wijzigen of verwijderen; een andere organisatie ziet de regels niet', async () => {
    const actId = await inOrg(ORG, async (tx) => {
      const id = await beltaak(tx, null)
      await rondAf(tx, id, { uitkomst: 'voicemail' } as any, 'u-07')
      const act = await rij(tx, sql`select id from activiteiten where task_id = ${id}`)
      await verslagNaAfronden(tx, id, { tekst: 'Geheim verslag.', bron: 'getypt' }, 'u-07')
      expect(await pgFout(tx.execute(sql`update activiteit_verslagen set tekst = 'anders' where activiteit_id = ${act.id}`))).toMatch(/permission denied/)
      return act.id as string
    })
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`select 1`)
      expect(await pgFout(tx.execute(sql`delete from activiteit_verslagen where activiteit_id = ${actId}`))).toMatch(/permission denied/)
    })
    await inOrg(ORG, async (tx) => {
      const id = await beltaak(tx, null)
      await rondAf(tx, id, { uitkomst: 'voicemail' } as any, 'u-07')
      await verslagNaAfronden(tx, id, { tekst: 'Alleen voor deze organisatie.', bron: 'getypt' }, 'u-07')
      expect((await rij(tx, sql`select count(*)::int n from activiteit_verslagen where task_id = ${id}`)).n).toBe(1)
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await rij(tx, sql`select count(*)::int n from activiteit_verslagen where task_id = ${id}`)).n).toBe(0)
      await expect(tx.execute(sql`insert into activiteit_verslagen (organisation_id, activiteit_id, tekst) values (${ORG}, 'x', 'y')`)).rejects.toThrow()
    })
  })
})
