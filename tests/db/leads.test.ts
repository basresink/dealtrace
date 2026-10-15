// P11 op databaseniveau: RLS op leads, rondes, koppelingen en verbruik; geheimen versleuteld;
// een ronde met KvK en AI-zoeker in vijf groepen; 24 uur bewaard zonder kosten; de daggrens;
// overnemen met klasse in accounts.klasse en eerste taak; afwijzen komt niet terug; een
// verzonnen URL in een mock-antwoord valt weg.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { DAGGRENS_TEKST } from '../../shared/leadGenerator'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string; data?: unknown }) => Object.assign(new Error(o.statusMessage), o)
const { draaiRonde, leadsVoorScherm, neemOver, wijsAf, maakDossier, verrijkViaKvk } = await import('../../server/utils/leads')
const { MOCK_FIXTURES } = await import('../../server/utils/llm-provider')
const { ontsleutel } = await import('../../server/utils/geheimen')

let app: pg.Client
let beheer: pg.Client
let pool: pg.Pool
class Terug extends Error {}
async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
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
const ORG = { id: 'org-voltvast', pakket: 'compleet' as const }
const U01 = { id: 'u-01', rol: 'accountmanager', niveau: 'gevorderd', werkplek: 'buitendienst', data: {} }
const U03 = { id: 'u-03', rol: 'accountmanager', niveau: 'gevorderd', werkplek: 'binnendienst', data: {} }
const Z = { brancheId: 'br-01', klassen: ['B', 'C'], aanleiding: 'werft servicemonteurs', werkgebied: { straal: { lat: 53.22, lng: 6.57, km: 120 }, postcodes: [] } }

beforeAll(async () => {
  app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect()
  beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect()
  pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 })
})
afterAll(async () => { await app.end(); await beheer.end(); await pool.end() })

describe('RLS en geheimen', () => {
  it('leads, rondes, koppelingen en verbruik van A zijn onzichtbaar voor B', async () => {
    await beheer.query(`insert into lead_rondes (id, organisation_id, gebruiker_id, zoekopdracht, hash, bronnen) values ('r-test', 'org-voltvast', 'u-01', '{}', 'h', '{kvk}') on conflict do nothing`)
    await beheer.query(`insert into leads (organisation_id, naam, bron, ronde_id) values ('org-voltvast', 'Testlead', 'kvk', 'r-test')`)
    await beheer.query(`insert into lead_verbruik (organisation_id, maand, soort, aantal) values ('org-voltvast', '2026-01', 'kvk', 1) on conflict do nothing`)
    const n = await alsOrg('org-tweede', async () => (await app.query(`select (select count(*) from leads)::int a, (select count(*) from lead_rondes)::int b, (select count(*) from koppelingen)::int c, (select count(*) from lead_verbruik)::int d`)).rows[0])
    expect(n).toEqual({ a: 0, b: 0, c: 0, d: 0 })
    await expect(alsOrg('org-tweede', () => app.query(`insert into leads (organisation_id, naam, bron) values ('org-voltvast', 'x', 'kvk')`))).rejects.toThrow(/row-level security/)
  })
  it('de KvK-sleutel staat versleuteld in de database', async () => {
    const r = (await beheer.query(`select geheimen from koppelingen where organisation_id = 'org-voltvast' and soort = 'kvk'`)).rows[0]
    expect(r.geheimen).toMatch(/^v1\./)
    expect(r.geheimen).not.toContain('kvk-mock')
    expect(ontsleutel(r.geheimen)).toEqual({ sleutel: 'kvk-mock-voltvast-sleutel' })
  })
})

describe('ronde (acceptatie 1, 2, 3, 11, 13, 19)', () => {
  it('KvK en AI-zoeker leveren leads in de groepen; met KvK-nummer van een account of uit DealDrive in "Al in je bestand"', async () => {
    const r = await inVoltvast(async (tx) => {
      const ronde = await draaiRonde(tx, ORG, U01, Z, ['kvk', 'ai'])
      const z = (await tx.execute(sql`select zoekopdracht from lead_rondes where id = ${ronde.rondeId}`)).rows[0].zoekopdracht
      const rijen = await tx.select().from(schema.leads).where(sql`ronde_id = ${ronde.rondeId}`)
      const leads = await leadsVoorScherm(tx, rijen, z)
      const credits = (await tx.execute(sql`select coalesce(sum((kosten->>'credits')::int), 0)::int n from agent_runs where handeling = 'ai:zoekronde'`)).rows[0].n
      const nogmaals = await draaiRonde(tx, ORG, U01, { ...Z, klassen: ['C', 'B'] }, ['ai', 'kvk'])
      const credits2 = (await tx.execute(sql`select coalesce(sum((kosten->>'credits')::int), 0)::int n from agent_runs where handeling = 'ai:zoekronde'`)).rows[0].n
      return { ronde, z, leads, credits, nogmaals, credits2 }
    })
    expect(r.ronde.bewaard).toBe(false)
    expect(r.ronde.aantal).toBeGreaterThan(10)
    expect(r.z.sbi).toEqual(['4321', '4322'])
    const groepen = new Set(r.leads.map((l) => l.groep))
    for (const g of ['passend', 'onbeoordeeld', 'valtAf', 'alBekend']) expect(groepen).toContain(g)
    const per = Object.fromEntries(r.leads.map((l) => [l.naam, l]))
    expect(per['Testinstallatie Koperwiek']!.alBekend).toMatchObject({ accountId: 'pr-01' })
    expect(per['Testbrontsma Installatietechniek']!.alBekend).toEqual({ dealdrive: { soort: 'prospect', eigenaar: 'eva.dijkstra@voltvast.test' } })
    expect(per['Installatiebedrijf Maaskant']!.bewijs.find((b) => b.criterium === 'werkgebied')!.oordeel).toBe('nee')
    expect(r.credits).toBe(20)
    expect(r.nogmaals).toMatchObject({ bewaard: true, credits: 0 })
    expect(r.credits2).toBe(20)
  })
  it('een lead met SBI 6820 krijgt vv_branche_id br-03', async () => {
    const r = await inVoltvast(async (tx) => {
      const ronde = await draaiRonde(tx, ORG, U01, { sbi: ['6820'] }, ['kvk'])
      return (await tx.execute(sql`select naam, data->>'vvBrancheId' as b from leads where ronde_id = ${ronde.rondeId}`)).rows
    })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x: any) => x.b === 'br-03')).toBe(true)
  })
  it('de elfde ronde op een dag geeft 429', async () => {
    const e = await inVoltvast(async (tx) => {
      for (let i = 0; i < 10; i++) await tx.execute(sql`insert into lead_rondes (organisation_id, gebruiker_id, zoekopdracht, hash, bronnen) values ('org-voltvast', 'u-03', '{}', ${`h${i}`}, '{kvk}')`)
      return draaiRonde(tx, ORG, U03, { sbi: ['4120'] }, ['kvk']).then(() => null, (x) => x)
    })
    expect(e).toMatchObject({ statusCode: 429, statusMessage: DAGGRENS_TEKST })
  })
  it('een verzonnen URL in het antwoord van de Zoeker wordt geweigerd', async () => {
    MOCK_FIXTURES.zoekronde = [{ bedrijven: [{ naam: 'Verzonnen BV', plaats: 'Zwolle', website: 'https://verzonnen.test', url: 'https://verzonnen.test', bronzin: 'Werft monteurs.' }] }]
    try {
      const r = await inVoltvast(async (tx) => {
        const ronde = await draaiRonde(tx, ORG, U01, { aanleiding: 'werft monteurs' }, ['ai'])
        return (await tx.execute(sql`select naam from leads where ronde_id = ${ronde.rondeId}`)).rows
      })
      expect(r.map((x: any) => x.naam)).not.toContain('Verzonnen BV')
    } finally { delete MOCK_FIXTURES.zoekronde }
  })
})

describe('overnemen, afwijzen en dossier (acceptatie 1, 4, 7, 9)', () => {
  it('Neem over maakt een prospect met klasse in accounts.klasse, contactpersonen, bewijs, fase Gevonden en eerste taak in het acquisitieblok', async () => {
    const r = await inVoltvast(async (tx) => {
      const ronde = await draaiRonde(tx, ORG, U03, Z, ['kvk', 'ai'])
      const [lead] = (await tx.execute(sql`select id from leads where ronde_id = ${ronde.rondeId} and naam = 'Teeuwen Bouw B.V.'`)).rows as { id: string }[]
      await maakDossier(tx, ORG, U03, lead!.id)
      const uit = await neemOver(tx, 'org-voltvast', U03, lead!.id, {})
      const a = (await tx.execute(sql`select klasse, kvk, nb_status, nb_bron, fase_id, vv_branche_id, data->'sbi' as sbi, (data->>'medewerkers')::int as mw from accounts where id = ${uit.id}`)).rows[0]
      const contacten = (await tx.execute(sql`select first_name, last_name, rol, data->>'telefoon' as tel from contacts where account_id = ${uit.id}`)).rows
      const notitie = (await tx.execute(sql`select data->>'tekst' as t from activiteiten where account_id = ${uit.id} and soort = 'notitie'`)).rows[0]
      const geschiedenis = (await tx.execute(sql`select gebeurtenis from reisgeschiedenis where account_id = ${uit.id}`)).rows
      const taak = (await tx.execute(sql`select action_type, belblok_id, data->'poging'->>'n' as n from tasks where id = ${uit.eersteTaak.taskId}`)).rows[0]
      const lead2 = (await tx.execute(sql`select status, account_id from leads where id = ${lead!.id}`)).rows[0]
      const nogmaals = await neemOver(tx, 'org-voltvast', U03, lead!.id, {}).then(() => null, (e) => e.statusCode)
      return { uit, a, contacten, notitie, geschiedenis, taak, lead2, nogmaals }
    })
    expect(r.a).toMatchObject({ klasse: 'kl-b-prospects', kvk: '91000001', nb_status: 'nieuw', nb_bron: 'leadgenerator', fase_id: 'gevonden', vv_branche_id: 'br-01', mw: 62 })
    expect(r.a.sbi).toEqual(['4321', '4120'])
    expect(r.contacten).toEqual([{ first_name: 'Peter', last_name: 'Kok', rol: 'beslisser', tel: '+31383000101' }])
    expect(r.notitie.t).toMatch(/Gevonden met de leadgenerator/)
    expect(r.geschiedenis).toEqual([{ gebeurtenis: 'lead-overgenomen' }])
    expect(r.taak).toMatchObject({ action_type: 'bellen', n: '1' })
    expect(r.taak.belblok_id).toBeTruthy()
    expect(r.uit.tekst).toMatch(/^Teeuwen Bouw B\.V\. staat nu bij je prospects, klasse B\. Eerste belpoging staat in je blok van \w+ 09:00\./)
    expect(r.lead2).toEqual({ status: 'overgenomen', account_id: r.uit.id })
    expect(r.nogmaals).toBe(409)
  })
  it('een klant als duplicaat geeft 422: nooit terug naar prospect', async () => {
    const s = await inVoltvast(async (tx) => {
      await tx.execute(sql`update accounts set account_kind = 'klant' where id = 'pr-01'`)
      const [l] = (await tx.execute(sql`insert into leads (organisation_id, naam, kvk, bron) values ('org-voltvast', 'Koperwiek', '99000101', 'kvk') returning id`)).rows as { id: string }[]
      return neemOver(tx, 'org-voltvast', U03, l!.id, {}).then(() => null, (e) => e.statusCode)
    })
    expect(s).toBe(422)
  })
  it('Niet relevant bewaart de reden; het bedrijf komt in de volgende ronde niet terug', async () => {
    const r = await inVoltvast(async (tx) => {
      const ronde = await draaiRonde(tx, ORG, U01, { sbi: ['4321'] }, ['kvk'])
      const [l] = (await tx.execute(sql`select id from leads where ronde_id = ${ronde.rondeId} and naam = 'Elektro Veluwe'`)).rows as { id: string }[]
      await wijsAf(tx, 'u-01', l!.id, 'Te klein')
      const reden = (await tx.execute(sql`select status, data->>'afwijsreden' as r from leads where id = ${l!.id}`)).rows[0]
      const volgende = await draaiRonde(tx, ORG, U01, { sbi: ['4321'], klassen: ['C'] }, ['kvk'])
      const namen = (await tx.execute(sql`select naam from leads where ronde_id = ${volgende.rondeId}`)).rows.map((x: any) => x.naam)
      return { reden, namen }
    })
    expect(r.reden).toEqual({ status: 'afgewezen', r: 'Te klein' })
    expect(r.namen).not.toContain('Elektro Veluwe')
    expect(r.namen.length).toBeGreaterThan(0)
  })
  it('verrijken na import via KvK zet SBI, medewerkers en klasse en telt de bevraging', async () => {
    const r = await inVoltvast(async (tx) => {
      await tx.execute(sql`insert into accounts (id, organisation_id, name, account_kind, owner_id, nb_status, kvk, nb_bron, data) values ('acc-imp', 'org-voltvast', 'Vonk', 'prospect', 'u-01', 'nieuw', '91000002', 'import', '{"herkomst": {}}')`)
      const voor = (await tx.execute(sql`select coalesce(sum(aantal), 0)::int n from lead_verbruik where soort = 'kvk'`)).rows[0].n
      const v = await verrijkViaKvk(tx, 'org-voltvast', 'compleet', ['acc-imp'])
      const a = (await tx.execute(sql`select klasse, city, data->'sbi' as sbi, (data->>'medewerkers')::int as mw, data->'herkomst'->'medewerkers'->>'bron' as bron from accounts where id = 'acc-imp'`)).rows[0]
      const na = (await tx.execute(sql`select coalesce(sum(aantal), 0)::int n from lead_verbruik where soort = 'kvk'`)).rows[0].n
      return { v, a, extra: na - voor }
    })
    expect(r.v).toEqual({ verrijkt: 1, gestopt: null })
    expect(r.a).toEqual({ klasse: 'kl-c-prospects', city: 'Groningen', sbi: ['4321'], mw: 34, bron: 'kvk' })
    expect(r.extra).toBeLessThanOrEqual(1)
  })
})
