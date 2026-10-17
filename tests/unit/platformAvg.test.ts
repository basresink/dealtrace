// Pakket C, klantflyout van Platformbeheer: AVG-verzoeken (kenmerk zonder persoonsgegevens, termijn 30 dagen,
// over tijd), opzeggen (einddatum, reden, naam overgetypt) en de standaard einddatum.
import { describe, expect, it } from 'vitest'
import { AVG_TERMIJN_DAGEN, dagenTot, grootteTekst, isDatum, kenmerkFout, plusDagen, standaardEinddatum, valideerOpzegging, valideerVerzoek, verzoekStand } from '../../shared/platformAvg'

describe('AVG-verzoeken', () => {
  it('kenmerk: verplicht, kort, geen e-mailadres en geen telefoonnummer', () => {
    expect(kenmerkFout('')).toMatch(/kenmerk/)
    expect(kenmerkFout('T-1042')).toBeNull()
    expect(kenmerkFout('jan@voorbeeld.test')).toMatch(/e-mailadres/)
    expect(kenmerkFout('bel 06 12345678')).toMatch(/telefoonnummer/)
    expect(kenmerkFout('x'.repeat(61))).toMatch(/60/)
  })
  it('een verzoek heeft een soort, een kenmerk en een ontvangstdatum die niet in de toekomst ligt', () => {
    expect(valideerVerzoek({ soort: 'betrokkene-verwijderen', kenmerk: 'T-1', ontvangenOp: '2026-10-17' }, '2026-10-17')).toEqual([])
    expect(valideerVerzoek({ soort: 'iets', kenmerk: 'T-1', ontvangenOp: '2026-10-17' }, '2026-10-17')).toEqual(['Kies de soort verzoek'])
    expect(valideerVerzoek({ soort: 'betrokkene-inzage', kenmerk: 'T-1', ontvangenOp: '2026-10-18' }, '2026-10-17')[0]).toMatch(/toekomst/)
    expect(valideerVerzoek({ soort: 'betrokkene-inzage', kenmerk: 'T-1', ontvangenOp: '2026-02-30' }, '2026-10-17')[0]).toMatch(/datum/)
  })
  it('termijn 30 dagen: open tot en met de termijn, daarna over tijd; afgehandeld blijft afgehandeld', () => {
    const termijnOp = plusDagen('2026-10-01', AVG_TERMIJN_DAGEN)
    expect(termijnOp).toBe('2026-10-31')
    expect(verzoekStand({ status: 'open', termijnOp }, '2026-10-31')).toBe('open')
    expect(verzoekStand({ status: 'open', termijnOp }, '2026-11-01')).toBe('over_tijd')
    expect(verzoekStand({ status: 'afgehandeld', termijnOp }, '2026-12-01')).toBe('afgehandeld')
    expect(dagenTot(termijnOp, '2026-10-17')).toBe(14)
    expect(dagenTot(termijnOp, '2026-11-02')).toBe(-2)
  })
})

describe('opzeggen', () => {
  const naam = 'Testorganisatie Tweede'
  it('vraagt een laatste dag vanaf vandaag, een reden en de naam letterlijk', () => {
    expect(valideerOpzegging({ einddatum: '2026-11-30', reden: 'Stopt', naam }, naam, '2026-10-17')).toEqual([])
    expect(valideerOpzegging({ einddatum: '2026-10-16', reden: 'Stopt', naam }, naam, '2026-10-17')).toEqual(['De laatste dag ligt in het verleden'])
    expect(valideerOpzegging({ einddatum: '2026-11-30', reden: '', naam }, naam, '2026-10-17')).toEqual(['Geef de reden van opzeggen'])
    expect(valideerOpzegging({ einddatum: '2026-11-30', reden: 'Stopt', naam: 'testorganisatie tweede' }, naam, '2026-10-17')).toEqual(['Typ de naam van de organisatie precies over'])
  })
  it('standaard einddatum: einde van de lopende contractperiode, minstens de opzegtermijn verder', () => {
    expect(standaardEinddatum({ start: '2026-01-01', looptijdMaanden: 12, opzegtermijnMaanden: 1 }, '2026-10-17')).toBe('2026-12-31')
    expect(standaardEinddatum({ start: '2026-01-01', looptijdMaanden: 12, opzegtermijnMaanden: 1 }, '2026-12-15')).toBe('2027-12-31')
    expect(standaardEinddatum({ opzegtermijnMaanden: 2 }, '2026-10-17')).toBe('2026-12-17')
  })
})

describe('hulpjes', () => {
  it('datum, grootte', () => {
    expect(isDatum('2026-10-17')).toBe(true)
    expect(isDatum('17-10-2026')).toBe(false)
    expect(grootteTekst(512)).toBe('512 B')
    expect(grootteTekst(2048)).toBe('2 kB')
    expect(grootteTekst(1572864)).toBe('1,5 MB')
  })
})
