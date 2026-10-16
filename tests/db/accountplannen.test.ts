// Accountplannen op databaseniveau: het seedplan van Eva, maken en wijzigen, een actie wordt een taak op het
// account (met contact) die afvinken via rondAf afrondt, uit het plan halen annuleert de taak, verwijderen laat
// de taken staan, rechten (een collega wijzigt andermans plan niet) en RLS. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const ap = await import('../../server/utils/accountplannen')

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
const eva = { id: 'u-07', rol: 'accountmanager' }
const andere = { id: 'u-01', rol: 'accountmanager' }
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]

describe('accountplannen', () => {
  it('Eva heeft een actueel plan met drie acties, waarvan één klaar', async () => {
    await inOrg(ORG, async (tx) => {
      const l = await ap.accountplanLijst(tx)
      const p = l.plannen.find((x: any) => x.id === 'eva-plan-01')!
      expect(p).toMatchObject({ weergave: 'actueel', account: { id: 'eva-k01', soort: 'klant' }, eigenaar: { id: 'u-07' }, acties: { totaal: 3, klaar: 1, percentage: 33 } })
      expect(l.actueel).toBeGreaterThanOrEqual(1)
      const d = await ap.accountplanDetail(tx, 'eva-plan-01', eva)
      expect(d.beslissers).toHaveLength(2)
      expect(d.kan.bewerken).toBe(true)
      expect(d.secties.doelstellingen.length).toBeGreaterThan(20)
    })
  })

  it('maken, wijzigen en afronden; een einddatum in het verleden is verlopen', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(ap.maakAccountplan(tx, ORG, eva, { accountId: 'eva-a09', titel: 'x' })).rejects.toMatchObject({ statusCode: 422 })
      await expect(ap.maakAccountplan(tx, ORG, eva, { accountId: 'bestaat-niet', titel: 'Plan 2027' })).rejects.toMatchObject({ statusCode: 422 })
      const p = await ap.maakAccountplan(tx, ORG, eva, { accountId: 'eva-a09', titel: 'Accountplan 2027', geldigVan: '2027-01-01', geldigTot: '2027-12-31' })
      expect(p).toMatchObject({ ownerId: 'u-07', status: 'actueel', geldigVan: '2027-01-01' })
      await ap.wijzigAccountplan(tx, ORG, p.id, eva, { secties: { kansen: 'Twee nieuwbouwprojecten', bedreigingen: '' } })
      expect((await ap.accountplanDetail(tx, p.id, eva)).secties.kansen).toBe('Twee nieuwbouwprojecten')
      await ap.wijzigAccountplan(tx, ORG, p.id, eva, { secties: { kansen: '' } })
      expect((await ap.accountplanDetail(tx, p.id, eva)).secties.kansen).toBe('')
      await expect(ap.wijzigAccountplan(tx, ORG, p.id, eva, { geldigTot: '2026-01-01' })).rejects.toMatchObject({ statusCode: 422 })
      await ap.wijzigAccountplan(tx, ORG, p.id, eva, { geldigVan: '2025-01-01', geldigTot: '2025-12-31' })
      expect((await ap.accountplanDetail(tx, p.id, eva)).weergave).toBe('verlopen')
      await ap.wijzigAccountplan(tx, ORG, p.id, eva, { status: 'afgerond' })
      expect((await ap.accountplanDetail(tx, p.id, eva)).weergave).toBe('afgerond')
      expect((await rij(tx, sql`select count(*)::int as n from audit_events where resource_id = ${p.id}`)).n).toBe(2)
    })
  })

  it('een actie is een taak op het account met contact; afvinken rondt af, uit het plan halen annuleert', async () => {
    await inOrg(ORG, async (tx) => {
      const t = await ap.voegPlanActieToe(tx, ORG, 'eva-plan-01', eva, { titel: 'Offerte bespreken met inkoop', datum: '2026-11-10', contactId: 'eva-k01-c1' })
      const taak = await rij(tx, sql`select account_id, contact_id, owner_id, status, accountplan_id, action_type from tasks where id = ${t.id}`)
      expect(taak).toEqual({ account_id: 'eva-k01', contact_id: 'eva-k01-c1', owner_id: 'u-07', status: 'open', accountplan_id: 'eva-plan-01', action_type: 'taak' })
      await expect(ap.voegPlanActieToe(tx, ORG, 'eva-plan-01', eva, { titel: 'Contact van een ander account', contactId: 'eva-a09-c1' })).rejects.toMatchObject({ statusCode: 422 })
      await ap.zetPlanActie(tx, 'eva-plan-01', t.id, eva, true)
      expect((await rij(tx, sql`select status from tasks where id = ${t.id}`)).status).toBe('klaar')
      expect((await rij(tx, sql`select count(*)::int as n from activiteiten where task_id = ${t.id}`)).n).toBe(1)
      expect((await ap.accountplanDetail(tx, 'eva-plan-01', eva)).voortgang).toEqual({ totaal: 4, klaar: 2, percentage: 50 })
      await ap.zetPlanActie(tx, 'eva-plan-01', t.id, eva, false)
      expect((await rij(tx, sql`select status from tasks where id = ${t.id}`)).status).toBe('open')
      await ap.haalPlanActieWeg(tx, 'eva-plan-01', t.id, eva)
      expect((await rij(tx, sql`select status from tasks where id = ${t.id}`)).status).toBe('geannuleerd')
      expect((await ap.accountplanDetail(tx, 'eva-plan-01', eva)).voortgang.totaal).toBe(3)
    })
  })

  it('een collega wijzigt andermans plan niet; verwijderen laat de taken als taak staan', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await ap.accountplanDetail(tx, 'eva-plan-01', andere)).kan.bewerken).toBe(false)
      await expect(ap.wijzigAccountplan(tx, ORG, 'eva-plan-01', andere, { titel: 'Overgenomen plan' })).rejects.toMatchObject({ statusCode: 403 })
      await expect(ap.voegPlanActieToe(tx, ORG, 'eva-plan-01', andere, { titel: 'Stiekeme actie' })).rejects.toMatchObject({ statusCode: 403 })
      await expect(ap.verwijderAccountplan(tx, ORG, 'eva-plan-01', andere)).rejects.toMatchObject({ statusCode: 403 })
      await ap.verwijderAccountplan(tx, ORG, 'eva-plan-01', eva)
      expect((await rij(tx, sql`select count(*)::int as n from accountplannen where id = 'eva-plan-01'`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from tasks where id like 'eva-tplan-%' and accountplan_id is null`)).n).toBe(3)
    })
  })

  it('RLS: een andere organisatie ziet de plannen van Voltvast niet en kan er geen maken', async () => {
    await inOrg('org-tweede', async (tx) => {
      expect((await rij(tx, sql`select count(*)::int as n from accountplannen`)).n).toBe(0)
      expect((await ap.accountplanLijst(tx)).plannen).toEqual([])
      await expect(ap.accountplanDetail(tx, 'eva-plan-01', eva)).rejects.toMatchObject({ statusCode: 404 })
      await expect(tx.execute(sql`insert into accountplannen (organisation_id, account_id, titel) values ('org-voltvast', 'eva-k01', 'Inbraak')`)).rejects.toThrow()
    })
  })
})
