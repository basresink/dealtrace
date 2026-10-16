// P20 op databaseniveau met de mock-adapter: lezen (klanten, koppelen op KvK, eigenaarsregel, hand wint,
// slapende klant met hc-04), geen dubbele records, "Al in je bestand", schrijven alleen met Schrijven of
// Beide (Neem over, uitkomsten één keer), 409 bij een lopende run, de bron CRM, de overdracht naar het
// CRM en de OAuth-state per organisatie (RLS).
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const crm = await import('../../server/utils/crm')
const { MOCK_CRM, mockGeheugen } = await import('../../server/utils/bronnen/crm/mock')
const { draaiRonde, leadsVoorScherm, neemOver } = await import('../../server/utils/leads')
const o = await import('../../server/utils/overdracht')

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
beforeEach(() => { MOCK_CRM.clear() })

const ORG = 'org-voltvast'
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const nu = new Date('2026-10-14T08:00:00Z')
const koppel = (tx: any, inst: object = {}) => tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (${ORG}, 'hubspot', 'actief', 'v1.x.y.z', ${JSON.stringify({ account: 'Testportaal (mock)', ...inst })}::jsonb)`)
const richting = (r: string) => ({ richting: { bedrijven: r, contacten: r, activiteiten: r }, schrijvenSinds: { bedrijven: '2026-01-01T00:00:00Z', contacten: '2026-01-01T00:00:00Z', activiteiten: '2026-10-01T00:00:00Z' } })
const U01 = { id: 'u-01', rol: 'accountmanager', niveau: 'expert', werkplek: 'binnendienst', data: {} }

describe('lezen', () => {
  it('klanten worden klant-accounts, hs-105 koppelt op KvK aan pr-01, hand wint met een verschil in het log, onbekende eigenaar in de lijst, slapende klant krijgt hc-04', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      await tx.execute(sql`update accounts set data = data || '{"telefoon": "+31570111111", "herkomst": {"telefoon": {"bron": "hand", "op": "2026-01-01"}}}'::jsonb where id = 'pr-01'`)
      const r = await crm.syncCrm(tx, ORG, { nu })
      expect(r).toMatchObject({ gelezen: 8, geschreven: 0, fouten: 0, klanten: 2, slapend: 1 })
      const warm = await rij(tx, sql`select id, account_kind, owner_id, nb_bron, data->'herkomst'->'naam'->>'bron' as bron from accounts where kvk = '99100101'`)
      expect(warm).toMatchObject({ account_kind: 'klant', owner_id: 'u-01', nb_bron: 'crm', bron: 'crm' })
      expect((await rij(tx, sql`select owner_id from accounts where kvk = '99100102'`)).owner_id).toBe('u-03')
      const pr01 = await rij(tx, sql`select data from accounts where id = 'pr-01'`)
      expect(pr01.data.extern.hubspot.id).toBe('hs-105')
      expect(pr01.data.telefoon).toBe('+31570111111')
      const run = await rij(tx, sql`select fouten from koppeling_runs where id = ${r.runId}`)
      expect(run.fouten.some((f: any) => f.soort === 'verschil' && f.veld === 'telefoon')).toBe(true)
      expect((await rij(tx, sql`select instellingen->'eigenaarsregel'->'onbekend' as o from koppelingen where soort = 'hubspot'`)).o).toEqual(['onbekend@voltvast.test'])
      const lb = await rij(tx, sql`select id, data->'herwin' as h from accounts where kvk = '99100102'`)
      expect(lb.h).toMatchObject({ regelId: 'hc-04', reden: '6 maanden niet besteld' })
      expect((await rij(tx, sql`select count(*)::int n from tasks where account_id = ${lb.id} and title like 'Herwinnen:%'`)).n).toBe(1)
      expect((await rij(tx, sql`select count(*)::int n from contacts where account_id = ${warm.id} and email = 'tessa@warmtewerk.test'`)).n).toBe(1)
      // Een tweede run maakt niets dubbel.
      const voor = await rij(tx, sql`select (select count(*) from accounts)::int a, (select count(*) from contacts)::int c, (select count(*) from tasks)::int t`)
      await crm.syncCrm(tx, ORG, { nu })
      expect(await rij(tx, sql`select (select count(*) from accounts)::int a, (select count(*) from contacts)::int c, (select count(*) from tasks)::int t`)).toEqual(voor)
    })
  })
  it('een lead met het KvK-nummer van een CRM-bedrijf staat in Al in je bestand; Neem over weigert hem', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      await crm.syncCrm(tx, ORG, { nu })
      const [l] = await rijen(tx, sql`insert into leads (organisation_id, naam, kvk, bron, gevonden_op, data) values (${ORG}, 'Firma Noordpool', '99100103', 'kvk', now(), '{}'::jsonb) returning *`)
      const [s] = await leadsVoorScherm(tx, [{ ...l, organisationId: l.organisation_id, accountId: null, bronRef: null, rondeId: null, gevondenDoor: null, gevondenOp: l.gevonden_op, dossierOp: null }] as any, {} as any)
      expect(s!.groep).toBe('alBekend')
      expect(s!.alBekend).toEqual({ crm: { naam: 'Testprospect Gasvast', soort: 'prospect', eigenaar: 'bram@voltvast.test' } })
      await expect(neemOver(tx, ORG, U01, l.id, {})).rejects.toMatchObject({ statusCode: 409 })
    })
  })
  it('een tweede gelijktijdige run geeft 409', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      const k = await rij(tx, sql`select id from koppelingen where soort = 'hubspot'`)
      await tx.execute(sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start) values (${ORG}, ${k.id}, 'hubspot', 'sync', now())`)
      await expect(crm.syncCrm(tx, ORG, { nu: new Date() })).rejects.toMatchObject({ statusCode: 409 })
    })
  })
  it('een verlopen token: status fout, melding in gewone taal voor de beheerder', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx, { mockVerlopen: true })
      const r = await crm.syncCrm(tx, ORG, { nu })
      expect(r.melding).toBe('De koppeling met HubSpot is verlopen. Verbind opnieuw om verder te synchroniseren.')
      expect((await rij(tx, sql`select status from koppelingen where soort = 'hubspot'`)).status).toBe('fout')
      expect((await rij(tx, sql`select count(*)::int n from notificaties where gebruiker_id = 'u-06' and titel = 'CRM-koppeling werkt niet'`)).n).toBe(1)
    })
  })
})

describe('schrijven', () => {
  it('met Lezen schrijft Neem over niets; met Beide één keer bedrijf en contacten, en een tweede run maakt geen dubbel', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      const lead = async (naam: string, kvk: string) => (await rijen(tx, sql`insert into leads (organisation_id, naam, kvk, bron, gevonden_op, data) values (${ORG}, ${naam}, ${kvk}, 'kvk', now(), ${JSON.stringify({ contacten: [{ naam: 'Petra Testlead', functie: 'Directeur', email: 'petra@lead.test', bron: 'kvk' }] })}::jsonb) returning id`))[0].id
      const n0 = mockGeheugen(ORG).bedrijven.length
      await neemOver(tx, ORG, U01, await lead('Testlead Een', '99200001'), {})
      expect(mockGeheugen(ORG).bedrijven.length).toBe(n0)
      await tx.execute(sql`update koppelingen set instellingen = instellingen || ${JSON.stringify(richting('beide'))}::jsonb where soort = 'hubspot'`)
      const p = await neemOver(tx, ORG, U01, await lead('Testlead Twee', '99200002'), {})
      expect(mockGeheugen(ORG).bedrijven.filter((b) => b.velden.name === 'Testlead Twee')).toHaveLength(1)
      expect(mockGeheugen(ORG).contacten.filter((c) => c.velden.lastname === 'Testlead')).toHaveLength(1)
      const extern = (await rij(tx, sql`select data->'extern'->'hubspot'->>'id' as id from accounts where id = ${p.id}`)).id
      expect(extern).toMatch(/^hs-/)
      await crm.syncCrm(tx, ORG, { nu })
      await crm.syncCrm(tx, ORG, { nu })
      expect(mockGeheugen(ORG).bedrijven.filter((b) => b.velden.name === 'Testlead Twee')).toHaveLength(1)
      expect((await rij(tx, sql`select count(*)::int n from accounts where name = 'Testlead Twee'`)).n).toBe(1)
    })
  })
  it('een afgeronde poging staat precies één keer als activiteit in het CRM', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      await crm.syncCrm(tx, ORG, { nu })
      await tx.execute(sql`update koppelingen set instellingen = instellingen || ${JSON.stringify(richting('beide'))}::jsonb where soort = 'hubspot'`)
      await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, kanaal, uitkomst, door, op, data) values (${ORG}, 'pr-01', 'gebeld', 'bellen', 'gesproken-afspraak', 'u-03', '2026-10-13T09:00:00Z', '{"tekst": "Afspraak gemaakt", "offline": true}'::jsonb)`)
      await crm.syncCrm(tx, ORG, { nu })
      await crm.syncCrm(tx, ORG, { nu })
      const act = mockGeheugen(ORG).activiteiten.filter((a) => a.bedrijfId === 'hs-105' && a.tekst === 'Afspraak gemaakt')
      expect(act).toHaveLength(1)
      expect(act[0]).toMatchObject({ onderwerp: 'Gebeld: gesproken-afspraak', uitkomst: 'gesproken-afspraak' })
    })
  })
})

describe('bron CRM in de leadgenerator', () => {
  it('prospects uit het CRM die nog geen account zijn, worden leads met bron crm', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      await crm.syncCrm(tx, ORG, { nu })
      const r = await draaiRonde(tx, { id: ORG, pakket: 'compleet' }, U01, { klassen: [], werkgebied: { postcodes: [] } } as any, ['crm'], { nu })
      expect(r.aantal).toBe(2)
      const l = await rijen(tx, sql`select naam, bron, bron_ref from leads where bron = 'crm' order by naam`)
      expect(l).toEqual([{ naam: 'Testprospect Gasvast', bron: 'crm', bron_ref: 'hs-103' }, { naam: 'Testprospect Kabelkracht', bron: 'crm', bron_ref: 'hs-104' }])
    })
  })
  it('zonder koppeling is de bron niet kiesbaar (400)', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(draaiRonde(tx, { id: ORG, pakket: 'compleet' }, U01, { klassen: [] } as any, ['crm'], { nu })).rejects.toMatchObject({ statusCode: 400 })
    })
  })
})

describe('overdracht naar het CRM', () => {
  const anouk = { id: 'u-01', naam: 'Testgebruiker Anouk Noorderveld', email: 'anouk@voltvast.test' }
  const stap = { omschrijving: 'Gratis projectschouw op locatie', datum: '2026-10-22', soort: 'bezoek' }
  it('met de schakelaar aan: precies één keer naar de mock, bevestigd met extern id, geen deal', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx, { overdracht: true })
      const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'crm', vervolgstap: stap })
      expect(await crm.verstuurCrmOverdracht(tx, r.id, nu)).toBe('bevestigd')
      expect(await crm.verstuurCrmOverdracht(tx, r.id, nu)).toBeNull()
      const ov = await rij(tx, sql`select status, extern_id from overdrachten where id = ${r.id}`)
      expect(ov.status).toBe('bevestigd')
      const act = mockGeheugen(ORG).activiteiten.filter((a) => a.overdracht)
      expect(act).toHaveLength(1)
      expect(act[0]!.id).toBe(ov.extern_id)
      expect(act[0]!.tekst).toContain('Vervolgstap: Gratis projectschouw op locatie')
    })
  })
  it('met de schakelaar uit is het CRM geen keuze', async () => {
    await inOrg(ORG, async (tx) => {
      await koppel(tx)
      expect((await o.voorbereiding(tx, 'pr-02', anouk)).keuzes.crm.kan).toBe(false)
      await expect(o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'crm', vervolgstap: stap })).rejects.toMatchObject({ statusCode: 422 })
    })
  })
})

describe('OAuth-state per organisatie', () => {
  it('een state van organisatie A is onzichtbaar voor B; een koppeling van A ook', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into koppeling_states (state, organisation_id, gebruiker_id, soort, verloopt_op) values ('s-a', ${ORG}, 'u-06', 'hubspot', now() + interval '10 minutes')`)
      await koppel(tx)
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect(await rijen(tx, sql`delete from koppeling_states where state = 's-a' returning state`)).toEqual([])
      expect(await rijen(tx, sql`select 1 from koppelingen where soort = 'hubspot'`)).toEqual([])
      expect(await rijen(tx, sql`select 1 from crm_records`)).toEqual([])
      await expect(tx.execute(sql`insert into koppeling_states (state, organisation_id, gebruiker_id, soort, verloopt_op) values ('s-b', ${ORG}, 'u-06', 'hubspot', now())`)).rejects.toThrow()
    })
  })
})
