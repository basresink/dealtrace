// P14 (test:route): de kansformule en de route. Acceptatie 6 tot en met 9 en het prestatiebudget
// (600 accounts en 6 stops onder 800 ms).
import { describe, expect, it } from 'vitest'
import { afstandKm, bellijstNaastBezoeken, dagStatistiek, geocodeerTerugval, kaartLink, kansenLangsRoute, kansScore, omrijMinuten, schatReistijd, vrijeMomenten, type Kandidaat, type KansFilters, type Punt } from '../../shared/route'

const AMERSFOORT: Punt = { lat: 52.16, lng: 5.39 }
const ASSEN: Punt = { lat: 52.99, lng: 6.56 }
const EMMEN: Punt = { lat: 52.79, lng: 6.90 }
const nu = new Date('2026-10-15T06:00:00Z')
const filters = (x: Partial<KansFilters> = {}): KansFilters => ({ ikId: 'ik', alleenMijn: true, alleenProspects: true, maxOmrij: 30, aantal: null, inRoute: new Set(), overgeslagen: new Set(), nu, ...x })
const kand = (id: string, punt: Punt, x: Partial<Kandidaat> = {}): Kandidaat => ({ id, naam: id, punt, ownerId: 'ik', soort: 'prospect', basisscore: 20, bronnen: [{ soort: 'bezoektaak', label: 'Open bezoektaak' }], ...x })
const stops = [{ id: 's1', start: '2026-10-15T08:00:00Z', eind: '2026-10-15T09:00:00Z', punt: ASSEN }, { id: 's2', start: '2026-10-15T12:00:00Z', eind: '2026-10-15T13:00:00Z', punt: EMMEN }]
const route = { punten: [AMERSFOORT, ASSEN, EMMEN, AMERSFOORT], stops, gaten: vrijeMomenten(stops, { start: '2026-10-15T06:00:00Z', eind: '2026-10-15T16:00:00Z' }) }
// Een punt dat `minuten` rijden (schatting) ten noorden van p ligt.
const bij = (p: Punt, minuten: number): Punt => ({ lat: p.lat + minuten / 1.3 / 111.2, lng: p.lng })
// Vanuit één punt (heen en terug) is de omrijtijd voorspelbaar: tweemaal de reistijd.
const thuis = { punten: [ASSEN, ASSEN], stops: [], gaten: [] }

describe('afstand, schatting en geocodering', () => {
  it('haversine: zelfde punt is 0; schatting is maal 1,3 bij 60 km per uur', () => {
    expect(afstandKm(ASSEN, ASSEN)).toBe(0)
    const s = schatReistijd(AMERSFOORT, ASSEN)
    expect(s.schatting).toBe(true)
    expect(s.minuten).toBe(Math.round(afstandKm(AMERSFOORT, ASSEN) * 1.3))
  })
  it('terugval: adres, dan plaats, dan postcode; synoniem; buitenland zonder punt', () => {
    expect(geocodeerTerugval({ lat: 1, lng: 2 })?.bron).toBe('adres')
    expect(geocodeerTerugval({ plaats: 'Assen' })).toMatchObject({ bron: 'plaats', lat: 52.99 })
    expect(geocodeerTerugval({ postcode: '9401 AB', plaats: 'Onbekendorp' })?.bron).toBe('postcode')
    expect(geocodeerTerugval({ plaats: 'Den Bosch' })?.lat).toBe(51.69)
    expect(geocodeerTerugval({ postcode: '1000', plaats: 'Brussel', land: 'BE' })).toBeNull()
    expect(geocodeerTerugval({})).toBeNull()
  })
})

describe('omrijMinuten en vrijeMomenten', () => {
  it('kandidaat op de route is 0; lege route vanaf de thuisbasis is heen en terug', () => {
    expect(omrijMinuten([AMERSFOORT, ASSEN], ASSEN).minuten).toBe(0)
    expect(omrijMinuten([AMERSFOORT], ASSEN).minuten).toBe(schatReistijd(AMERSFOORT, ASSEN).minuten * 2)
    expect(omrijMinuten([], ASSEN).minuten).toBe(0)
  })
  it('gaten in de werkdag; overlap telt als bezet', () => {
    const g = vrijeMomenten([...stops, { id: 's3', start: '2026-10-15T08:30:00Z', eind: '2026-10-15T09:30:00Z', punt: null }], { start: '2026-10-15T06:00:00Z', eind: '2026-10-15T16:00:00Z' })
    expect(g.map((x) => x.minuten)).toEqual([120, 150, 180])
    expect(vrijeMomenten([], { start: '2026-10-15T06:00:00Z', eind: '2026-10-15T16:00:00Z' })).toHaveLength(1)
  })
})

describe('kansScore', () => {
  it('elke bijdrage staat in de opbouw; ritme achter begrensd op +30', () => {
    const r = kansScore(25, [{ soort: 'bezoektaak', label: '' }, { soort: 'ritme', label: '', dagenAchter: 120 }], 12, true)
    expect(r.score).toBe(25 + 100 + 30 + 10 - 12)
    expect(r.opbouw.map((o) => o.punten)).toEqual([25, 100, 30, 10, -12])
  })
})

describe('kansenLangsRoute', () => {
  it('acceptatie 6: open bezoektaak op 8 minuten wint van een hete aanleiding op 25 minuten', () => {
    const taak = kand('taak', bij(ASSEN, 4))
    const heet = kand('heet', bij(ASSEN, 12.5), { bronnen: [{ soort: 'aanleiding', label: 'Hete aanleiding', relevantie: 100 }] })
    const k = kansenLangsRoute(thuis, [heet, taak], filters())
    expect(k.map((x) => x.id)).toEqual(['taak', 'heet'])
    expect(k[0]!.omrij).toBe(8)
    expect(k[1]!.omrij).toBeGreaterThanOrEqual(24)
  })
  it('acceptatie 8: account van een collega niet, tenzij de filter uit staat; overgeslagen niet; klaargezet wel', () => {
    const c = kand('collega', bij(ASSEN, 1), { ownerId: 'ander' })
    const kz = kand('klaar', bij(ASSEN, 1), { ownerId: 'ander', bronnen: [{ soort: 'klaargezet', label: 'Klaargezet door Sanne' }] })
    expect(kansenLangsRoute(route, [c, kz], filters()).map((x) => x.id)).toEqual(['klaar'])
    expect(kansenLangsRoute(route, [c, kz], filters({ alleenMijn: false })).map((x) => x.id).sort()).toEqual(['collega', 'klaar'])
    expect(kansenLangsRoute(route, [c, kz], filters({ alleenMijn: false, overgeslagen: new Set(['collega']) })).map((x) => x.id)).toEqual(['klaar'])
  })
  it('acceptatie 10: klaargezet weegt +90', () => {
    const k = kansenLangsRoute(route, [kand('k', ASSEN, { bronnen: [{ soort: 'klaargezet', label: '' }] })], filters())[0]!
    expect(k.opbouw.find((o) => o.label === 'klaargezet')?.punten).toBe(90)
  })
  it('acceptatie 9: zonder routedienst de schatting met label', () => {
    const k = kansenLangsRoute(route, [kand('a', bij(ASSEN, 3))], filters())[0]!
    expect(k.schatting).toBe(true)
    const echt = kansenLangsRoute(route, [kand('a', bij(ASSEN, 3))], filters(), undefined, (a, b) => ({ ...schatReistijd(a, b), schatting: false }))[0]!
    expect(echt.schatting).toBe(false)
  })
  it('uitgesloten: in de route, nee, afkoeling op bezoek, klant bij alleen prospects, zonder bron, buiten de omrijtijd', () => {
    const lijst = [
      kand('route', ASSEN), kand('nee', ASSEN, { nbStatus: 'nee' }), kand('koel', ASSEN, { afkoelingBezoekTot: '2026-12-01' }), kand('klant', ASSEN, { soort: 'klant' }),
      kand('zonder', ASSEN, { bronnen: [] }), kand('ver', { lat: 51.44, lng: 5.48 }), kand('goed', ASSEN),
    ]
    expect(kansenLangsRoute(route, lijst, filters({ inRoute: new Set(['route']) })).map((x) => x.id)).toEqual(['goed'])
  })
  it('in de regio van de dag tot tweemaal de omrijtijd; erbuiten alleen binnen de grens', () => {
    const p = bij(ASSEN, 7.5) // 15 minuten omrijden
    expect(kansenLangsRoute(thuis, [kand('a', p, { regioId: 'noord' })], filters({ maxOmrij: 10, regioId: 'noord' }))).toHaveLength(1)
    expect(kansenLangsRoute(thuis, [kand('a', p, { regioId: 'oost' })], filters({ maxOmrij: 10, regioId: 'noord' }))).toHaveLength(0)
  })
  it('beste moment in het gat, en de plek tussen de stops', () => {
    const k = kansenLangsRoute(route, [kand('a', bij(ASSEN, 1))], filters())[0]!
    expect(k.tussen).toMatch(/stop/)
    expect(k.moment).toMatch(/min vrij tussen/)
  })
  it('acceptatie 11: 600 accounts en 6 stops onder 800 ms', () => {
    const zes = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, start: `2026-10-15T0${6 + i}:00:00Z`, eind: `2026-10-15T0${6 + i}:45:00Z`, punt: { lat: 52.5 + i * 0.08, lng: 6 + i * 0.1 } }))
    const r = { punten: [AMERSFOORT, ...zes.map((s) => s.punt), AMERSFOORT], stops: zes, gaten: vrijeMomenten(zes, { start: '2026-10-15T06:00:00Z', eind: '2026-10-15T16:00:00Z' }) }
    const veel = Array.from({ length: 600 }, (_, i) => kand(`a${i}`, { lat: 52 + (i % 30) * 0.04, lng: 5.3 + Math.floor(i / 30) * 0.08 }, { bronnen: [{ soort: i % 2 ? 'bezoektaak' : 'ritme', label: '', dagenAchter: i % 40 }] }))
    const t = performance.now()
    const k = kansenLangsRoute(r, veel, filters({ aantal: 10 }))
    expect(performance.now() - t).toBeLessThan(800)
    expect(k).toHaveLength(10)
  })
})

describe('bellijst, statistiek en kaartlink', () => {
  it('gat 30: alleen de bezoeken van dezelfde dag eruit', () => {
    const l = [{ accountId: 'a' }, { accountId: 'b' }, { accountId: 'c' }]
    expect(bellijstNaastBezoeken(l, new Set(['b']), 5).map((x) => x.accountId)).toEqual(['a', 'c'])
  })
  it('dagstatistiek telt klantcontact en rijtijd', () => {
    const s = dagStatistiek(route.punten, stops)
    expect(s.bezoeken).toBe(2); expect(s.contactMin).toBe(120); expect(s.rijMin).toBeGreaterThan(200)
  })
  it('kaartlink per app', () => {
    expect(kaartLink({ adres: 'Testlaan 12, Assen' })).toContain('google.com/maps/dir')
    expect(kaartLink({ punt: ASSEN }, 'waze')).toContain('waze.com/ul?ll=52.99,6.56')
    expect(kaartLink({ adres: 'Testlaan 12' }, 'apple')).toContain('maps.apple.com')
    expect(kaartLink({})).toBeNull()
  })
})
