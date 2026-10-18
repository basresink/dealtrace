// Functies per niveau voor de organisatie (Instellingen, Niveaus) op databaseniveau: alleen de beheerder
// wijzigt (403 voor salesmanager en accountmanager), elke wijziging en Terug naar de standaard schrijft een
// auditregel, de keuze staat in org_settings van de eigen organisatie (RLS: een andere organisatie ziet hem
// niet) en grenzen van pakket en Dealtrace blijven gelden. Elke test draait in een transactie die terugrolt.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import type { FunctieRegel, OrganisatieContext, Rol } from '../../shared/types'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string; data?: unknown }) => Object.assign(new Error(o.statusMessage), o)
const { keuzesNaarStandaard, leesKeuzes, overzichtNu, zetFunctieKeuze } = await import('../../server/utils/functieKeuzes')

const ORG = 'org-voltvast'
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
const fout = async (f: () => Promise<unknown>) => { try { await f(); return null } catch (e: any) { return e } }

async function ctxVoor(tx: any, rol: Rol, organisatie: Partial<OrganisatieContext> = {}) {
  const rijen = (await tx.execute(sql`select functie, niveau, aan, organisation_id from functies_per_niveau`)).rows as any[]
  const stand: FunctieRegel[] = rijen.map((r) => ({ functie: r.functie, niveau: r.niveau, aan: r.aan, organisationId: r.organisation_id }))
  return { gebruiker: { id: 'u-06', rol }, organisatie: { id: ORG, pakket: 'compleet', features: {}, iedereenAlles: false, ...organisatie } as OrganisatieContext, stand }
}
const audit = async (tx: any, actie: string) => (await tx.execute(sql`select action, resource_id, changes, actor_id from audit_events where organisation_id = ${ORG} and action = ${actie} order by occurred_at desc`)).rows as any[]

beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

describe('functies per niveau voor de organisatie', () => {
  it('de beheerder zet Signaalradar uit voor Expert: keuze bewaard, auditregel, overzicht klopt', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const ctx = await ctxVoor(tx, 'beheerder')
      const o = await zetFunctieKeuze(tx, ctx, { functie: 'nav.signaalradar', niveau: 'expert', aan: false })
      return { o, keuzes: await leesKeuzes(tx, ORG), audit: await audit(tx, 'instelling.functieUit'), nu: await overzichtNu(tx, ctx) }
    })
    expect(r.keuzes).toEqual({ 'nav.signaalradar': { expert: false } })
    expect(r.audit[0]).toMatchObject({ resource_id: 'nav.signaalradar|expert', actor_id: 'u-06', changes: { van: true, naar: false, standaard: true } })
    const f = r.nu.groepen.flatMap((g) => g.functies).find((x) => x.sleutel === 'nav.signaalradar')!
    expect(f.cellen.expert).toMatchObject({ aan: false, keuze: false })
    expect(r.o.keuzes).toBe(1)
  })

  it('terug naar de standaard haalt alle keuzes weg met één auditregel; zonder keuzes geen regel', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const ctx = await ctxVoor(tx, 'beheerder')
      await zetFunctieKeuze(tx, ctx, { functie: 'nav.signaalradar', niveau: 'expert', aan: false })
      await zetFunctieKeuze(tx, ctx, { functie: 'nav.signaalradar', niveau: 'beginner', aan: true })
      const terug = await keuzesNaarStandaard(tx, ctx)
      const nogmaals = await keuzesNaarStandaard(tx, ctx)
      return { terug, nogmaals, keuzes: await leesKeuzes(tx, ORG), audit: await audit(tx, 'instelling.functiesStandaard') }
    })
    expect(r.terug.aantal).toBe(2)
    expect(r.nogmaals.aantal).toBe(0)
    expect(r.keuzes).toEqual({})
    expect(r.audit).toHaveLength(1)
    expect(r.audit[0].changes.van).toEqual({ 'nav.signaalradar': { expert: false, beginner: true } })
  })

  it('terugzetten van één schakelaar naar de standaard bewaart geen keuze', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const ctx = await ctxVoor(tx, 'beheerder')
      await zetFunctieKeuze(tx, ctx, { functie: 'nav.signaalradar', niveau: 'expert', aan: false })
      await zetFunctieKeuze(tx, ctx, { functie: 'nav.signaalradar', niveau: 'expert', aan: true })
      return { keuzes: await leesKeuzes(tx, ORG), aan: await audit(tx, 'instelling.functieAan') }
    })
    expect(r.keuzes).toEqual({})
    expect(r.aan).toHaveLength(1)
  })

  it('salesmanager en accountmanager krijgen 403 en er verandert niets', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const sm = await fout(async () => zetFunctieKeuze(tx, await ctxVoor(tx, 'salesmanager'), { functie: 'nav.signaalradar', niveau: 'expert', aan: false }))
      const am = await fout(async () => keuzesNaarStandaard(tx, await ctxVoor(tx, 'accountmanager')))
      return { sm, am, keuzes: await leesKeuzes(tx, ORG) }
    })
    expect(r.sm?.statusCode).toBe(403)
    expect(r.am?.statusCode).toBe(403)
    expect(r.keuzes).toEqual({})
  })

  it('pakket, rol en Dealtrace blijven grenzen', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const pakket = await fout(async () => zetFunctieKeuze(tx, await ctxVoor(tx, 'beheerder', { pakket: 'starter' }), { functie: 'belscript.ai', niveau: 'expert', aan: true }))
      const rol = await fout(async () => zetFunctieKeuze(tx, await ctxVoor(tx, 'beheerder'), { functie: 'nav.team', niveau: 'beginner', aan: true }))
      const ctx = await ctxVoor(tx, 'beheerder')
      ctx.stand.push({ functie: 'nav.signaalradar', niveau: 'expert', aan: false, organisationId: ORG })
      const founder = await fout(() => zetFunctieKeuze(tx, ctx, { functie: 'nav.signaalradar', niveau: 'expert', aan: true }))
      return { pakket, rol, founder, keuzes: await leesKeuzes(tx, ORG) }
    })
    expect(r.rol?.statusCode).toBe(422)
    expect(r.founder?.statusCode).toBe(409)
    // belscript.ai zit pas in Plus.
    expect(r.pakket?.statusCode).toBe(422)
    expect(r.keuzes).toEqual({})
  })

  it('een andere organisatie ziet de keuze niet (RLS)', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await zetFunctieKeuze(tx, await ctxVoor(tx, 'beheerder'), { functie: 'nav.signaalradar', niveau: 'expert', aan: false })
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      const rijen = (await tx.execute(sql`select organisation_id from org_settings where key = 'functieKeuzes'`)).rows as any[]
      return { rijen, tweede: await leesKeuzes(tx, 'org-tweede') }
    })
    expect(r.rijen.every((x) => x.organisation_id === 'org-tweede')).toBe(true)
    expect(r.tweede).toEqual({})
  })
})
