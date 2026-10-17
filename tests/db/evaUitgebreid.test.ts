// De uitgebreide werkplek van Eva Ervaren (u-07) uit server/db/seedEvaUitgebreid.ts: veel meer prospects in alle
// klassen, fases en regio's, contacten met een invloedskaart, acht weken werk (belpogingen per uur, belblokken,
// taken, afspraken met verslag en analyse), inzichten, opvolgreeksen, accountplannen, campagnes, kennisbank,
// voornemens en belscriptversies. Alles fictief, binnen werktijd, en een tweede seedronde verandert niets.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isWerkdag, nlMoment, plusDagen } from '../../shared/datum'
import { seedEvaUitgebreid } from '../../server/db/seedEvaUitgebreid'

let beheer: pg.Client
beforeAll(async () => { beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect() })
afterAll(async () => { await beheer.end() })

const ORG = 'org-voltvast'
const rijen = async (q: string, p: unknown[] = []) => (await beheer.query(q, p)).rows as any[]
const een = async (q: string, p: unknown[] = []) => (await rijen(q, p))[0]
let vandaag = nlMoment(new Date()).datum
while (!isWerkdag(vandaag, { bevrijdingsdag: 'lustrum' })) vandaag = plusDagen(vandaag, 1)
const dag = (t: string | Date) => nlMoment(new Date(t)).datum
const uur = (t: string | Date) => { const m = nlMoment(new Date(t)); return m.uur + m.minuut / 60 }

describe('Eva uitgebreid (seedEvaUitgebreid)', () => {
  it('72 extra prospects in alle klassen, fases, branches en regio\'s; een paar gedeactiveerd met reden', async () => {
    const acc = await rijen(`select id, klasse, fase_id, nb_status, vv_branche_id, gebied_id, gedeactiveerd_op, data from accounts where id like 'eva-p%'`)
    expect(acc.length).toBe(72)
    expect(new Set(acc.map((a) => a.klasse))).toEqual(new Set(['kl-a-prospects', 'kl-b-prospects', 'kl-c-prospects', 'kl-d-prospects']))
    expect(new Set(acc.map((a) => a.fase_id)).size).toBe(10)
    expect(new Set(acc.map((a) => a.vv_branche_id))).toEqual(new Set(['br-01', 'br-02', 'br-03', 'br-04']))
    expect(acc.some((a) => a.gebied_id === 'regio-midden') && acc.some((a) => a.gebied_id === null)).toBe(true)
    // Het aantal medewerkers past bij de klasse.
    const grens: Record<string, [number, number]> = { 'kl-a-prospects': [250, 1e6], 'kl-b-prospects': [50, 249], 'kl-c-prospects': [10, 49], 'kl-d-prospects': [0, 9] }
    expect(acc.every((a) => a.data.medewerkers >= grens[a.klasse]![0] && a.data.medewerkers <= grens[a.klasse]![1])).toBe(true)
    // Grote prospects (A en B) verschuiven de jaarplanning niet: geen open status zonder lopend ritme.
    expect(acc.filter((a) => ['kl-a-prospects', 'kl-b-prospects'].includes(a.klasse) && ['nieuw', 'in reis', 'wachtend'].includes(a.nb_status) && !a.data.reis?.ritme?.actief)).toEqual([])
    const uit = acc.filter((a) => a.gedeactiveerd_op)
    expect(uit.length).toBeGreaterThanOrEqual(3)
    expect(uit.every((a) => a.data.gedeactivering?.reden && a.data.gedeactivering.toelichting)).toBe(true)
    // Dossier en BAND-kwalificatie vanaf de fases waar ze horen.
    expect(acc.filter((a) => a.fase_id !== 'gevonden').every((a) => a.data.dossier?.criteria)).toBe(true)
    expect(acc.filter((a) => ['afspraak-gepland', 'afspraak-gehouden', 'overgedragen'].includes(a.fase_id)).every((a) => Object.values(a.data.band).every((b: any) => b.ja))).toBe(true)
  })

  it('2 tot 5 contacten per prospect, met rol, houding en rapporteert-aan binnen hetzelfde account', async () => {
    const c = await rijen(`select c.id, c.account_id, c.rol, c.data from contacts c where c.account_id like 'eva-p%'`)
    const per = new Map<string, number>()
    for (const x of c) per.set(x.account_id, (per.get(x.account_id) ?? 0) + 1)
    expect([...per.values()].every((n) => n >= 2 && n <= 5)).toBe(true)
    expect(new Set(c.map((x) => x.rol)).size).toBeGreaterThanOrEqual(5)
    const ids = new Map(c.map((x) => [x.id, x.account_id]))
    const relaties = c.filter((x) => x.data.invloed?.rapporteertAan)
    expect(relaties.length).toBeGreaterThan(50)
    expect(relaties.every((x) => ids.get(x.data.invloed.rapporteertAan) === x.account_id)).toBe(true)
    expect(new Set(c.map((x) => x.data.invloed?.houding).filter(Boolean))).toEqual(new Set(['voor', 'neutraal', 'tegen']))
  })

  it('acht weken werk: belpogingen over de uren van de dag, gehouden belblokken met resultaat, verslagen', async () => {
    const bel = await rijen(`select op from activiteiten where door = 'u-07' and soort = 'gebeld' and id like 'eva-x%'`)
    expect(bel.length).toBeGreaterThan(100)
    const perUur = new Map<number, number>()
    for (const b of bel) perUur.set(Math.floor(uur(b.op)), (perUur.get(Math.floor(uur(b.op))) ?? 0) + 1)
    expect([...perUur.values()].filter((n) => n >= 5).length).toBeGreaterThanOrEqual(5)
    expect(bel.every((b) => uur(b.op) >= 8 && uur(b.op) < 18 && isWerkdag(dag(b.op)) && dag(b.op) >= plusDagen(vandaag, -60))).toBe(true)
    const soorten = new Set((await rijen(`select distinct soort from activiteiten where id like 'eva-x%'`)).map((r) => r.soort))
    for (const s of ['gebeld', 'mail', 'bericht', 'notitie', 'afspraak']) expect(soorten.has(s)).toBe(true)
    const klaar = await rijen(`select data from belblok_sessies where gebruiker_id = 'u-07' and id like 'eva-bb-k2%'`)
    expect(klaar.length).toBeGreaterThanOrEqual(15)
    expect(klaar.every((s) => s.data.resultaat?.gevoerd === s.data.gesprekken.length && s.data.gesprekken.length > 0)).toBe(true)
    expect((await een(`select count(*)::int n from activiteit_verslagen where id like 'eva-av%'`)).n).toBeGreaterThanOrEqual(10)
  })

  it('taken: afgerond in het verleden, open vandaag en de komende vier weken, met verschillende herkomsten', async () => {
    const t = await rijen(`select status, due_date, data from tasks where owner_id = 'u-07' and (id like 'eva-tk%' or id like 'eva-to%' or id like 'eva-ts%' or id like 'eva-tplan-%' or id like 'eva-rt-%')`)
    expect(t.filter((x) => x.status === 'klaar').length).toBeGreaterThan(150)
    const open = t.filter((x) => x.status === 'open')
    expect(open.filter((x) => dag(x.due_date) === vandaag).length).toBeGreaterThanOrEqual(8)
    expect(open.some((x) => dag(x.due_date) >= plusDagen(vandaag, 18))).toBe(true)
    expect(new Set(open.map((x) => x.data.herkomst?.bron)).size).toBeGreaterThanOrEqual(8)
    expect(open.every((x) => isWerkdag(dag(x.due_date)) && uur(x.due_date) >= 8 && uur(x.due_date) <= 18)).toBe(true)
  })

  it('afspraken en bezoeken: gehouden met verslag, transcript en analyse, gepland tot vier weken vooruit, binnen werktijd', async () => {
    const a = await rijen(`select a.id, a.status, a.vorm, a.start_at, a.end_at, a.data from appointments a where a.id like 'eva-ap-x%'`)
    expect(a.length).toBeGreaterThanOrEqual(30)
    expect(new Set(a.map((x) => x.status))).toEqual(new Set(['gepland', 'afgerond', 'niet_verschenen', 'geannuleerd']))
    expect(a.filter((x) => x.status === 'afgerond').every((x) => x.data.verslag?.tekst)).toBe(true)
    expect(a.some((x) => x.data.notulist?.koopsignalen?.length)).toBe(true)
    expect((await een(`select count(*)::int n from transcripten where record_soort = 'appointments' and record_id like 'eva-ap-x%'`)).n).toBeGreaterThanOrEqual(2)
    for (const x of a) {
      const s = uur(x.start_at)
      const e = uur(x.end_at)
      expect(isWerkdag(dag(x.start_at))).toBe(true)
      expect(s >= 8 && e <= 18).toBe(true)
      expect(s < 12.5 && e > 12).toBe(false)
      if (new Date(`${dag(x.start_at)}T12:00:00Z`).getUTCDay() === 2) expect(s < 15 && e > 14).toBe(false)
    }
  })

  it('inzichten, opvolgreeksen, accountplannen, campagnes, kennisbank, voornemens en belscriptversies', async () => {
    const s = await rijen(`select status, data from signals where id like 'eva-s1%'`)
    expect(s.length).toBeGreaterThanOrEqual(40)
    expect(s.filter((x) => x.data.bron?.naam).length).toBe(s.length)
    expect(new Set(s.map((x) => x.status))).toEqual(new Set(['nieuw', 'gelezen', 'omgezet', 'afgewezen', 'later']))
    const r = await rijen(`select status, stopreden from reeksen where owner_id = 'u-07'`)
    expect(new Set(r.map((x) => x.status))).toEqual(new Set(['loopt', 'gepauzeerd', 'gestopt', 'klaar']))
    expect(new Set(r.map((x) => x.stopreden).filter(Boolean))).toEqual(new Set(['afspraak', 'reactie', 'nee', 'handmatig']))
    expect((await een(`select count(*)::int n from accountplannen where owner_id = 'u-07' and status = 'actueel'`)).n).toBeGreaterThanOrEqual(3)
    const c = await rijen(`select c.status, count(i.*)::int n from campagnes c join campagne_items i on i.campagne_id = c.id where c.id in ('cp-eva-02', 'cp-eva-03', 'cp-eva-04') group by 1`)
    expect(new Set(c.map((x) => x.status))).toEqual(new Set(['actief', 'afgerond', 'concept']))
    expect((await een(`select count(*)::int n from documenten d where eigenaar_id = 'u-07' and exists (select 1 from document_koppelingen k where k.document_id = d.id)`)).n).toBeGreaterThanOrEqual(4)
    expect((await een(`select count(*)::int n from voornemens where gebruiker_id = 'u-07' and id like 'eva-vn-%'`)).n).toBe(7)
    expect((await een(`select count(*)::int n from belscript_prospectversies where gebruiker_id = 'u-07' and status = 'bewaard'`)).n).toBeGreaterThanOrEqual(10)
  })

  it('alleen fictieve gegevens en geen gedachtestreepjes', async () => {
    const teksten = JSON.stringify([
      await rijen(`select name, data from accounts where id like 'eva-p%' or id like 'eva-k0%'`), await rijen(`select first_name, last_name, data from contacts where account_id like 'eva-p%'`),
      await rijen(`select data from activiteiten where id like 'eva-x%'`), await rijen(`select data from appointments where id like 'eva-ap-x%'`), await rijen(`select tekst from transcripten where record_id like 'eva-ap-x%'`),
      await rijen(`select title, data from tasks where id like 'eva-t%'`), await rijen(`select title, data from signals where id like 'eva-s1%'`), await rijen(`select tekst from documenten where id like 'kb-eva-%'`),
    ])
    expect(teksten).not.toMatch(/[–—]/)
    expect((await rijen(`select email from contacts where account_id like 'eva-p%' and email not like '%.test'`)).length).toBe(0)
  })

  it('een tweede seedronde voegt niets toe', async () => {
    const tel = async () => een(`select (select count(*) from accounts where id like 'eva-%')::int a, (select count(*) from tasks where owner_id = 'u-07')::int t, (select count(*) from appointments where owner_id = 'u-07')::int p,
      (select count(*) from belblok_sessies where gebruiker_id = 'u-07')::int b, (select count(*) from activiteiten where door = 'u-07')::int x, (select count(*) from signals where owner_id = 'u-07')::int s, (select count(*) from reeksen where owner_id = 'u-07')::int r`)
    await beheer.query('begin')
    try {
      const voor = await tel()
      await seedEvaUitgebreid(beheer, ORG)
      expect(await tel()).toEqual(voor)
    } finally { await beheer.query('rollback') }
  })
})
