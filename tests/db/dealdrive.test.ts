// P23 op databaseniveau: de overdracht naar DealDrive (mock), de webhook-ontvanger (handtekening, tijd,
// dubbel gebeurtenisId, onbekend account, stand uit, cross-tenant), de vier terugmeldingen, ontdubbelen met
// cache, en de suggesties naar SalesDNA (hooguit 10 per sublaag, namenfilter, vrijgeven, zonder koppeling,
// suggestie.status en 429). Elke test rolt terug.
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { tekenVerzoek } from '../../shared/dealdrive'
import { isoWeek, volgendeWeek, type Kandidaat } from '../../shared/suggesties'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const o = await import('../../server/utils/overdracht')
const dd = await import('../../server/utils/dealdrive')
const sg = await import('../../server/utils/suggesties')
const sd = await import('../../server/utils/salesdna')
const { versleutel } = await import('../../server/utils/geheimen')
const { teken } = await import('../../server/utils/salesdnaWebhook')

let pool: pg.Pool
class Terug extends Error {}
async function inTx<T>(werk: (tx: any, u: any) => Promise<T>, org = 'org-voltvast'): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    const zet = (x: string) => tx.execute(sql`select set_config('app.organisation_id', ${x}, true)`)
    await zet(org)
    const u = {
      zoek: async (x: string) => (await tx.execute(sql`select * from dealtrace_dealdrive_koppeling(${x})`)).rows[0] ?? null,
      inOrg: async (x: string, w: (t: any) => Promise<any>) => { await zet(x); try { return await w(tx) } finally { await zet(org) } },
    }
    uit = await werk(tx, u)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const ORG = 'org-voltvast'
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const anouk = { id: 'u-01', naam: 'Testgebruiker Anouk Noorderveld', email: 'anouk@voltvast.test' }
const stap = { omschrijving: 'Gratis projectschouw op locatie', datum: '2026-10-22', soort: 'bezoek' }
const fixture = (f: string) => JSON.parse(readFileSync(`seed/dealdrive-mock/${f}`, 'utf8'))
const GEHEIM = 'dealdrive-testgeheim-voor-voltvast-32-tekens'
const GEHEIM_B = 'dealdrive-testgeheim-voor-tweede-32-tekens!'

async function zetGeheim(tx: any, org = ORG, geheim = GEHEIM) {
  await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
  await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (${org}, 'dealdrive', 'actief', ${versleutel({ geheim }, 'dealdrive')}, '{"stand": "mock"}'::jsonb)
    on conflict (organisation_id, soort) do update set geheimen = excluded.geheimen, status = 'actief'`)
  await tx.execute(sql`select set_config('app.organisation_id', ${ORG}, true)`)
}
function melding(f: string, extra: Record<string, any> = {}, gegevens: Record<string, any> = {}) {
  const b = fixture(f)
  return { ...b, ...extra, gebeurtenisId: extra.gebeurtenisId ?? crypto.randomUUID(), gegevens: { ...b.gegevens, ...gegevens } }
}
async function stuur(u: any, body: any, opties: { org?: string; geheim?: string; nu?: Date; tijd?: number } = {}) {
  const rauw = JSON.stringify(body)
  const nu = opties.nu ?? new Date()
  const tijd = opties.tijd ?? Math.floor(nu.getTime() / 1000)
  return dd.ontvangTerugmelding(opties.org ?? ORG, rauw, { handtekening: tekenVerzoek(rauw, opties.geheim ?? GEHEIM, tijd), tijd: String(tijd) }, nu, u)
}
async function overgedragen(tx: any) {
  const r = await o.draagOver(tx, ORG, anouk, 'pr-02', { naar: 'dealdrive', vervolgstap: stap })
  expect(await o.verstuurOverdracht(tx, r.id)).toBe('verstuurd')
  return r
}

describe('overdracht en terugmeldingen (stand mock)', () => {
  it('verstuurd met het accountId uit de fixture en de link op de kaart; overdracht.verwerkt zet bevestigd; dubbel verandert niets', async () => {
    await inTx(async (tx, u) => {
      await zetGeheim(tx)
      const r = await overgedragen(tx)
      expect(await rij(tx, sql`select status, extern_id from overdrachten where id = ${r.id}`)).toEqual({ status: 'verstuurd', extern_id: 'acc_dd_5520' })
      expect((await rij(tx, sql`select data->'extern'->'dealdrive' as d from accounts where id = 'pr-02'`)).d).toMatchObject({ accountId: 'acc_dd_5520', url: 'https://dealdrive.test/accounts/acc_dd_5520', overdrachtId: r.id })
      const m = melding('webhook-overdracht-verwerkt.json', { dealtraceAccountId: 'pr-02' }, { overdrachtId: r.id })
      expect((await stuur(u, m)).status).toBe(202)
      expect((await stuur(u, m)).status).toBe(200)
      expect(await dd.verwerkTerugmeldingen(tx, ORG)).toBe(1)
      expect((await rij(tx, sql`select status from overdrachten where id = ${r.id}`)).status).toBe('bevestigd')
      expect(await rijen(tx, sql`select resultaat, gegevens from dealdrive_gebeurtenissen`)).toEqual([{ resultaat: 'verwerkt', gegevens: null }])
      expect(await dd.verwerkTerugmeldingen(tx, ORG)).toBe(0)
    })
  })
  it('ongeldige handtekening of tijd boven 5 minuten: 401 en niets geschreven; onbekend account 404; stand uit 403', async () => {
    await inTx(async (tx, u) => {
      await zetGeheim(tx)
      const m = melding('webhook-deal-gewonnen.json', { dealtraceAccountId: 'pr-02' })
      expect((await stuur(u, m, { geheim: 'verkeerd-geheim' })).body).toMatchObject({ fout: { code: 'handtekening_ongeldig' } })
      const nu = new Date()
      const r = await stuur(u, m, { nu, tijd: Math.floor(nu.getTime() / 1000) - 301 })
      expect(r).toMatchObject({ status: 401, body: { fout: { code: 'tijd_verlopen' } } })
      expect((await rij(tx, sql`select count(*)::int as n from dealdrive_gebeurtenissen`)).n).toBe(0)
      expect(await stuur(u, melding('webhook-deal-gewonnen.json', { dealtraceAccountId: 'acc_bestaat_niet' }))).toMatchObject({ status: 404, body: { fout: { code: 'account_onbekend' } } })
      await tx.execute(sql`update koppelingen set status = 'uit' where soort = 'dealdrive'`)
      expect((await stuur(u, m)).status).toBe(403)
      expect((await rij(tx, sql`select count(*)::int as n from dealdrive_gebeurtenissen`)).n).toBe(0)
    })
  })
  it('cross-tenant: een terugmelding met de handtekening van B die een account van A noemt geeft 404; met het geheim van A maar de header van B 401', async () => {
    await inTx(async (tx, u) => {
      await zetGeheim(tx)
      await zetGeheim(tx, 'org-tweede', GEHEIM_B)
      const m = melding('webhook-deal-gewonnen.json', { dealtraceAccountId: 'pr-02' })
      expect(await stuur(u, m, { org: 'org-tweede', geheim: GEHEIM_B })).toMatchObject({ status: 404, body: { fout: { code: 'account_onbekend' } } })
      expect((await stuur(u, m, { org: 'org-tweede', geheim: GEHEIM })).status).toBe(401)
      expect((await stuur(u, m, { org: 'org-bestaat-niet' })).body).toMatchObject({ fout: { code: 'organisatie_onbekend' } })
      expect((await rij(tx, sql`select count(*)::int as n from dealdrive_gebeurtenissen`)).n).toBe(0)
    })
  })
  it('deal.gewonnen: account blijft overgedragen, telt als gewonnen na overdracht, vraagt "Mag dit een bewijs worden?"; Ja maakt een suggestie zonder namen', async () => {
    await inTx(async (tx, u) => {
      await zetGeheim(tx)
      await overgedragen(tx)
      await stuur(u, melding('webhook-deal-gewonnen.json', { dealtraceAccountId: 'pr-02' }))
      await dd.verwerkTerugmeldingen(tx, ORG)
      const a = await rij(tx, sql`select nb_status, account_kind, data->'extern'->'dealdrive' as d from accounts where id = 'pr-02'`)
      expect(a).toMatchObject({ nb_status: 'overgedragen', account_kind: 'prospect', d: { bewijsVraag: 'open' } })
      expect((await rij(tx, sql`select count(*)::int as n from overdrachten where data ? 'gewonnen'`)).n).toBe(1)
      expect((await rij(tx, sql`select tekst, link from notificaties where data->>'vraag' = 'bewijs'`))).toMatchObject({ tekst: expect.stringContaining('Mag dit een bewijs worden?'), link: '/accounts/pr-02?bewijs=1' })
      const b = await sg.beantwoordBewijs(tx, ORG, { id: 'u-01' }, 'pr-02', true)
      const s = await rij(tx, sql`select status, tekst, bron from salesdna_suggesties where id = ${b.suggestie}`)
      expect(s).toMatchObject({ status: 'concept', bron: 'gewonnen' })
      expect(s.tekst).not.toContain('Vonkenburg')
      expect((await sg.beantwoordBewijs(tx, ORG, { id: 'u-01' }, 'pr-02', true).catch((e: any) => e)).statusCode).toBe(409)
      expect((await rij(tx, sql`select count(*)::int as n from accounts where account_kind = 'klant' and id = 'pr-02'`)).n).toBe(0)
    })
  })
  it('deal.verloren met verlorenAan: via vv_redenmapping hc-03 met datum, kanaal en rol; klant.slapend 6: herwinaccount met hc-04 en een taak', async () => {
    await inTx(async (tx, u) => {
      await zetGeheim(tx)
      await overgedragen(tx)
      await stuur(u, melding('webhook-deal-verloren.json', { dealtraceAccountId: 'pr-02' }))
      await dd.verwerkTerugmeldingen(tx, ORG)
      const a = await rij(tx, sql`select terug_regel_id, data->'winback' as w from accounts where id = 'pr-02'`)
      expect(a.terug_regel_id).toBe('hc-03')
      expect(a.w).toMatchObject({ bron: 'dealdrive', reden: 'Prijs', verlorenAan: 'Online webgroothandel', regelId: 'hc-03', kanaal: 'bezoek', rol: 'Accountmanager' })
      const t = await rij(tx, sql`select action_type, due_date from tasks where account_id = 'pr-02' and title like 'Terug in beeld%'`)
      expect(t.action_type).toBe('bezoek')
      // De taak staat op het eerstvolgende werkmoment op of na de terugkomdatum (valt die in het weekend, dan maandag).
      const taakDag = new Date(t.due_date).toISOString().slice(0, 10)
      expect(taakDag >= a.w.datum && (Date.parse(taakDag) - Date.parse(a.w.datum)) / 864e5 <= 2).toBe(true)
      expect([0, 6]).not.toContain(new Date(`${taakDag}T12:00:00Z`).getUTCDay())
      await stuur(u, melding('webhook-klant-slapend.json', { dealtraceAccountId: 'pr-02' }))
      await dd.verwerkTerugmeldingen(tx, ORG)
      const h = await rij(tx, sql`select terug_regel_id, data->'herwin' as h from accounts where id = 'pr-02'`)
      expect(h.terug_regel_id).toBe('hc-04')
      expect(h.h).toMatchObject({ bron: 'dealdrive', maanden: 6, regelId: 'hc-04', laatsteOrder: '2026-12-10' })
      expect((await rij(tx, sql`select count(*)::int as n from tasks where account_id = 'pr-02' and title like 'Terug in beeld%'`)).n).toBe(2)
    })
  })
  it('blijft overdracht.verwerkt uit, dan vraagt de job na 30 minuten de stand op', async () => {
    await inTx(async (tx) => {
      const r = await overgedragen(tx)
      expect(await dd.vraagStandOp(tx, new Date())).toBe(0)
      expect(await dd.vraagStandOp(tx, new Date(Date.now() + 31 * 60_000))).toBe(1)
      expect((await rij(tx, sql`select status, data->>'bevestigdVia' as v from overdrachten where id = ${r.id}`))).toEqual({ status: 'bevestigd', v: 'stand' })
    })
  })
  it('ontdubbelen: KvK uit zoek-antwoord.json geeft Prospect in DealDrive; binnen 24 uur uit de cache; stand uit geeft null', async () => {
    await inTx(async (tx) => {
      expect(await dd.zoekInDealdrive(tx, { kvk: '99123456' })).toEqual([expect.objectContaining({ accountId: 'acc_dd_5520', soort: 'prospect', eigenaar: 'eva.dijkstra@voltvast.test' })])
      await tx.execute(sql`update dealdrive_zoekcache set antwoord = '[{"accountId":"uit-cache"}]'::jsonb`)
      expect(await dd.zoekInDealdrive(tx, { kvk: '99123456' })).toEqual([{ accountId: 'uit-cache' }])
      expect(await dd.zoekInDealdrive(tx, { kvk: '99123456' }, new Date(Date.now() + 25 * 3600_000))).toEqual([expect.objectContaining({ accountId: 'acc_dd_5520' })])
      await tx.execute(sql`update koppelingen set status = 'uit' where soort = 'dealdrive'`)
      expect(await dd.zoekInDealdrive(tx, { kvk: '99123456' })).toBeNull()
    })
  })
  it('Test verbinding en de stand zonder geheim', async () => {
    await inTx(async (tx) => {
      await zetGeheim(tx)
      expect(await dd.testDealdrive(tx, ORG)).toEqual({ ok: true, melding: 'De mock van DealDrive antwoordt.' })
      const s = await dd.dealdriveStatus(tx)
      expect(s).toMatchObject({ stand: 'mock', geheimVingerafdruk: expect.stringMatching(/^[0-9a-f]{8}$/) })
      expect(JSON.stringify(s)).not.toContain(GEHEIM)
    })
  })
})

describe('suggesties naar SalesDNA', () => {
  const kandidaat = (i: number, onderwerpId = 'L0.8'): Kandidaat => ({ onderwerpId, veld: 'concurrenten', regelExternId: null, soort: 'ontbrekende concurrent', tekst: `Concurrent ${i} kwam in ${5 + i} verslagen voor.`, bewijs: { aantallen: [{ label: 'verslagen', waarde: 5 + i }], citaten: [] }, kracht: 5 + i, sleutel: `test:${onderwerpId}:${i}` })
  const joost = { id: 'u-04', rol: 'salesmanager' }
  const nu = new Date()
  it('hooguit 10 per sublaag per week: de elfde staat op Concept voor de volgende week; de salesmanager krijgt een melding', async () => {
    await inTx(async (tx) => {
      const r = await sg.maakBundel(tx, ORG, nu, Array.from({ length: 11 }, (_, i) => kandidaat(i)))
      expect(r).toEqual({ week: isoWeek(nu), nieuw: 10, doorgeschoven: 1 })
      const per = await rijen(tx, sql`select week, count(*)::int as n, min(kracht)::int as k from salesdna_suggesties group by week order by week`)
      expect(per).toEqual([{ week: isoWeek(nu), n: 10, k: 6 }, { week: volgendeWeek(isoWeek(nu)), n: 1, k: 5 }])
      expect((await rij(tx, sql`select titel from notificaties where gebruiker_id = 'u-04' and titel = 'Concept klaar ter goedkeuring'`))).toBeTruthy()
      expect((await sg.maakBundel(tx, ORG, nu, Array.from({ length: 11 }, (_, i) => kandidaat(i)))).nieuw).toBe(0)
    })
  })
  it('een aangepaste tekst met een contactnaam geeft 422; zonder vrijgave wordt niets verstuurd', async () => {
    await inTx(async (tx) => {
      await sg.maakBundel(tx, ORG, nu, [kandidaat(1)])
      const [s] = await rijen(tx, sql`select id from salesdna_suggesties`)
      const c = await rij(tx, sql`select first_name, last_name from contacts where last_name is not null limit 1`)
      const fout = await sg.besluitSuggestie(tx, ORG, joost, s.id, { besluit: 'vrij', tekst: `Volgens ${c.first_name} ${c.last_name} werkt het` }).catch((e: any) => e)
      expect(fout.statusCode).toBe(422)
      expect(await sg.verstuur(tx, ORG, joost, [s.id])).toMatchObject({ verstuurd: 0 })
      expect((await rij(tx, sql`select status from salesdna_suggesties where id = ${s.id}`)).status).toBe('concept')
    })
  })
  it('zonder SalesDNA-koppeling: vrijgeven wordt een taak voor de beheerder, niets verzonden', async () => {
    await inTx(async (tx) => {
      await sg.maakBundel(tx, ORG, nu, [kandidaat(1)])
      const [s] = await rijen(tx, sql`select id from salesdna_suggesties`)
      const r = await sg.besluitSuggestie(tx, ORG, joost, s.id, { besluit: 'vrij' })
      expect(r.verzonden).toMatchObject({ eigenInrichting: 1, verstuurd: 0 })
      expect(r.status).toBe('vrijgegeven')
      expect((await rij(tx, sql`select owner_id, title from tasks where onderwerp = ${`suggestie:${s.id}`}`))).toEqual({ owner_id: 'u-06', title: 'Verkoopverhaal aanvullen: Concurrenten' })
    })
  })
  it('met de mock van SalesDNA: vrijgeven verstuurt, de status komt terug; een tweede status verandert niets; boven 10 per sublaag 429', async () => {
    await inTx(async (tx) => {
      await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (${ORG}, 'salesdna', 'actief', ${versleutel({ geheim: 'sd-geheim' })}, '{"endpoint": "mock"}'::jsonb)`)
      await sg.maakBundel(tx, ORG, nu, Array.from({ length: 10 }, (_, i) => kandidaat(i)))
      const ids = (await rijen(tx, sql`select id from salesdna_suggesties order by kracht desc`)).map((x) => x.id)
      const r = await sg.besluitSuggestie(tx, ORG, joost, ids[0], { besluit: 'vrij', tekst: 'Een aangepaste tekst zonder namen.' })
      expect(r).toMatchObject({ status: 'overgenomen', tekst: 'Een aangepaste tekst zonder namen.' })
      await sd.verwerkSuggestieStatus(tx, { suggestieId: ids[0], status: 'afgewezen' })
      expect((await rij(tx, sql`select status from salesdna_suggesties where id = ${ids[0]}`)).status).toBe('overgenomen')
      const rest = ids.slice(1)
      for (const id of rest) await sg.besluitSuggestie(tx, ORG, joost, id, { besluit: 'vrij' }, nu, { zonderVersturen: true })
      expect(await sg.verstuur(tx, ORG, joost, rest)).toMatchObject({ verstuurd: 9 })
      await tx.execute(sql`insert into salesdna_suggesties (organisation_id, week, onderwerp_id, veld, soort, tekst, status, sleutel) values (${ORG}, ${isoWeek(nu)}, 'L0.8', 'concurrenten', 'x', 'Elfde', 'vrijgegeven', 'elfde')`)
      const [elf] = await rijen(tx, sql`select id from salesdna_suggesties where sleutel = 'elfde'`)
      expect((await sg.verstuur(tx, ORG, joost, [elf.id]).catch((e: any) => e)).statusCode).toBe(429)
    })
  })
  it('suggestie.status via de SalesDNA-webhook: ongeldige handtekening 401 zonder wijziging; dubbel event verandert niets', async () => {
    await inTx(async (tx, u) => {
      const [k] = await rijen(tx, sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (${ORG}, 'salesdna', 'actief', ${versleutel({ geheim: 'sd-geheim' })}, '{"endpoint": "https://salesdna.test"}'::jsonb) returning id`)
      await tx.execute(sql`insert into salesdna_suggesties (organisation_id, week, onderwerp_id, veld, soort, tekst, status, sleutel) values (${ORG}, ${isoWeek(nu)}, 'L0.8', 'concurrenten', 'x', 'Tekst', 'verstuurd', 's1')`)
      const [s] = await rijen(tx, sql`select id from salesdna_suggesties`)
      const su = { zoek: async (id: string) => (await tx.execute(sql`select * from dealtrace_salesdna_koppeling(${id})`)).rows[0], inOrg: async (_: string, w: any) => w(tx) }
      const body = JSON.stringify({ eventId: 'ev-s1', soort: 'suggestie.status', suggestieId: s.id, status: 'afgewezen', tijd: nu.toISOString() })
      expect((await sd.ontvang(k.id, body, { handtekening: teken(body, 'verkeerd'), eventId: 'ev-s1', tijd: nu.toISOString() }, nu, su)).status).toBe(401)
      expect((await rij(tx, sql`select status from salesdna_suggesties where id = ${s.id}`)).status).toBe('verstuurd')
      expect((await sd.ontvang(k.id, body, { handtekening: teken(body, 'sd-geheim'), eventId: 'ev-s1', tijd: nu.toISOString() }, nu, su)).status).toBe(202)
      await sd.verwerkWachtende(ORG, su)
      expect((await rij(tx, sql`select status from salesdna_suggesties where id = ${s.id}`)).status).toBe('afgewezen_salesdna')
      expect((await sd.ontvang(k.id, body, { handtekening: teken(body, 'sd-geheim'), eventId: 'ev-s1', tijd: nu.toISOString() }, nu, su)).resultaat).toBe('dubbel')
    })
  })
  it('een salesmanager ziet alleen suggesties uit zijn teams; cross-tenant onzichtbaar', async () => {
    await inTx(async (tx) => {
      await tx.execute(sql`insert into teams (id, organisation_id, naam, manager_ids) values ('tm-ander', ${ORG}, 'Ander team', '{}')`)
      await tx.execute(sql`insert into salesdna_suggesties (organisation_id, week, onderwerp_id, veld, soort, tekst, team_id, sleutel) values (${ORG}, ${isoWeek(nu)}, 'L0.8', 'c', 'x', 'Van een ander team', 'tm-ander', 'a1'), (${ORG}, ${isoWeek(nu)}, 'L0.8', 'c', 'x', 'Voor iedereen', null, 'a2')`)
      const teksten = (l: any) => l.groepen.flatMap((g: any) => g.suggesties.map((s: any) => s.tekst)).sort()
      expect(teksten(await sg.suggestiesVoor(tx, joost, null))).toEqual(['Voor iedereen'])
      expect(teksten(await sg.suggestiesVoor(tx, { id: 'u-06', rol: 'beheerder' }, null))).toEqual(['Van een ander team', 'Voor iedereen'])
      expect((await sg.suggestiesVoor(tx, { id: 'u-01', rol: 'accountmanager' }, null).catch((e: any) => e)).statusCode).toBe(403)
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await rij(tx, sql`select count(*)::int as n from salesdna_suggesties`)).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from dealdrive_gebeurtenissen`)).n).toBe(0)
    })
  })
})
