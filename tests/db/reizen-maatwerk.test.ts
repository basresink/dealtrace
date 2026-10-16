// P22 op databaseniveau: concept van de standaard, fase verwijderen met vervanging (regel 42), publiceren
// met validatie en fasemapping via het meldpunt, de droogloop gelijk aan wat de motor maakt, terugdraaien,
// Standaard terugzetten laat maatwerk ongemoeid, en RLS.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const e = await import('../../server/utils/reisEditor')
const { draaiMotor } = await import('../../server/utils/motor')

let pool: pg.Pool
class Terug extends Error {}
async function inOrg<T>(org: string, werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((x) => { if (!(x instanceof Terug)) throw x })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const ORG = 'org-voltvast'
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const eva = { id: 'u-07', rol: 'accountmanager', manager: false }
const joost = { id: 'u-04', rol: 'salesmanager', manager: true }
const nu = new Date('2026-10-14T08:00:00Z')
async function doelgroep(tx: any) {
  const [d] = await rijen(tx, sql`insert into doelgroepen (organisation_id, naam, status, prioriteit, data) values (${ORG}, 'Woningbouw', 'actief', 1, '{"brancheIds": ["br-01"]}'::jsonb) returning id`)
  return d.id as string
}
/** Een maatwerkconcept vanuit de standaard met een extra fase "Werkbezoek op project" die doodloopt. */
async function concept(tx: any) {
  const dg = await doelgroep(tx)
  const { id } = await e.maakConcept(tx, ORG, eva, { vanuit: 'standaard', naam: 'Installateurs woningbouw', doelgroepId: dg })
  const r = await e.laadReis(tx, id)
  const fases = [...r.data.fases, { id: 'werkbezoek', label: 'Werkbezoek op project', hoofdfase: 'verbinden', volgorde: 99, kleur: 'geel', accent: 'Laat het leverplan per bouwfase zien.', verwachtVerblijfDagen: 14 }]
  const overgangen = [...r.data.overgangen, { id: 'w1', vanFaseId: 'afspraak-gepland', gebeurtenis: 'afspraak-niet-verschenen', naarFaseId: 'werkbezoek', prioriteit: 5 }]
  await e.bewaarConcept(tx, ORG, eva, id, { data: { fases, overgangen } })
  return { id, dg }
}

describe('concept en validatie', () => {
  it('een doodlopende fase blokkeert publiceren met de fase bij naam; een Expert bewerkt geen actieve reis', async () => {
    await inOrg(ORG, async (tx) => {
      const { id } = await concept(tx)
      await expect(e.publiceer(tx, ORG, 'u-04', id)).rejects.toMatchObject({ statusCode: 422, statusMessage: 'Doodlopende fase: Werkbezoek op project' })
      await expect(e.bewaarConcept(tx, ORG, eva, `reis-standaard-${ORG}`, { naam: 'x' })).rejects.toMatchObject({ statusCode: 409 })
      await expect(e.bewaarConcept(tx, ORG, { id: 'u-01', rol: 'accountmanager', manager: false }, id, { naam: 'x' })).rejects.toMatchObject({ statusCode: 403 })
    })
  })
  it('fase verwijderen vraagt een vervangende fase; overgangen en startactiviteiten gaan mee (regel 42)', async () => {
    await inOrg(ORG, async (tx) => {
      const { id } = await concept(tx)
      await expect(e.verwijderFaseUitConcept(tx, eva, id, 'werkbezoek', '')).rejects.toMatchObject({ statusCode: 422 })
      await tx.execute(sql`insert into activiteitstemplates (organisation_id, reistemplate_id, fase_id, versie, data) values (${ORG}, ${id}, 'gekwalificeerd', 1, '{"faseId": "gekwalificeerd", "naam": "Extra", "rol": "alle", "actiesoort": "taak", "termijnWerkdagen": 1, "uitvoerder": "eigenaar"}'::jsonb)`)
      const n = await e.verwijderFaseUitConcept(tx, eva, id, 'gekwalificeerd', 'dossier-compleet')
      expect(n.activiteiten).toBeGreaterThan(0)
      expect(await e.kaleIds(tx, id)).toEqual([])
      const r = await e.laadReis(tx, id)
      expect(r.data.overgangen.some((x: any) => x.vanFaseId === 'gekwalificeerd' || x.naarFaseId === 'gekwalificeerd')).toBe(false)
    })
  })
})

describe('publiceren, mapping en terugdraaien', () => {
  it('publiceren zet de doelgroep om via het meldpunt; de droogloop klopt met wat de motor maakt', async () => {
    await inOrg(ORG, async (tx) => {
      const { id } = await concept(tx)
      await e.bewaarConcept(tx, ORG, eva, id, { data: { ...(await e.laadReis(tx, id)).data, overgangen: [...(await e.laadReis(tx, id)).data.overgangen, { id: 'w2', vanFaseId: 'werkbezoek', gebeurtenis: 'overgedragen', naarFaseId: 'overgedragen', prioriteit: 1 }, { id: 'w3', vanFaseId: 'werkbezoek', gebeurtenis: 'geen-vervolg', naarFaseId: 'verloren', prioriteit: 1 }] } })
      const droog = await e.droogloopVoor(tx, id)
      expect(droog.accounts).toBeGreaterThanOrEqual(30)
      const p = await e.publiceer(tx, ORG, 'u-04', id, {}, nu)
      expect(p.omgezet).toBe(droog.accounts)
      const r = await e.laadReis(tx, p.id)
      expect(r.status).toBe('actief')
      expect((await rij(tx, sql`select count(*)::int n from accounts where reis_id = ${p.id}`)).n).toBe(droog.accounts)
      expect((await rij(tx, sql`select count(*)::int n from reisgeschiedenis where reden = 'Nieuwe reisversie 1'`)).n).toBe(droog.accounts)
      expect((await rij(tx, sql`select count(*)::int n from reisversies where reis_id = ${p.id}`)).n).toBe(1)
      expect((await rij(tx, sql`select count(*)::int n from audit_events where action = 'reis.publiceren' and resource_id = ${p.id}`)).n).toBe(1)
      const ids = (await rijen(tx, sql`select id from accounts where reis_id = ${p.id}`)).map((x) => x.id)
      await draaiMotor(tx, ORG, { soort: 'gebeurtenis', accountIds: ids, nu })
      // Alleen de taken uit de omzetting tellen: hun onderwerp bevat het id van die reisgeschiedenis.
      const ev = (await rijen(tx, sql`select id from reisgeschiedenis where reden = 'Nieuwe reisversie 1'`)).map((x) => x.id as string)
      const start = (await rijen(tx, sql`select onderwerp from tasks where rule_id = 'start'`)).filter((t) => ev.some((x) => String(t.onderwerp).includes(x)))
      expect(start.length).toBe(droog.taken)
    })
  })
  it('een nieuwe versie zonder een fase met accounts vraagt een mapping en zet 100 procent om; daarna terugdraaien', async () => {
    await inOrg(ORG, async (tx) => {
      const { id } = await concept(tx)
      const r0 = await e.laadReis(tx, id)
      await e.bewaarConcept(tx, ORG, eva, id, { data: { ...r0.data, overgangen: [...r0.data.overgangen, { id: 'w2', vanFaseId: 'werkbezoek', gebeurtenis: 'overgedragen', naarFaseId: 'overgedragen', prioriteit: 1 }] } })
      const p1 = await e.publiceer(tx, ORG, 'u-04', id, {}, nu)
      // Concept van de actieve reis zonder de fase "nieuw"? Neem de fase waar de meeste accounts staan.
      const top = await rij(tx, sql`select fase_id, count(*)::int n from accounts where reis_id = ${p1.id} group by 1 order by 2 desc limit 1`)
      const c2 = await e.maakConcept(tx, ORG, joost, { vanuit: p1.id })
      const ander = (await e.laadReis(tx, c2.id)).data.fases.find((f: any) => f.id !== top.fase_id && !f.eind && !f.instap).id
      await e.verwijderFaseUitConcept(tx, joost, c2.id, top.fase_id, ander)
      const m = await e.mappingVoor(tx, c2.id)
      expect(m.rijen.find((x) => x.faseId === top.fase_id)?.aantal).toBe(top.n)
      const p2 = await e.publiceer(tx, ORG, 'u-04', c2.id, { [top.fase_id]: ander }, nu)
      expect(p2).toMatchObject({ id: p1.id, versie: 2 })
      expect(await e.kaleIds(tx, p1.id)).toEqual([])
      expect((await rij(tx, sql`select count(*)::int n from accounts where reis_id = ${p1.id} and fase_id = ${top.fase_id}`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int n from reistemplates where id = ${c2.id}`)).n).toBe(0)
      // Terugdraaien: versie 1 weer actief; de fase bestaat weer, er hoeft niemand om.
      const t = await e.terugdraaien(tx, ORG, 'u-04', p1.id, {}, nu)
      expect(t.versie).toBe(3)
      expect((await e.laadReis(tx, p1.id)).data.fases.some((f: any) => f.id === top.fase_id)).toBe(true)
    })
  })
  it('Standaard terugzetten laat maatwerkreizen ongemoeid', async () => {
    await inOrg(ORG, async (tx) => {
      const { id } = await concept(tx)
      const r = await e.laadReis(tx, id)
      await tx.execute(sql`update reistemplates set data = ${JSON.stringify(r.data)}::jsonb where is_standaard`)
      const voor = JSON.stringify((await e.laadReis(tx, id)).data)
      await tx.execute(sql`update reistemplates set data = ${JSON.stringify((await import('../../shared/reis')).standaardReisData())}::jsonb where is_standaard`)
      expect(JSON.stringify((await e.laadReis(tx, id)).data)).toBe(voor)
    })
  })
})

describe('RLS', () => {
  it('een reis en zijn versies van Voltvast zijn onzichtbaar voor Tweede', async () => {
    await inOrg(ORG, async (tx) => {
      const { id } = await concept(tx)
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect(await rijen(tx, sql`select 1 from reistemplates where id = ${id}`)).toEqual([])
      expect(await rijen(tx, sql`select 1 from reisversies`)).toEqual([])
    })
  })
})
