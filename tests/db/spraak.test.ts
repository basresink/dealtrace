// P31 op databaseniveau: transcriptie (alleen EU, credits, opname gewist), spraakopdracht (echte
// taak of notitie, idempotent, verzonnen account geweigerd), offline opdracht, visitekaartje zonder
// dubbel contact, de sweep voor onderweg-meldingen (tijden, sleutel, stilte, plafond) en RLS.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { transcribeer, isEuDienst, MOCK_TRANSCRIPTEN } = await import('../../server/utils/transcriptie')
const { interpreteer, bewaarConcept, leesVisitekaartje, bewaarVisitekaartje, verwerkOfflineOpdracht } = await import('../../server/utils/spraak')
const { sweepOnderweg, meld } = await import('../../server/utils/onderwegMeldingen')

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
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const lieke = { id: 'u-05', niveau: 'gevorderd' }
const planner = { id: 'u-05', naam: 'Testgebruiker Lieke Nieuwland', rol: 'accountmanager', mag: { voorCollega: false } }
const opname = async (tx: any, id: string, grootte = 90_000) => tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud) values (${id}, ${ORG}, 'u-05', 'spraak', 'geen', 'opname', 'audio/webm', ${grootte}, ${Buffer.alloc(16, 1)})`)

describe('transcriptie', () => {
  it('alleen een EU-dienst over https is toegestaan', () => {
    expect(isEuDienst('https://eu.api.speechmatics.com/v2/jobs')).toBe(true)
    expect(isEuDienst('https://api.speechmatics.com/v2/jobs')).toBe(false)
    expect(isEuDienst('https://api.openai.com/v1/audio')).toBe(false)
    expect(isEuDienst('http://eu.api.speechmatics.com')).toBe(false)
    expect(isEuDienst(null)).toBe(false)
  })
  it('mock: tekst, 1 credit per begonnen minuut, opname gewist; met bewaren aan blijft hij; twee keer geeft hetzelfde', async () => {
    await inOrg(ORG, async (tx) => {
      const id = 'aaaaaaaa-0000-4000-8000-000000000001'
      MOCK_TRANSCRIPTEN[id] = 'Bel Tamara morgen.'
      await opname(tx, id, 270_000) // 90 seconden
      const voor = (await rij(tx, sql`select coalesce(sum(credits), 0)::int as n from ai_reserveringen where status = 'geboekt'`)).n
      const r = await transcribeer(tx, ORG, 'u-05', id)
      expect(r).toMatchObject({ tekst: 'Bel Tamara morgen.', seconden: 90 })
      expect((await rij(tx, sql`select coalesce(sum(credits), 0)::int as n from ai_reserveringen where status = 'geboekt'`)).n - voor).toBe(2)
      expect(await rij(tx, sql`select status, inhoud is null as weg from bijlagen where id = ${id}`)).toMatchObject({ status: 'verwerkt', weg: true })
      expect((await rij(tx, sql`select dienst from transcripten where bijlage_id = ${id}`)).dienst).toBe('mock')
      expect((await transcribeer(tx, ORG, 'u-05', id)).tekst).toBe('Bel Tamara morgen.')
      const id2 = 'aaaaaaaa-0000-4000-8000-000000000002'
      await opname(tx, id2)
      await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ORG}, 'spraak', '{"opnamesBewaren": true, "bewaartermijnDagen": 30}') on conflict (organisation_id, key) do update set value = excluded.value`)
      await transcribeer(tx, ORG, 'u-05', id2)
      expect((await rij(tx, sql`select inhoud is null as weg from bijlagen where id = ${id2}`)).weg).toBe(false)
    })
  })
})

describe('spraakopdracht', () => {
  it('een taak met persoon en datum, idempotent op de sleutel; een notitie op het account', async () => {
    await inOrg(ORG, async (tx) => {
      const u = await interpreteer(tx, ORG, lieke, 'Bel Tamara van Leidingdal volgende week dinsdag over de projectschouw', { uitgebreid: true })
      expect(u.soort).toBe('concept')
      const c = (u as any).concept
      expect(c).toMatchObject({ accountId: 'pr-g39', contactNaam: 'Tamara Testleidi' })
      const a = await bewaarConcept(tx, ORG, planner, c, { sleutel: 's-1', uitgebreid: true })
      const b = await bewaarConcept(tx, ORG, planner, c, { sleutel: 's-1', uitgebreid: true })
      expect(b.id).toBe(a.id)
      expect(await rij(tx, sql`select action_type, owner_id, account_id from tasks where id = ${a.id}`)).toMatchObject({ action_type: 'bellen', owner_id: 'u-05', account_id: 'pr-g39' })
      const n = await interpreteer(tx, ORG, lieke, 'Noteer dat de DGA in september terug is', { accountId: 'pr-g44', uitgebreid: false })
      const r = await bewaarConcept(tx, ORG, planner, (n as any).concept, { sleutel: 's-2', uitgebreid: false })
      expect((await rij(tx, sql`select soort, data->>'tekst' as t from activiteiten where id::text = ${r.id}`)).soort).toBe('notitie')
    })
  })
  it('een verzonnen account geeft een vraag in plaats van een concept, en de server weigert het bij Bewaar; een afspraak is Gevorderd', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await interpreteer(tx, ORG, lieke, 'Bel Jan van Bakker Bouw morgen', { uitgebreid: true })).soort).toBe('fout')
      await expect(bewaarConcept(tx, ORG, planner, { soort: 'taak', accountId: 'bestaat-niet', accountNaam: 'Verzonnen', contactId: null, contactNaam: null, titel: 'Bel', datum: '2026-10-20', tijd: null, checks: [] }, { uitgebreid: true })).rejects.toMatchObject({ statusCode: 422 })
      expect((await interpreteer(tx, ORG, { id: 'u-02', niveau: 'beginner' }, 'Plan een afspraak met Testinstallatie Radiator dinsdag om 10 uur', { uitgebreid: false })).soort).toBe('fout')
      await expect(bewaarConcept(tx, ORG, planner, { soort: 'afspraak', accountId: 'pr-g39', accountNaam: 'x', contactId: null, contactNaam: null, titel: 'Kennismaking', datum: '2026-10-20', tijd: '10:00', checks: [] }, { uitgebreid: false })).rejects.toMatchObject({ statusCode: 403 })
    })
  })
  it('offline ingesproken: bij verbinding verwerkt, klaargezet en gemeld', async () => {
    await inOrg(ORG, async (tx) => {
      const id = 'aaaaaaaa-0000-4000-8000-000000000003'
      MOCK_TRANSCRIPTEN[id] = 'Bel Tamara van Leidingdal morgen'
      await opname(tx, id)
      const r = await verwerkOfflineOpdracht(tx, ORG, lieke, { bijlageId: id, accountId: null, op: new Date('2026-10-15T08:42:00Z'), uitgebreid: true })
      expect((await rij(tx, sql`select uitkomst->>'soort' as s from spraak_concepten where id = ${r.id}`)).s).toBe('concept')
      expect((await rij(tx, sql`select titel, link from notificaties where link = ${`/?spraak=${r.id}`}`)).titel).toBe('Je opdracht van 10:42 staat klaar')
    })
  })
})

describe('visitekaartje', () => {
  it('leest het kaartje en voegt samen bij een bestaand e-mailadres in plaats van een tweede contact', async () => {
    await inOrg(ORG, async (tx) => {
      const id = 'aaaaaaaa-0000-4000-8000-000000000004'
      await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud) values (${id}, ${ORG}, 'u-05', 'accounts', 'pr-g39', 'visitekaartje', 'image/jpeg', 3, '\\x010203')`)
      await tx.execute(sql`insert into contacts (id, organisation_id, account_id, first_name, last_name, email, status, data) values ('c-kok', ${ORG}, 'pr-g39', 'Peter', 'Kok', 'peter.kok@voorbeeld.test', 'actief', '{}')`)
      const r = await leesVisitekaartje(tx, ORG, lieke, id, 'pr-g39')
      expect(r.contact).toMatchObject({ voornaam: 'Peter', achternaam: 'Kok', telefoon: '+31612345678', email: 'peter.kok@voorbeeld.test' })
      expect(r.duplicaat?.id).toBe('c-kok')
      const voor = (await rij(tx, sql`select count(*)::int as n from contacts where account_id = 'pr-g39'`)).n
      const b = await bewaarVisitekaartje(tx, ORG, 'u-05', 'pr-g39', r.contact, null)
      expect(b.samengevoegd).toBe(true)
      expect((await rij(tx, sql`select count(*)::int as n from contacts where account_id = 'pr-g39'`)).n).toBe(voor)
      expect((await rij(tx, sql`select data->>'functie' as f, data->>'mobiel' as m from contacts where id = 'c-kok'`))).toMatchObject({ f: 'Hoofd inkoop', m: '+31612345678' })
    })
  })
})

describe('meldingen voor onderweg', () => {
  it('briefing 30 minuten vooraf en verslag 15 minuten na het einde, één keer per sleutel', async () => {
    await inOrg(ORG, async (tx) => {
      // dag-a1 begint vandaag om 10:00 (NL); zet hem op een vaste maandag.
      await tx.execute(sql`update appointments set start_at = '2026-10-19T08:00:00Z', end_at = '2026-10-19T09:00:00Z' where id = 'dag-a1'`)
      const t1 = await sweepOnderweg(tx, ORG, new Date('2026-10-19T07:33:00Z'))
      expect(t1.verstuurd).toBeGreaterThanOrEqual(1)
      expect((await rij(tx, sql`select titel from notificaties where gebruiker_id = 'u-05' and titel like 'Briefing:%' order by op desc limit 1`)).titel).toBe('Briefing: Testinstallatie Leidingdal')
      await sweepOnderweg(tx, ORG, new Date('2026-10-19T07:35:00Z'))
      expect((await rij(tx, sql`select count(*)::int as n from melding_log where sleutel = 'briefing:dag-a1'`)).n).toBe(1)
      await sweepOnderweg(tx, ORG, new Date('2026-10-19T09:16:00Z'))
      expect((await rij(tx, sql`select status from melding_log where sleutel = 'verslag:dag-a1'`)).status).toBe('verstuurd')
    })
  })
  it('stille uren slaan een vertrekmelding over met reden; het dagplafond houdt bij zes op', async () => {
    await inOrg(ORG, async (tx) => {
      const d = (n: number) => ({ soort: 'heet' as const, sleutel: `heet:test-${n}`, gebruikerId: 'u-05', titel: 'Heet', tekst: 't', link: '/', actie: 'Open' })
      expect(await meld(tx, ORG, { ...d(0), soort: 'vertrek', sleutel: 'vertrek:nacht' }, new Date('2026-10-19T20:00:00Z'))).toBe('overgeslagen')
      expect((await rij(tx, sql`select reden from melding_log where sleutel = 'vertrek:nacht'`)).reden).toBe('Stille uren')
      const st: string[] = []
      for (let i = 1; i <= 8; i++) st.push(await meld(tx, ORG, d(i), new Date('2026-10-20T08:00:00Z')))
      expect(st.filter((s) => s === 'verstuurd')).toHaveLength(6)
      expect((await rij(tx, sql`select reden from melding_log where sleutel = 'heet:test-8'`)).reden).toBe('Dagplafond van 6 bereikt')
    })
  })
})

describe('RLS', () => {
  it('transcripten, spraakconcepten en het meldingenlog van Voltvast zijn onzichtbaar voor Tweede', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into transcripten (organisation_id, tekst, dienst) values (${ORG}, 'x', 'mock')`)
      await tx.execute(sql`insert into spraak_concepten (organisation_id, gebruiker_id, uitkomst) values (${ORG}, 'u-05', '{}')`)
    })
    const n = await inOrg('org-tweede', async (tx) => (await rij(tx, sql`select (select count(*) from transcripten)::int + (select count(*) from spraak_concepten)::int + (select count(*) from melding_log)::int as n`)).n)
    expect(n).toBe(0)
  })
})
