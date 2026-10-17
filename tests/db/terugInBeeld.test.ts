// Terug in beeld op databaseniveau: starten maakt de taak (één taak), poging 1 met het ritme van de regel
// (opvolgreeks) of een beltaak aan een belblok; de afkoeling blokkeert starten; belblok alleen bij bellen; Later
// schuift nooit binnen de afkoeling; een accountmanager ziet alleen zijn eigen prospects en een andere
// organisatie ziet niets (RLS).
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { laadRijen, startHercontact, startVoorbeeld, zetLater } = await import('../../server/utils/terugInBeeld')
const { plusDagen, nlMoment } = await import('../../shared/datum')

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
const EVA = { id: 'u-07', rol: 'accountmanager', niveau: 'expert', werkplek: 'binnendienst' }
const nu = new Date()
const vandaag = nlMoment(nu).datum
const status = (e: any) => e?.statusCode

/** Een prospect op nee die over twee dagen terugkomt; de nee is lang genoeg geleden (afkoeling voorbij) of net gezet. */
async function klaarzetten(tx: any, id: string, opts: { neeOp?: string; terugOp?: string } = {}) {
  await tx.execute(sql`update accounts set terug_op = ${opts.terugOp ?? plusDagen(vandaag, 2)},
    data = jsonb_set(data, '{nee,op}', to_jsonb(${opts.neeOp ?? '2026-01-05T10:00:00.000Z'}::text)) where id = ${id}`)
}

describe('Terug in beeld', () => {
  it('één taak: terug in de reis, een taak uit de terugkomregel en de rij staat op gestart', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await klaarzetten(tx, 'eva-a12')
      const voor = (await laadRijen(tx, EVA, nu)).rijen.find((x) => x.id === 'eva-a12')
      const uit = await startHercontact(tx, ORG, EVA, 'eva-a12', 'taak', nu)
      const [taak] = (await tx.execute(sql`select owner_id, action_type, status, data from tasks where id = ${uit.taakId}`)).rows as any[]
      const [a] = (await tx.execute(sql`select nb_status, terug_op, data->'terugInBeeld' as tib, data->'reis'->'ritme'->>'actief' as ritme from accounts where id = 'eva-a12'`)).rows as any[]
      const na = (await laadRijen(tx, EVA, nu)).rijen.find((x) => x.id === 'eva-a12')
      const audit = (await tx.execute(sql`select 1 from audit_events where action = 'terugInBeeld.start' and resource_id = 'eva-a12'`)).rows
      return { voor, uit, taak, a, na, audit }
    })
    expect(r.voor?.gestart).toBeNull()
    expect(r.taak).toMatchObject({ owner_id: 'u-07', action_type: 'bellen', status: 'open' })
    expect(r.taak.data.herkomst.bron).toBe('terugkomregel')
    expect(r.a.nb_status).toBe('in reis')
    expect(r.a.terug_op).toBeNull()
    expect(r.a.tib.gestart).toMatchObject({ soort: 'taak', taakId: r.uit.taakId })
    expect(r.a.ritme === null || r.a.ritme === 'false').toBe(true)
    expect(r.na?.gestart?.soort).toBe('taak')
    expect(r.audit).toHaveLength(1)
  })

  it('opvolgreeks: het hercontactritme van de regel loopt en poging 1 is een taak', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await klaarzetten(tx, 'pr-g25')
      const v = await startVoorbeeld(tx, EVA, 'pr-g25', nu)
      const uit = await startHercontact(tx, ORG, EVA, 'pr-g25', 'reeks', nu)
      const [taak] = (await tx.execute(sql`select title, data, onderwerp from tasks where id = ${uit.taakId}`)).rows as any[]
      const [a] = (await tx.execute(sql`select data->'reis'->'ritme' as ritme from accounts where id = 'pr-g25'`)).rows as any[]
      return { v, uit, taak, a }
    })
    expect(r.v.mag.mag).toBe(true)
    expect(r.v.reeks?.stappen.length).toBeGreaterThan(0)
    expect(r.taak.title).toMatch(/^Poging 1: /)
    expect(r.taak.data.poging).toMatchObject({ n: 1, van: r.v.reeks!.stappen.length })
    expect(r.taak.onderwerp).toBe('pr-g25:poging-1')
    expect(r.a.ritme).toMatchObject({ actief: true, stap: 1, ritmeId: r.v.reeks!.ritmeId })
    expect(r.uit.ritmeNaam).toBe(r.v.reeks!.naam)
  })

  it('belblok: een beltaak aan het eerstvolgende koude blok, met een sessie', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await klaarzetten(tx, 'pr-g35')
      const v = await startVoorbeeld(tx, EVA, 'pr-g35', nu)
      const uit = await startHercontact(tx, ORG, EVA, 'pr-g35', 'belblok', nu)
      const [taak] = (await tx.execute(sql`select t.action_type, t.belblok_id, s.gebruiker_id, s.start_op from tasks t join belblok_sessies s on s.id = t.belblok_id where t.id = ${uit.taakId}`)).rows as any[]
      return { v, uit, taak }
    })
    expect(r.v.belblok.mag).toBe(true)
    expect(r.taak).toMatchObject({ action_type: 'bellen', gebruiker_id: 'u-07' })
    expect(new Date(r.taak.start_op).toISOString()).toBe(r.v.belblok.start)
    expect(r.uit.blokLabel).toBe(r.v.belblok.label)
  })

  it('binnen de afkoeling kan starten niet (422); twee keer starten geeft 409', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await klaarzetten(tx, 'pr-g10', { neeOp: nu.toISOString() })
      const dicht = await startHercontact(tx, ORG, EVA, 'pr-g10', 'taak', nu).catch((e) => e)
      const v = await startVoorbeeld(tx, EVA, 'pr-g10', nu)
      const [taken] = (await tx.execute(sql`select count(*)::int as n from tasks where account_id = 'pr-g10' and data->'herkomst'->>'bron' = 'terugkomregel'`)).rows as any[]
      await klaarzetten(tx, 'eva-p31')
      await startHercontact(tx, ORG, EVA, 'eva-p31', 'taak', nu)
      const dubbel = await startHercontact(tx, ORG, EVA, 'eva-p31', 'taak', nu).catch((e) => e)
      return { dicht, v, taken, dubbel }
    })
    expect(status(r.dicht)).toBe(422)
    expect(r.dicht.message).toMatch(/^Mag vanaf .+ de afkoeling voor bellen loopt nog\.$/)
    expect(r.v.mag.mag).toBe(false)
    expect(r.taken.n).toBe(0)
    expect(status(r.dubbel)).toBe(409)
  })

  it('belblok kan alleen bij bellen (422 bij mail)', async () => {
    const U3 = { id: 'u-03', rol: 'accountmanager', niveau: 'gevorderd', werkplek: 'binnendienst' }
    const r = await inOrg(ORG, async (tx) => {
      await klaarzetten(tx, 'pr-g33')
      const v = await startVoorbeeld(tx, U3, 'pr-g33', nu)
      const e = await startHercontact(tx, ORG, U3, 'pr-g33', 'belblok', nu).catch((x) => x)
      return { v, e }
    })
    expect(r.v.rij.kanaal).toBe('mail')
    expect(r.v.belblok).toEqual({ mag: false, reden: 'Kan niet: de regel zegt mail, geen bellen.' })
    expect(status(r.e)).toBe(422)
  })

  it('Later schuift nooit binnen de afkoeling; met de hand aangepast', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await klaarzetten(tx, 'eva-p45', { neeOp: nu.toISOString(), terugOp: plusDagen(vandaag, 120) })
      const uit = await zetLater(tx, EVA, 'eva-p45', { datum: plusDagen(vandaag, 10), reden: 'Test' }, nu)
      const rij = (await laadRijen(tx, EVA, nu)).rijen.find((x) => x.id === 'eva-p45')
      const zonder = await zetLater(tx, EVA, 'eva-p45', { datum: plusDagen(vandaag, 200) }, nu).catch((e) => e)
      return { uit, rij, zonder }
    })
    expect(r.uit.terugOp).toBe(r.rij!.afkoelEind)
    expect(r.rij!.terugOp).toBe(r.rij!.afkoelEind)
    expect(r.rij!.hand).toBe(true)
    expect(status(r.zonder)).toBe(422)
  })

  it('alleen eigen prospects; de salesmanager ziet zijn team; een andere organisatie ziet niets', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const eva = (await laadRijen(tx, EVA, nu)).rijen
      const u1 = (await laadRijen(tx, { id: 'u-01', rol: 'accountmanager' }, nu)).rijen
      const vreemd = await startHercontact(tx, ORG, { id: 'u-01', rol: 'accountmanager' }, 'pr-g25', 'taak', nu).catch((e) => e)
      const beheer = (await laadRijen(tx, { id: 'u-06', rol: 'beheerder' }, nu)).rijen
      return { eva, u1, vreemd, beheer }
    })
    expect(r.eva.length).toBeGreaterThan(0)
    expect(r.eva.every((x) => x.eigenaar.id === 'u-07')).toBe(true)
    expect(r.u1.some((x) => x.eigenaar.id === 'u-07')).toBe(false)
    expect(status(r.vreemd)).toBe(403)
    expect(r.beheer.length).toBeGreaterThanOrEqual(r.eva.length)
    const ander = await inOrg('org-tweede', async (tx) => ({
      rijen: (await laadRijen(tx, { id: 'u-t1', rol: 'beheerder' }, nu)).rijen,
      start: await startHercontact(tx, 'org-tweede', { id: 'u-t1', rol: 'beheerder' }, 'pr-g25', 'taak', nu).catch((e) => e),
    }))
    expect(ander.rijen.some((x) => x.id.startsWith('pr-') || x.id.startsWith('eva-'))).toBe(false)
    expect(status(ander.start)).toBe(404)
  })
})
