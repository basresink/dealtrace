// BAND bewerken staat los van Kwalificeer: de eigenaar, zijn salesmanager en de beheerder vullen BAND in of werken
// het bij, ook voorbij status nieuw (zelf en via het AI-voorstel); een collega niet. Alleen bij status nieuw meldt
// minimaal 3 van 4 `gekwalificeerd`; daarna is bijwerken geen gebeurtenis in de reis. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const bv = await import('../../server/utils/bandVoorstel')

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
const ACC = 'pr-g01'
const eigenaar = { id: 'u-01', rol: 'accountmanager' }
const collega = { id: 'u-02', rol: 'accountmanager' }
const manager = { id: 'u-04', rol: 'salesmanager' }
const beheerder = { id: 'u-06', rol: 'beheerder' }
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const bron = { id: 't-band', soort: 'taak' as const, titel: 'Bel over de levering', datum: '2026-10-01T09:00:00.000Z' }

/** Het testaccount voorbij status nieuw (in reis, fase benaderd), zonder BAND, met een AI-voorstel voor draagvlak. */
async function zetKlaar(tx: any, status = 'in reis', fase = 'benaderd') {
  const bandAi = { op: '2026-10-01T10:00:00.000Z', door: 'u-01', verslagen: 1, voorstellen: { draagvlak: { ja: true, citaat: 'Ze hebben budget vrijgemaakt.', bron } } }
  await tx.execute(sql`select set_config('dealtrace.meldpunt', 'aan', true)`)
  await tx.execute(sql`update accounts set owner_id = 'u-01', nb_status = ${status}, fase_id = ${fase}, account_kind = 'prospect',
    data = (coalesce(data, '{}'::jsonb) - 'band' - 'bandVerworpen') || jsonb_build_object('bandAi', ${JSON.stringify(bandAi)}::jsonb) where id = ${ACC}`)
  await tx.execute(sql`select set_config('dealtrace.meldpunt', '', true)`)
}
const stand = (tx: any) => rij(tx, sql`select nb_status, fase_id, data->'band' as band,
  (select count(*)::int from reisgeschiedenis where account_id = ${ACC}) as geschiedenis,
  (select count(*)::int from activiteiten where account_id = ${ACC} and soort = 'reis') as reis from accounts where id = ${ACC}`)

describe('BAND bewerken', () => {
  it('eigenaar, zijn salesmanager en de beheerder wel, een collega niet (ook server-side)', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx)
      expect(await bv.magBandBewerken(tx, eigenaar, ACC)).toBe(true)
      expect(await bv.magBandBewerken(tx, manager, ACC)).toBe(true)
      expect(await bv.magBandBewerken(tx, beheerder, ACC)).toBe(true)
      expect(await bv.magBandBewerken(tx, collega, ACC)).toBe(false)
      await expect(bv.zetBandLetter(tx, collega, ACC, { letter: 'behoefte', ja: true })).rejects.toMatchObject({ statusCode: 403 })
      await expect(bv.besluitBandVoorstel(tx, ORG, collega, ACC, { letter: 'draagvlak', besluit: 'bevestig' })).rejects.toMatchObject({ statusCode: 403 })
      expect((await stand(tx)).band).toBeNull()
    })
  })

  it('voorbij status nieuw: zelf invullen en een AI-voorstel bevestigen zonder statuswissel of reisgebeurtenis', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx)
      const voor = await stand(tx)
      for (const letter of ['behoefte', 'autoriteit']) expect((await bv.zetBandLetter(tx, eigenaar, ACC, { letter, ja: true })).gemeld).toBeNull()
      // Derde letter via het AI-voorstel (3 van 4): geen `gekwalificeerd` meer.
      const r = await bv.besluitBandVoorstel(tx, ORG, eigenaar, ACC, { letter: 'draagvlak', besluit: 'bevestig', bronId: bron.id })
      expect(r.gemeld).toBeNull()
      expect(r.band.draagvlak).toMatchObject({ ja: true, herkomst: { id: bron.id, ai: true } })
      // Ook de salesmanager werkt bij.
      expect((await bv.zetBandLetter(tx, manager, ACC, { letter: 'noodzaak', ja: false })).gemeld).toBeNull()
      const na = await stand(tx)
      expect(na).toMatchObject({ nb_status: 'in reis', fase_id: 'benaderd', geschiedenis: voor.geschiedenis, reis: voor.reis })
      expect(Object.keys(na.band).sort()).toEqual(['autoriteit', 'behoefte', 'draagvlak', 'noodzaak'])
    })
  })

  it('bij status nieuw blijft 3 van 4 kwalificeren zoals nu', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx, 'nieuw', 'gevonden')
      const voor = await stand(tx)
      await bv.zetBandLetter(tx, eigenaar, ACC, { letter: 'behoefte', ja: true })
      await bv.zetBandLetter(tx, eigenaar, ACC, { letter: 'autoriteit', ja: true })
      const r = await bv.besluitBandVoorstel(tx, ORG, eigenaar, ACC, { letter: 'draagvlak', besluit: 'bevestig' })
      expect(r.gemeld).toMatchObject({ gewisseld: true })
      const na = await stand(tx)
      expect(na.nb_status).not.toBe('nieuw')
      expect(na.geschiedenis).toBeGreaterThan(voor.geschiedenis)
    })
  })
})
