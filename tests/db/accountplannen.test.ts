// Accountplannen op databaseniveau: het seedplan van Eva, maken en wijzigen, een actie wordt een taak op het
// account (met contact) die afvinken via rondAf afrondt, uit het plan halen annuleert de taak, verwijderen laat
// de taken staan, rechten (een collega wijzigt andermans plan niet; de salesmanager wel bij zijn team; eigenaar
// worden alleen wie je aanstuurt), een plan in één keer met contactpersonen, blokken, eigen velden en acties die
// taken worden, notities, de plannen per contact, de keuzes voor het formulier en RLS. Elke test rolt terug.
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
const manager = { id: 'u-04', rol: 'salesmanager' }
const beheerder = { id: 'u-06', rol: 'beheerder' }
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]

describe('accountplannen', () => {
  it('Eva heeft een actueel plan met drie acties, waarvan één klaar', async () => {
    await inOrg(ORG, async (tx) => {
      const l = await ap.accountplanLijst(tx)
      const p = l.plannen.find((x: any) => x.id === 'eva-plan-01')!
      expect(p).toMatchObject({ weergave: 'actueel', account: { id: 'eva-a07', soort: 'prospect' }, eigenaar: { id: 'u-07' }, acties: { totaal: 3, klaar: 1, percentage: 33 } })
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
      const t = await ap.voegPlanActieToe(tx, ORG, 'eva-plan-01', eva, { titel: 'Offerte bespreken met inkoop', datum: '2026-11-10', contactId: 'eva-a07-c1' })
      const taak = await rij(tx, sql`select account_id, contact_id, owner_id, status, accountplan_id, action_type from tasks where id = ${t.id}`)
      expect(taak).toEqual({ account_id: 'eva-a07', contact_id: 'eva-a07-c1', owner_id: 'u-07', status: 'open', accountplan_id: 'eva-plan-01', action_type: 'taak' })
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

  it('een plan in één keer: eigenaar, contactpersonen, blokken, eigen velden en acties die meteen een taak worden', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into eigen_velden (organisation_id, object, sleutel, naam, type, data) values (${ORG}, 'accountplan', 'budget', 'Budget', 'bedrag', '{}'::jsonb)`)
      const p = await ap.maakAccountplan(tx, ORG, eva, {
        accountId: 'eva-a09', titel: 'Accountplan 2027 Houten', geldigVan: '2027-01-01', geldigTot: '2027-12-31', contactIds: ['eva-a09-c1', 'eva-a09-c2'],
        secties: { klantinformatie: 'Vloerenbedrijf in Houten.', doelstellingen: 'Eerste project voor 1 juli.', kansen: 'Nieuwbouw', bedreigingen: 'Prijs', strategieen: 'Via de projectleider', evaluatie: '' },
        velden: { budget: '12500' },
        acties: [{ titel: 'Kennismaking plannen met Els', datum: '2027-01-12', contactId: 'eva-a09-c1' }, { titel: 'Offerte voorbereiden', datum: null, contactId: null }],
      })
      const d = await ap.accountplanDetail(tx, p.id, eva)
      expect(d.beslissers.map((b: any) => [b.id, b.rol])).toEqual([['eva-a09-c1', 'beslisser'], ['eva-a09-c2', 'champion']])
      expect(d.secties).toMatchObject({ klantinformatie: 'Vloerenbedrijf in Houten.', bedreigingen: 'Prijs', evaluatie: '' })
      expect(d.velden.find((v: any) => v.sleutel === 'budget').waarde).toBe(12500)
      expect(d.voortgang).toEqual({ totaal: 2, klaar: 0, percentage: 0 })
      const taken = (await tx.execute(sql`select title, owner_id, account_id, contact_id, status, action_type from tasks where accountplan_id = ${p.id} order by title`)).rows
      expect(taken).toEqual([
        { title: 'Kennismaking plannen met Els', owner_id: 'u-07', account_id: 'eva-a09', contact_id: 'eva-a09-c1', status: 'open', action_type: 'taak' },
        { title: 'Offerte voorbereiden', owner_id: 'u-07', account_id: 'eva-a09', contact_id: null, status: 'open', action_type: 'taak' },
      ])
      await expect(ap.maakAccountplan(tx, ORG, eva, { accountId: 'eva-a09', titel: 'Plan met onbekend veld', velden: { geheim: 'x' } })).rejects.toMatchObject({ statusCode: 422 })
      await expect(ap.maakAccountplan(tx, ORG, eva, { accountId: 'eva-a09', titel: 'Plan met vreemd contact', acties: [{ titel: 'Bellen met iemand', contactId: 'eva-a07-c1' }] })).rejects.toMatchObject({ statusCode: 422 })
      await expect(ap.maakAccountplan(tx, ORG, eva, { accountId: 'eva-a09', titel: 'Plan met een te korte actie', acties: [{ titel: 'x' }] })).rejects.toMatchObject({ statusCode: 422 })
      // De keuzes voor het formulier: de waarschuwing bij een tweede actueel plan en de contactpersonen met rol.
      const o = await ap.accountplanOpties(tx, eva, 'eva-a09')
      expect(o.waarschuwing).toContain('heeft al een actueel accountplan')
      expect(o.contacten.map((c: any) => c.id)).toEqual(expect.arrayContaining(['eva-a09-c1', 'eva-a09-c2']))
      expect(o.eigenaren.map((e: any) => e.id)).toEqual(['u-07'])
      expect(o.velden.map((v: any) => v.sleutel)).toContain('budget')
    })
  })

  it('eigenaar: jezelf, je team als salesmanager, iedereen als beheerder; de salesmanager wijzigt het plan van zijn team', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(ap.maakAccountplan(tx, ORG, eva, { accountId: 'eva-a09', titel: 'Plan voor een collega', eigenaarId: 'u-01' })).rejects.toMatchObject({ statusCode: 403 })
      const p = await ap.maakAccountplan(tx, ORG, manager, { accountId: 'eva-a09', titel: 'Plan voor Eva', eigenaarId: 'u-07', acties: [{ titel: 'Eerste gesprek plannen' }] })
      expect(p.ownerId).toBe('u-07')
      expect((await rij(tx, sql`select owner_id from tasks where accountplan_id = ${p.id}`)).owner_id).toBe('u-07')
      expect((await ap.eigenarenVoor(tx, manager)).map((e: any) => e.id)).toEqual(expect.arrayContaining(['u-04', 'u-07', 'u-01']))
      expect((await ap.accountplanDetail(tx, 'eva-plan-01', manager)).kan.bewerken).toBe(true)
      await ap.wijzigAccountplan(tx, ORG, 'eva-plan-01', manager, { secties: { evaluatie: 'Bijgesteld door de manager' } })
      await ap.wijzigAccountplan(tx, ORG, p.id, beheerder, { eigenaarId: 'u-01' })
      expect((await ap.accountplanDetail(tx, p.id, eva)).eigenaar.id).toBe('u-01')
      expect((await ap.accountplanDetail(tx, p.id, eva)).kan.bewerken).toBe(false)
      expect((await rij(tx, sql`select count(*)::int as n from audit_events where resource_id = ${p.id} and action = 'accountplan.eigenaar'`)).n).toBe(1)
    })
  })

  it('notities en de plannen per contact', async () => {
    await inOrg(ORG, async (tx) => {
      const n = await ap.voegNotitieToe(tx, ORG, 'eva-plan-01', eva, 'De directeur wil eerst een referentieproject zien.')
      await expect(ap.voegNotitieToe(tx, ORG, 'eva-plan-01', eva, '   ')).rejects.toMatchObject({ statusCode: 422 })
      await expect(ap.voegNotitieToe(tx, ORG, 'eva-plan-01', andere, 'Van een collega')).rejects.toMatchObject({ statusCode: 403 })
      const d = await ap.accountplanDetail(tx, 'eva-plan-01', eva)
      expect(d.notities[0]).toMatchObject({ id: n.id, tekst: 'De directeur wil eerst een referentieproject zien.', door: 'u-07', kanWeg: true })
      expect(d.notities[0].doorNaam).toContain('Eva')
      await expect(ap.verwijderNotitie(tx, 'eva-plan-01', n.id, andere)).rejects.toMatchObject({ statusCode: 403 })
      await ap.verwijderNotitie(tx, 'eva-plan-01', n.id, eva)
      expect((await ap.accountplanDetail(tx, 'eva-plan-01', eva)).notities).toHaveLength(0)
      // Corine staat als contactpersoon in het plan en heeft twee acties; een contact zonder plan heeft niets.
      const c = await ap.plannenVanContact(tx, 'eva-a07-c1')
      const plan = c.plannen.find((x: any) => x.id === 'eva-plan-01')!
      expect(plan).toMatchObject({ alsContactpersoon: true, account: { id: 'eva-a07' } })
      expect(plan.acties.map((a: any) => a.titel)).toEqual(expect.arrayContaining(['Kennismaking plannen met de directeur', 'Voorstel voor het eerste project sturen']))
      expect((await ap.plannenVanContact(tx, 'eva-a09-c2')).plannen.filter((x: any) => x.id === 'eva-plan-01')).toHaveLength(0)
      await expect(ap.plannenVanContact(tx, 'bestaat-niet')).rejects.toMatchObject({ statusCode: 404 })
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
