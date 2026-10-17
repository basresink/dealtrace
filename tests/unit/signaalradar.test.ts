import { describe, expect, it } from 'vitest'
import { capaciteitTekst, celSleutel, factorTekst, golfOordeel, normaal, periodeVan, plekkenInBlokken, RADAR, SIGNAALSOORTEN, signaalsoortVan, telbaar, telCellen, winpuntVoorGolf, type RadarSignaal } from '../../shared/signaalradar'
import type { VastBlok } from '../../shared/belblokken'
import type { Winpunt } from '../../shared/verkoopverhaal'

const nu = new Date('2026-10-14T10:00:00Z')
const dagenTerug = (d: number) => new Date(nu.getTime() - d * 864e5).toISOString()

describe('signaalsoort', () => {
  it('vaste lijst met overig als laatste', () => {
    expect(SIGNAALSOORTEN).toEqual(['vacatures', 'nieuwe-vestiging', 'nieuwbouw-vergunning', 'directiewissel', 'subsidie-regeling', 'overname', 'overig'])
  })
  it('een vastgelegde soort gaat voor; anders afgeleid uit type en tekst', () => {
    expect(signaalsoortVan({ signaalsoort: 'overname', type: 'vacature', title: 'Zoekt monteurs' })).toBe('overname')
    expect(signaalsoortVan({ type: 'vacature', title: 'Twee functies open' })).toBe('vacatures')
    expect(signaalsoortVan({ type: 'nieuws', title: 'Testbedrijf zoekt drie servicemonteurs' })).toBe('vacatures')
    expect(signaalsoortVan({ type: 'kvk', title: 'Opent een nieuwe vestiging in Testdorp' })).toBe('nieuwe-vestiging')
    expect(signaalsoortVan({ type: 'nieuws', title: 'Omgevingsvergunning voor bedrijfshal verleend' })).toBe('nieuwbouw-vergunning')
    expect(signaalsoortVan({ type: 'aanbesteding', title: 'Onderhoud installaties' })).toBe('nieuwbouw-vergunning')
    expect(signaalsoortVan({ type: 'nieuws', title: 'Nieuwe directeur treedt aan' })).toBe('directiewissel')
    expect(signaalsoortVan({ type: 'nieuws', title: 'Toekenning regeling verduurzaming' })).toBe('subsidie-regeling')
    expect(signaalsoortVan({ type: 'nieuws', title: 'Testgroep neemt installateur over' })).toBe('overname')
    expect(signaalsoortVan({ type: 'website', title: 'Nieuwe website online' })).toBe('overig')
    expect(signaalsoortVan({ signaalsoort: 'onzin', type: 'website', title: 'Iets' })).toBe('overig')
  })
  it('telt alleen inzichten met bron die niet zijn afgewezen of tegengehouden', () => {
    expect(telbaar({ bron: 'extern', agent: 'waarnemer', status: 'nieuw' })).toBe(true)
    expect(telbaar({ bron: 'intern', agent: 'handmatig', status: 'omgezet' })).toBe(true)
    expect(telbaar({ bron: 'intern', agent: null, status: 'nieuw' })).toBe(false)
    expect(telbaar({ bron: 'extern', agent: 'waarnemer', status: 'afgewezen' })).toBe(false)
    expect(telbaar({ bron: 'extern', agent: 'waarnemer', status: 'tegengehouden' })).toBe(false)
  })
})

describe('perioden en normaal', () => {
  it('periode 0 is de laatste 30 dagen, 1 tot en met 6 daarvoor, ouder telt niet', () => {
    expect(periodeVan(dagenTerug(0), nu)).toBe(0)
    expect(periodeVan(dagenTerug(29.9), nu)).toBe(0)
    expect(periodeVan(dagenTerug(30), nu)).toBe(1)
    expect(periodeVan(dagenTerug(209), nu)).toBe(6)
    expect(periodeVan(dagenTerug(211), nu)).toBeNull()
  })
  it('normaal is het gemiddelde van zes perioden; ontbrekende perioden tellen als nul', () => {
    expect(normaal([3, 3, 3, 3, 3, 3])).toBe(3)
    expect(normaal([6])).toBe(1)
    expect(normaal([])).toBe(0)
  })
})

describe('golf', () => {
  it('vanaf 1,5 keer normaal en minstens 5 accounts', () => {
    expect(golfOordeel(5, 2)).toMatchObject({ golf: true, niveau: 'golf', factor: 2.5 })
    expect(golfOordeel(6, 2)).toMatchObject({ golf: true, niveau: 'sterk' })
    expect(golfOordeel(6, 4)).toMatchObject({ golf: true, niveau: 'golf' })
    expect(golfOordeel(5, 0)).toMatchObject({ golf: true, niveau: 'sterk', factor: null })
  })
  it('geen golf met te weinig accounts of te dicht bij normaal, met de reden', () => {
    const weinig = golfOordeel(4, 1)
    expect(weinig).toMatchObject({ golf: false, niveau: 'verhoogd' })
    expect(weinig.reden).toContain('minstens 5 accounts')
    const normaalNiveau = golfOordeel(7, 6)
    expect(normaalNiveau).toMatchObject({ golf: false, niveau: 'normaal' })
    expect(normaalNiveau.reden).toContain('1,5 keer normaal')
    expect(golfOordeel(0, 2).niveau).toBe('leeg')
  })
  it('factor als tekst met een komma', () => {
    expect(factorTekst(2.6)).toBe('2,6 keer normaal')
    expect(factorTekst(2)).toBe('2 keer normaal')
    expect(factorTekst(null)).toBe('nieuw')
  })
})

describe('tellen per cel', () => {
  const sig = (id: string, account: string, branche: string | null, soort: RadarSignaal['soort'], dagen: number): RadarSignaal => ({ id, accountId: account, brancheId: branche, soort, createdAt: dagenTerug(dagen) })
  it('een account telt één keer per periode; normaal uit de zes perioden ervoor', () => {
    const s: RadarSignaal[] = [
      ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((a, i) => sig(`n${i}`, a, 'br-1', 'vacatures', 3 + i)),
      sig('dubbel', 'a1', 'br-1', 'vacatures', 10),
      ...Array.from({ length: RADAR.perioden }, (_, p) => sig(`h${p}`, `h${p}`, 'br-1', 'vacatures', 35 + p * 30)),
      ...Array.from({ length: RADAR.perioden }, (_, p) => sig(`g${p}`, `g${p}`, 'br-1', 'vacatures', 40 + p * 30)),
      sig('oud', 'x', 'br-1', 'vacatures', 400),
      sig('ander', 'b1', 'br-2', 'overname', 2),
    ]
    const cellen = telCellen(s, nu)
    const c = cellen.get(celSleutel('br-1', 'vacatures'))!
    expect(c.aantal).toBe(6)
    expect(c.signalen).toBe(7)
    expect(c.perPeriode).toEqual([2, 2, 2, 2, 2, 2])
    expect(c.normaal).toBe(2)
    expect(c.oordeel.golf).toBe(true)
    expect(c.oordeel.factor).toBe(3)
    expect(c.accountIds.sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
    expect(cellen.get(celSleutel('br-2', 'overname'))!.oordeel).toMatchObject({ golf: false, niveau: 'verhoogd' })
  })
})

describe('winpunt bij een golf', () => {
  const wp = (id: string, titel: string, omschrijving: string, extra: Partial<Winpunt> = {}): Winpunt => ({ id, titel, omschrijving, faseId: null, weging: 1, onderNorm: false, actief: true, ...extra })
  const winpunten = [wp('w1', 'Gratis projectschouw binnen 48 uur', 'Een specialist kijkt op het project.', { impact: 'hoog' }), wp('w2', 'Levering op het uur', 'We leveren op het afgesproken uur.', { impact: 'midden' }), wp('w3', 'Oud', 'Niet meer', { actief: false })]
  it('eerst het winpunt van de branche, dan een winpunt dat bij de soort past, dan winpuntVoor', () => {
    expect(winpuntVoorGolf('vacatures', 'br-1', winpunten, [{ winpuntId: 'w1', brancheId: 'br-1' }]).winpunt?.id).toBe('w1')
    expect(winpuntVoorGolf('vacatures', 'br-1', winpunten).winpunt?.id).toBe('w2')
    expect(winpuntVoorGolf('nieuwbouw-vergunning', 'br-1', winpunten).winpunt?.id).toBe('w1')
    const terugval = winpuntVoorGolf('overig', 'br-1', winpunten)
    expect(terugval.winpunt?.id).toBe('w1')
    expect(terugval.reden).toContain('sterkste')
    expect(winpuntVoorGolf('vacatures', 'br-1', [winpunten[2]!]).winpunt).toBeNull()
  })
})

describe('capaciteit in de komende belblokken', () => {
  const blok = (b: Partial<VastBlok>): VastBlok => ({ id: 'b', dagen: [1, 2, 3, 4], start: '09:00', minuten: 90, plek: 'Kantoor', soort: 'koud', automatisch: false, ...b })
  it('telt koude en gemengde blokken op werkdagen, niet opvolging', () => {
    const maandag = new Date('2026-10-12T06:00:00Z')
    const r = plekkenInBlokken([blok({}), blok({ id: 'o', soort: 'opvolging' })], maandag, 14)
    expect(r.momenten).toBe(8)
    expect(r.plekken).toBe(8 * 8)
    const gemengd = plekkenInBlokken([blok({ soort: 'gemengd', verhouding: 50, dagen: [5], minuten: 60 })], maandag, 7)
    expect(gemengd).toEqual({ momenten: 1, plekken: 2 })
  })
  it('zegt of het past, deels past of niet', () => {
    expect(capaciteitTekst({ eigen: 6, collegas: 0, plekken: 40, bezet: 22 })).toMatchObject({ past: 'ja' })
    expect(capaciteitTekst({ eigen: 6, collegas: 0, plekken: 40, bezet: 22 }).tekst).toContain('18 van 40 plekken vrij')
    expect(capaciteitTekst({ eigen: 6, collegas: 2, plekken: 10, bezet: 7 })).toMatchObject({ past: 'deels' })
    expect(capaciteitTekst({ eigen: 3, collegas: 0, plekken: 0, bezet: 0 }).tekst).toContain('geen belblok')
    expect(capaciteitTekst({ eigen: 0, collegas: 4, plekken: 20, bezet: 0 })).toMatchObject({ past: 'nee' })
    // Vol: geen enkele plek vrij is niet "past deels".
    expect(capaciteitTekst({ eigen: 5, collegas: 0, plekken: 70, bezet: 83 })).toMatchObject({ past: 'nee' })
    expect(capaciteitTekst({ eigen: 5, collegas: 0, plekken: 70, bezet: 83 }).tekst).toMatch(/^Past niet: .*zitten vol/)
  })
})
