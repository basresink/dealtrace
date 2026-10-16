// Kennisbank op databaseniveau: uploaden met koppeling aan account en contact, zoeken op naam, inhoud en
// klant, filteren op type en eigen uploads met tellers, het tabblad Documenten van account- en contactkaart,
// de tekst van een verhuisd document bij het eerste openen, verwijderen (eigenaar en beheerder), de foutcodes,
// de verhuizing uit bijlagen en RLS (een andere organisatie ziet niets en kan niets koppelen). Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const kb = await import('../../server/utils/kennisbank')

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
const anouk = { id: 'u-01', rol: 'accountmanager' as const }
const bram = { id: 'u-02', rol: 'accountmanager' as const }
const mira = { id: 'u-06', rol: 'beheerder' as const }
const b64 = (t: string) => Buffer.from(t).toString('base64')
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]

async function contactVan(tx: any, accountId: string) {
  return (await rij(tx, sql`select id, first_name, last_name from contacts where account_id = ${accountId} order by id limit 1`)) as { id: string; first_name: string; last_name: string }
}

describe('kennisbank', () => {
  it('uploaden met koppeling; zoeken op naam, inhoud en klant; type, eigen en tellers', async () => {
    await inOrg(ORG, async (tx) => {
      const c = await contactVan(tx, 'pr-06')
      const case1 = await kb.maakDocument(tx, ORG, anouk, { naam: 'Case warmtepomp Testdorp.md', mime: '', data: b64('# Case\n\nDe storingen daalden met veertig procent na de overstap.'), accountIds: ['pr-06'] })
      expect(case1).toMatchObject({ type: 'case', versie: '1', tekstStatus: 'gelezen' })
      const offerte = await kb.maakDocument(tx, ORG, bram, { naam: 'Voorstel onderhoud.pdf', mime: 'application/pdf', data: b64('%PDF-1.4 test'), type: 'offerte', versie: 'v3', contactIds: [c.id] })
      expect(offerte).toMatchObject({ type: 'offerte', versie: '3', tekstStatus: 'niet-gelezen' })

      const alles = await kb.kennisbankLijst(tx, anouk)
      expect(alles.documenten.map((d: any) => d.id)).toEqual(expect.arrayContaining([case1.id, offerte.id]))
      expect(alles.tellers.case).toBeGreaterThanOrEqual(1)
      // Zoeken in de inhoud en op de naam van het gekoppelde account.
      expect((await kb.kennisbankLijst(tx, anouk, { zoek: 'veertig procent' })).documenten.map((d: any) => d.id)).toEqual([case1.id])
      const opKlant = await kb.kennisbankLijst(tx, anouk, { zoek: 'Gevelpunt' })
      expect(opKlant.documenten.map((d: any) => d.id)).toEqual(expect.arrayContaining([case1.id, offerte.id]))
      expect((await kb.kennisbankLijst(tx, anouk, { zoek: `${c.first_name} ${c.last_name}` })).documenten.map((d: any) => d.id)).toContain(offerte.id)
      // Eén teken zoekt niet.
      expect((await kb.kennisbankLijst(tx, anouk, { zoek: 'v' })).totaal).toBe(alles.totaal)
      // Type: de tellers houden de andere filters, de lijst alleen dat type.
      const offertes = await kb.kennisbankLijst(tx, anouk, { type: 'offerte', zoek: 'Gevelpunt' })
      expect(offertes.documenten.map((d: any) => d.id)).toEqual([offerte.id])
      expect(offertes.tellers.case).toBe(1)
      expect(offertes.totaal).toBe(1)
      expect((await kb.kennisbankLijst(tx, anouk, { eigen: true, zoek: 'Gevelpunt' })).documenten.map((d: any) => d.id)).toEqual([case1.id])
      expect((await kb.kennisbankLijst(tx, anouk, { koppeling: 'zonder', zoek: 'Gevelpunt' })).totaal).toBe(0)

      // Het contact koppelt ook zijn account.
      const d = await kb.documentDetail(tx, offerte.id, anouk)
      expect(d.accounts).toEqual([{ id: 'pr-06', naam: 'Testtechniek Gevelpunt' }])
      expect(d.contacten).toEqual([{ id: c.id, naam: `${c.first_name} ${c.last_name}`, accountId: 'pr-06' }])
      expect(d).toMatchObject({ eigenaar: { id: 'u-02' }, magVerwijderen: false, tekst: null })
      expect((await rij(tx, sql`select count(*)::int as n from audit_events where resource_id = ${offerte.id} and action = 'document.uploaden'`)).n).toBe(1)
    })
  })

  it('tabblad Documenten: het account ziet ook de documenten van zijn contacten, het contact alleen de zijne', async () => {
    await inOrg(ORG, async (tx) => {
      const c = await contactVan(tx, 'pr-06')
      const opAccount = await kb.maakDocument(tx, ORG, anouk, { naam: 'Presentatie kennismaking.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', data: b64('geen echte pptx'), accountIds: ['pr-06'] })
      const opContact = await kb.maakDocument(tx, ORG, anouk, { naam: 'Notitie gesprek.txt', mime: 'text/plain', data: b64('Hij wil in maart beslissen.'), contactIds: [c.id] })
      const acc = await kb.documentenVoorKaart(tx, { accountIds: ['pr-06'] }, anouk)
      expect(acc.map((d: any) => d.id)).toEqual(expect.arrayContaining([opAccount.id, opContact.id]))
      const con = await kb.documentenVoorKaart(tx, { accountIds: ['pr-06'], contactId: c.id }, anouk)
      expect(con.map((d: any) => d.id)).toContain(opContact.id)
      expect(con.map((d: any) => d.id)).not.toContain(opAccount.id)
      expect(acc.find((d: any) => d.id === opAccount.id)).toMatchObject({ type: 'presentatie', magVerwijderen: true, tekstStatus: 'niet-gelezen' })
    })
  })

  it('een verhuisd document wordt bij het eerste openen uitgelezen', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into documenten (id, organisation_id, naam, mime, grootte, inhoud, eigenaar_id) values ('kb-oud', ${ORG}, 'Oude prijslijst.txt', 'text/plain', 20, ${Buffer.from('Tarief per uur: 85 euro.')}, 'u-01')`)
      expect((await rij(tx, sql`select tekst_status from documenten where id = 'kb-oud'`)).tekst_status).toBe('onbekend')
      const d = await kb.documentDetail(tx, 'kb-oud', anouk)
      expect(d).toMatchObject({ tekst: 'Tarief per uur: 85 euro.', tekstStatus: 'gelezen', type: 'overig', versie: '1' })
      expect((await rij(tx, sql`select tekst_status from documenten where id = 'kb-oud'`)).tekst_status).toBe('gelezen')
      const b = await kb.documentBestand(tx, 'kb-oud')
      expect(b.inhoud.toString()).toBe('Tarief per uur: 85 euro.')
    })
  })

  it('verwijderen mag de eigenaar en de beheerder; de koppelingen gaan mee', async () => {
    await inOrg(ORG, async (tx) => {
      const d = await kb.maakDocument(tx, ORG, anouk, { naam: 'Contract onderhoud.txt', mime: 'text/plain', data: b64('Opzegtermijn drie maanden.'), accountIds: ['pr-06'] })
      await expect(kb.verwijderDocument(tx, ORG, d.id, bram)).rejects.toMatchObject({ statusCode: 403 })
      await kb.verwijderDocument(tx, ORG, d.id, mira)
      expect((await rij(tx, sql`select count(*)::int as n from document_koppelingen where document_id = ${d.id}`)).n).toBe(0)
      await expect(kb.documentDetail(tx, d.id, anouk)).rejects.toMatchObject({ statusCode: 404 })
      const e = await kb.maakDocument(tx, ORG, anouk, { naam: 'Eigen.txt', mime: 'text/plain', data: b64('x y z') })
      expect(await kb.verwijderDocument(tx, ORG, e.id, anouk)).toEqual({ ok: true })
    })
  })

  it('foutcodes: soort, grootte, leeg, onbekend account of contact', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(kb.maakDocument(tx, ORG, anouk, { naam: 'virus.exe', mime: 'application/x-msdownload', data: b64('x') })).rejects.toMatchObject({ statusCode: 415 })
      await expect(kb.maakDocument(tx, ORG, anouk, { naam: 'groot.pdf', mime: 'application/pdf', data: Buffer.alloc(8_000_001).toString('base64') })).rejects.toMatchObject({ statusCode: 413 })
      await expect(kb.maakDocument(tx, ORG, anouk, { naam: '', data: b64('x') })).rejects.toMatchObject({ statusCode: 400 })
      await expect(kb.maakDocument(tx, ORG, anouk, { naam: 'a.txt', mime: 'text/plain', data: b64('x'), accountIds: ['bestaat-niet'] })).rejects.toMatchObject({ statusCode: 422 })
      await expect(kb.maakDocument(tx, ORG, anouk, { naam: 'a.txt', mime: 'text/plain', data: b64('x'), contactIds: ['bestaat-niet'] })).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('de documenten uit bijlagen zijn verhuisd', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await rij(tx, sql`select count(*)::int as n from bijlagen where soort = 'document' and record_soort in ('account', 'contact')`)).n).toBe(0)
    })
  })

  it('RLS: een andere organisatie ziet het document niet en kan niet koppelen aan een vreemd account', async () => {
    const id = await inOrg(ORG, async (tx) => {
      const d = await kb.maakDocument(tx, ORG, anouk, { naam: 'Geheim.txt', mime: 'text/plain', data: b64('Alleen voor Voltvast.'), accountIds: ['pr-06'] })
      // Binnen dezelfde transactie, maar met de andere organisatie gezet: niets te zien.
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await rij(tx, sql`select count(*)::int as n from documenten where id = ${d.id}`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from document_koppelingen where document_id = ${d.id}`)).n).toBe(0)
      expect((await kb.kennisbankLijst(tx, { id: 'u-t2', rol: 'accountmanager' })).documenten.map((x: any) => x.id)).not.toContain(d.id)
      await expect(kb.documentDetail(tx, d.id, { id: 'u-t2', rol: 'accountmanager' })).rejects.toMatchObject({ statusCode: 404 })
      return d.id
    })
    expect(id).toBeTruthy()
    await inOrg('org-tweede', async (tx) => {
      // Een account van Voltvast bestaat voor de tweede organisatie niet.
      await expect(kb.maakDocument(tx, 'org-tweede', { id: 'u-t2', rol: 'accountmanager' }, { naam: 'a.txt', mime: 'text/plain', data: b64('x'), accountIds: ['pr-06'] })).rejects.toMatchObject({ statusCode: 422 })
      // Schrijven voor een andere organisatie weigert de policy (als laatste: de transactie is daarna afgebroken).
      const fout = await tx.execute(sql`insert into documenten (organisation_id, naam, mime, grootte) values (${ORG}, 'x', 'text/plain', 1)`).then(() => null, (e: any) => String(e?.cause?.message ?? e?.message))
      expect(fout).toMatch(/row-level security/)
    })
  })
})
