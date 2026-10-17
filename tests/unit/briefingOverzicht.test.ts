import { describe, expect, it } from 'vitest'
import { compleetheid, compleetTekst, dagKop, inPeriode, maandagVan, periodeGrenzen, telPerPeriode } from '../../shared/briefingOverzicht'
import { soortReden } from '../../shared/briefing'

// Zaterdag 17 oktober 2026: deze week loopt tot zondag 18, volgende week van 19 tot en met 25 oktober.
const VANDAAG = '2026-10-17'

describe('periodes op /briefings', () => {
  it('maandag van de week', () => {
    expect(maandagVan(VANDAAG)).toBe('2026-10-12')
    expect(maandagVan('2026-10-19')).toBe('2026-10-19')
    expect(maandagVan('2026-10-25')).toBe('2026-10-19')
  })
  it('deze week en vandaag tellen achterstallig mee, volgende week niet', () => {
    expect(inPeriode('2026-10-09', 'week', VANDAAG)).toBe(true)
    expect(inPeriode('2026-10-09', 'vandaag', VANDAAG)).toBe(true)
    expect(inPeriode('2026-10-18', 'week', VANDAAG)).toBe(true)
    expect(inPeriode('2026-10-19', 'week', VANDAAG)).toBe(false)
    expect(inPeriode('2026-10-19', 'volgende', VANDAAG)).toBe(true)
    expect(inPeriode('2026-10-26', 'volgende', VANDAAG)).toBe(false)
    expect(inPeriode('2026-10-18', 'morgen', VANDAAG)).toBe(true)
    expect(periodeGrenzen('volgende', VANDAAG)).toEqual({ van: '2026-10-19', tot: '2026-10-25' })
  })
  it('zonder datum alleen bij Alle; Van tot is inclusief', () => {
    expect(inPeriode(null, 'alle', VANDAAG)).toBe(true)
    expect(inPeriode(null, 'week', VANDAAG)).toBe(false)
    expect(inPeriode('2026-10-20', 'vantot', VANDAAG, { van: '2026-10-20', tot: '2026-10-20' })).toBe(true)
    expect(inPeriode('2026-10-21', 'vantot', VANDAAG, { van: '2026-10-20', tot: '2026-10-20' })).toBe(false)
  })
  it('tellers per periode', () => {
    expect(telPerPeriode(['2026-10-10', '2026-10-17', '2026-10-18', '2026-10-20', null], VANDAAG)).toEqual({ alle: 5, vandaag: 2, morgen: 1, week: 3, volgende: 1 })
  })
})

describe('kaart', () => {
  it('compleetheid in woorden met het eerste gat', () => {
    const c = compleetheid([{ sleutel: 'bedrijf', titel: 'Bedrijf', tekst: 'X.' }, { sleutel: 'huidig', titel: 'Huidige situatie', tekst: 'Nog niet bekend.' }, { sleutel: 'doel', titel: 'Doel', tekst: 'Y' }])
    expect(c).toEqual({ bekend: 2, totaal: 3, gat: 'Huidige situatie is nog niet bekend' })
    expect(compleetTekst(c)).toBe('2 van 3 blokken bekend')
    const vol = compleetheid([{ sleutel: 'ontbreekt', titel: 'Wie ontbreekt nog', tekst: 'Nog geen beslisser, champion.' }])
    expect(vol.gat).toBe('Wie ontbreekt: beslisser, champion')
    expect(compleetTekst(vol)).toBe('Alle 1 blokken bekend')
  })
  it('dagkoppen: achterstallig, vandaag, morgen en de datum', () => {
    expect(dagKop('2026-10-15', VANDAAG)).toMatchObject({ titel: 'Achterstallig', rood: true })
    expect(dagKop(VANDAAG, VANDAAG).titel).toBe('Vandaag · zaterdag 17 oktober')
    expect(dagKop('2026-10-18', VANDAAG).titel).toBe('Morgen · zondag 18 oktober')
    expect(dagKop('2026-10-19', VANDAAG).titel).toBe('Maandag 19 oktober')
    expect(dagKop(null, VANDAAG).titel).toBe('Zonder datum')
  })
  it('de reden van de soort volgt kiesBriefingSoort', () => {
    expect(soortReden({ gesprekken: 0 })).toBe('je sprak nog geen beslisser')
    expect(soortReden({ gesprekken: 3 })).toBe('er zijn 3 gesprekken geweest')
    expect(soortReden({ gesprekken: 1, beslisserGesproken: true })).toBe('je sprak de beslisser en er is één gesprek geweest')
    expect(soortReden({ gesprekken: 0, meetingsoortVorm: 'bezoek' })).toBe('de afspraak is op locatie')
    expect(soortReden({ gesprekken: 0, vastgezet: 'verdieping' })).toBe('je hebt de soort vastgezet')
  })
})
