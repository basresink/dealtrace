// P23: suggesties naar SalesDNA. Namenfilter (C.9 punt 9), hooguit 10 per sublaag (precies 10 en 11),
// de drempels per kandidaat, Voltvast br-02 zonder eigen belofte, geen winpunttekst (11.2) en de ISO-week.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { anonimiseer, bevatNaam, bundelSuggesties, isoWeek, kandidatenBezwaar, kandidatenBrancheBelofte, kandidatenConcurrent, kandidatenTerugkomregel, kandidatenWinpunt, volgendeWeek } from '../../shared/suggesties'
import { verkoopverhaalUitSeed } from '../../shared/verkoopverhaal'

const stand = verkoopverhaalUitSeed(JSON.parse(readFileSync('seed/voltvast.json', 'utf8')).verkoopverhaal)
const nu = new Date('2026-11-12T10:00:00Z')

describe('namenfilter', () => {
  const namen = [{ naam: 'Hilde Testbrontsma' }]
  it('een contactnaam uit aantekeningen wordt gevonden, ook in andere hoofdletters', () => {
    expect(bevatNaam('Volgens hilde werkt het antwoord', namen)).toBe(true)
    expect(bevatNaam('TESTBRONTSMA zei ja', namen)).toBe(true)
  })
  it('een naam als deel van een woord telt niet', () => {
    expect(bevatNaam('Hildegard en Testbrontsmaweg', namen)).toBe(false)
    expect(bevatNaam('Geen namen hier', namen)).toBe(false)
  })
  it('citaten worden geanonimiseerd', () => {
    expect(anonimiseer(['Hilde zei: te duur'], [{ naam: 'Hilde Testbrontsma', rol: 'de beslisser' }])).toEqual(['de beslisser zei: te duur'])
  })
})

describe('bundelSuggesties', () => {
  const k = (onderwerpId: string, kracht: number) => ({ onderwerpId, kracht })
  it('precies 10 gaan mee; de elfde schuift door, sterkste eerst', () => {
    const tien = Array.from({ length: 10 }, (_, i) => k('L0.8', i))
    expect(bundelSuggesties(tien).bundel).toHaveLength(10)
    const elf = [...tien, k('L0.8', -1)]
    const r = bundelSuggesties(elf)
    expect(r.bundel).toHaveLength(10)
    expect(r.over).toEqual([k('L0.8', -1)])
  })
  it('per sublaag apart; al gebruikt telt mee; lege invoer', () => {
    const r = bundelSuggesties([k('L0.8', 1), k('L0.4', 2), k('L0.4', 3)], 10, { 'L0.4': 9 })
    expect(r.bundel.map((x) => x.kracht).sort()).toEqual([1, 3])
    expect(r.over).toEqual([k('L0.4', 2)])
    expect(bundelSuggesties([])).toEqual({ bundel: [], over: [] })
  })
})

describe('kandidaten', () => {
  it('concurrent: pas bij 5 verslagen in 90 dagen en alleen als hij ontbreekt', () => {
    const v = (dagen: number, c: string[]) => ({ op: new Date(nu.getTime() - dagen * 864e5).toISOString(), concurrenten: c })
    const vier = [1, 2, 3, 4].map((d) => v(d, ['Kabel Express']))
    expect(kandidatenConcurrent(vier, stand.concurrenten, nu)).toEqual([])
    const vijf = [...vier, v(5, ['kabel express'])]
    const r = kandidatenConcurrent(vijf, stand.concurrenten, nu)
    expect(r).toHaveLength(1)
    expect(r[0]!.tekst).toBe('Kabel Express kwam in 5 verslagen van de laatste 90 dagen voor, maar staat nog niet bij de concurrenten.')
    expect(kandidatenConcurrent([...vier, v(120, ['Kabel Express'])], stand.concurrenten, nu)).toEqual([])
    const bekend = stand.concurrenten[0]!.naam
    expect(kandidatenConcurrent([1, 2, 3, 4, 5].map((d) => v(d, [bekend])), stand.concurrenten, nu)).toEqual([])
  })
  it('bezwaar: minder dan 30 gesprekken of geen betere conversie telt niet', () => {
    const basis = { gesprekken: 100, afspraken: 10 }
    expect(kandidatenBezwaar([{ bezwaar: 'Te duur', gesprekken: 29, afspraken: 20 }], basis)).toEqual([])
    expect(kandidatenBezwaar([{ bezwaar: 'Te duur', gesprekken: 40, afspraken: 3 }], basis)).toEqual([])
    const r = kandidatenBezwaar([{ bezwaar: 'Te duur', gesprekken: 30, afspraken: 6 }], basis)
    expect(r[0]!.tekst).toBe('Het antwoord op "Te duur" werkt: 30 gesprekken met dit bezwaar gaven 6 afspraken (20 procent, zonder dit bezwaar 10 procent).')
  })
  it('Voltvast: 38 gesprekken in br-02 zonder eigen blok in L0.4 geeft de suggestie; br-01 heeft er een', () => {
    const r = kandidatenBrancheBelofte([
      { brancheId: 'br-01', naam: 'Installatiebedrijven woningbouw', gesprekken: 50, kwartaal: '2026-K4' },
      { brancheId: 'br-02', naam: 'Utiliteitsinstallateurs', gesprekken: 38, kwartaal: '2026-K4' },
      { brancheId: 'br-03', naam: 'Klein', gesprekken: 19, kwartaal: '2026-K4' },
    ], (stand.teksten ?? []).map((t) => ({ sublaag: t.sublaag, brancheId: t.brancheId })))
    expect(r.map((x) => x.tekst)).toEqual(['38 gesprekken in Utiliteitsinstallateurs dit kwartaal, nog geen eigen belofte'])
    expect(r[0]).toMatchObject({ onderwerpId: 'L0.4', regelExternId: 'br-02' })
  })
  it('winpunt: alleen cijfers, nooit een nieuwe winpunttekst; terugkomregel vanaf 5 accounts', () => {
    const w = kandidatenWinpunt([{ winpuntId: 'wp-01', titel: 'Gratis projectschouw', gesprekken: 40, afspraken: 8 }])
    expect(w[0]!.tekst).toBe('Winpunt "Gratis projectschouw": 40 gesprekken, 8 afspraken (20 procent).')
    expect(kandidatenWinpunt([{ winpuntId: 'wp-01', titel: 'x', gesprekken: 29, afspraken: 8 }])).toEqual([])
    expect(kandidatenTerugkomregel([{ regelId: 'hc-03', reden: 'Prijs te hoog', terug: 4, afspraken: 1 }])).toEqual([])
    expect(kandidatenTerugkomregel([{ regelId: 'hc-03', reden: 'Prijs te hoog', terug: 5, afspraken: 1 }])[0]!.tekst).toBe('Terugkomregel "Prijs te hoog": 5 accounts kwamen terug, 1 afspraak.')
  })
})

describe('week', () => {
  it('ISO-week en de week erna, ook over de jaargrens', () => {
    expect(isoWeek(nu)).toBe('2026-W46')
    expect(volgendeWeek('2026-W46')).toBe('2026-W47')
    expect(isoWeek(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53')
    expect(volgendeWeek('2026-W53')).toBe('2027-W01')
  })
})
