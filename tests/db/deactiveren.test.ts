// Deactiveren in plaats van verwijderen (0064) op databaseniveau: open taken, het hercontactritme, concepten en de
// plek in een campagne stoppen met de reden erbij; de motor en de belblokvuller slaan het account over; de historie
// blijft; heractiveren zet campagne en ritme terug. Rechten: eigenaar en beheerder wel, een collega niet. Elke test
// rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const d = await import('../../server/utils/deactiveren')
const m = await import('../../server/utils/motor')
const b = await import('../../server/utils/bellen')

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
const beheerder = { id: 'u-06', rol: 'beheerder' }
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]

/** Een open beltaak, een lopend ritme en een plek in een actieve campagne op het testaccount. */
async function zetKlaar(tx: any) {
  await tx.execute(sql`update accounts set owner_id = 'u-01', gedeactiveerd_op = null, data = jsonb_set(data - 'gedeactivering', '{reis,ritme}', '{"actief": true, "stap": 2, "ritmeId": "x"}'::jsonb, true) where id = ${ACC}`)
  await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status) values ('t-deact', ${ORG}, 'u-01', ${ACC}, 'bellen', 'Bellen: test', 'open')`)
  await tx.execute(sql`insert into campagnes (id, organisation_id, naam, soort, status) values ('c-deact', ${ORG}, 'Testcampagne', 'koud-bellen', 'actief')`)
  await tx.execute(sql`insert into campagne_items (organisation_id, campagne_id, account_id, kolom) values (${ORG}, 'c-deact', ${ACC}, 'benaderd')`)
}

describe('deactiveren', () => {
  it('stopt taken, ritme en campagne met reden; schrijft tijdlijn en audit; historie blijft', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx)
      const r = await d.deactiveer(tx, ORG, eigenaar, ACC, { reden: 'dubbel', toelichting: 'Zelfde als een ander account' })
      expect(r.gestopt).toMatchObject({ ritme: true })
      expect(r.gestopt.taken).toBeGreaterThanOrEqual(1)
      const a = await rij(tx, sql`select gedeactiveerd_op, data from accounts where id = ${ACC}`)
      expect(a.gedeactiveerd_op).not.toBeNull()
      expect(a.data.gedeactivering).toMatchObject({ door: 'u-01', reden: 'dubbel', toelichting: 'Zelfde als een ander account', ritmeWasActief: true })
      expect(a.data.reis.ritme.actief).toBe(false)
      const t = await rij(tx, sql`select status, data from tasks where id = 't-deact'`)
      expect(t.status).toBe('geannuleerd')
      expect(t.data.annuleerReden).toBe('Prospect gedeactiveerd: dubbel account (Zelfde als een ander account)')
      expect((await rij(tx, sql`select kolom, data from campagne_items where campagne_id = 'c-deact'`))).toMatchObject({ kolom: 'geparkeerd', data: { gedeactiveerd: { vorigeKolom: 'benaderd' } } })
      expect(await rij(tx, sql`select soort, door from activiteiten where account_id = ${ACC} and soort = 'gedeactiveerd'`)).toEqual({ soort: 'gedeactiveerd', door: 'u-01' })
      expect(await rij(tx, sql`select action, actor_id from audit_events where resource_id = ${ACC} and action = 'account.deactiveren'`)).toEqual({ action: 'account.deactiveren', actor_id: 'u-01' })
      // Nogmaals deactiveren kan niet.
      await expect(d.deactiveer(tx, ORG, eigenaar, ACC, { reden: 'failliet' })).rejects.toMatchObject({ statusCode: 409 })
      // Niets is verwijderd: de taak en eerdere activiteiten staan er nog.
      expect((await rij(tx, sql`select count(*)::int as n from tasks where account_id = ${ACC}`)).n).toBeGreaterThanOrEqual(1)
    })
  })

  it('de motor en de belblokvuller slaan het account over', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx)
      const voor = await m.laadMotorInvoer(tx, ORG, new Date())
      expect(voor.invoer.accounts.some((a) => a.id === ACC)).toBe(true)
      expect((await b.laadBelKandidaten(tx, 'u-01')).some((k) => k.accountId === ACC)).toBe(true)
      await d.deactiveer(tx, ORG, eigenaar, ACC, { reden: 'failliet' })
      const na = await m.laadMotorInvoer(tx, ORG, new Date())
      expect(na.invoer.accounts.some((a) => a.id === ACC)).toBe(false)
      expect((await b.laadBelKandidaten(tx, 'u-01')).some((k) => k.accountId === ACC)).toBe(false)
      const run = await m.draaiMotor(tx, ORG, { soort: 'gebeurtenis', accountIds: [ACC] })
      expect(run.taken).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from tasks where account_id = ${ACC} and status in ('open', 'bezig')`)).n).toBe(0)
    })
  })

  it('heractiveren zet campagne en ritme terug en bewaart de ronde', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx)
      await d.deactiveer(tx, ORG, eigenaar, ACC, { reden: 'geen-interesse' })
      await d.heractiveer(tx, ORG, beheerder, ACC)
      const a = await rij(tx, sql`select gedeactiveerd_op, data from accounts where id = ${ACC}`)
      expect(a.gedeactiveerd_op).toBeNull()
      expect(a.data.gedeactivering).toBeUndefined()
      expect(a.data.deactiveringen.at(-1)).toMatchObject({ reden: 'geen-interesse', door: 'u-01', heractiveerdDoor: 'u-06' })
      expect(a.data.reis.ritme.actief).toBe(true)
      expect((await rij(tx, sql`select kolom from campagne_items where campagne_id = 'c-deact'`)).kolom).toBe('benaderd')
      expect(await rij(tx, sql`select soort from activiteiten where account_id = ${ACC} and soort = 'geheractiveerd'`)).toEqual({ soort: 'geheractiveerd' })
      expect(await rij(tx, sql`select actor_id from audit_events where resource_id = ${ACC} and action = 'account.heractiveren'`)).toEqual({ actor_id: 'u-06' })
      await expect(d.heractiveer(tx, ORG, beheerder, ACC)).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  it('een collega die geen eigenaar is mag het niet; de beheerder wel', async () => {
    await inOrg(ORG, async (tx) => {
      await zetKlaar(tx)
      await expect(d.deactiveer(tx, ORG, collega, ACC, { reden: 'dubbel' })).rejects.toMatchObject({ statusCode: 403 })
      await d.deactiveer(tx, ORG, beheerder, ACC, { reden: 'buiten-doelgroep' })
      await expect(d.heractiveer(tx, ORG, collega, ACC)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  it('een andere organisatie ziet of wijzigt de vlag niet (RLS)', async () => {
    await inOrg('org-tweede', async (tx) => {
      expect((await rij(tx, sql`select count(*)::int as n from accounts where id = ${ACC}`)).n).toBe(0)
      expect((await tx.execute(sql`update accounts set gedeactiveerd_op = now() where id = ${ACC}`)).rowCount).toBe(0)
    })
  })
})
