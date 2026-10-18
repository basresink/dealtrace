// BAND uit de gespreksverslagen: voorstellen per letter uit de analyse van de Notulist, met citaat en herkomst.
import { describe, expect, it } from 'vitest'
import { bandAiUitAntwoord, bandUitAnalyse, bandVoorstellen, bandVoorstellenMetAi, mockBandInvulling, type BandAiVerslag } from '../../shared/bandUitVerslag'

const analyse = {
  samenvatting: 'De prospect verliest tijd doordat monteurs wachten op materiaal. De directeur beslist samen met de inkoper.',
  koopsignalen: ['Ze hebben budget voor volgend jaar', 'Wil starten voor de zomer'],
  bezwaren: [],
  perAgendapunt: [{ punt: 'Behoefte', samenvatting: 'Vaste levermomenten per bouwfase.' }],
}

describe('bandUitAnalyse', () => {
  it('leest budget, autoriteit, behoefte en timing uit een oudere analyse', () => {
    const b = bandUitAnalyse(analyse)
    expect(b.behoefte).toEqual({ ja: true, citaat: 'Vaste levermomenten per bouwfase.' })
    expect(b.autoriteit?.citaat).toContain('directeur beslist')
    expect(b.draagvlak?.citaat).toContain('budget')
    expect(b.noodzaak?.ja).toBe(true)
  })
  it('een bezwaar als geen budget wordt een nee', () => {
    expect(bandUitAnalyse({ bezwaren: ['Er is geen budget dit jaar'] }).draagvlak).toEqual({ ja: false, citaat: 'Er is geen budget dit jaar' })
  })
  it('een nieuwe analyse met het veld band wint', () => {
    expect(bandUitAnalyse({ ...analyse, band: { autoriteit: { oordeel: 'nee', citaat: 'De eigenaar is niet bereikbaar' } } })).toEqual({ autoriteit: { ja: false, citaat: 'De eigenaar is niet bereikbaar' } })
  })
})

describe('bandVoorstellen', () => {
  const bronnen = [
    { id: 'oud', soort: 'afspraak' as const, titel: 'Kennismaking', datum: '2026-09-01T10:00:00Z', analyse: { koopsignalen: ['Wil een leverplan zien'] } },
    { id: 'nieuw', soort: 'taak' as const, titel: 'Belgesprek', datum: '2026-10-01T10:00:00Z', analyse },
  ]
  it('de nieuwste analyse wint; een ingevulde letter krijgt geen voorstel', () => {
    const v = bandVoorstellen(bronnen, { behoefte: { ja: false, bron: 'hand' } })
    expect(v.map((x) => x.letter)).toEqual(['autoriteit', 'noodzaak', 'draagvlak'])
    expect(v[0]!.bron).toEqual({ id: 'nieuw', soort: 'taak', titel: 'Belgesprek', datum: '2026-10-01T10:00:00Z' })
  })
  it('een verworpen voorstel komt alleen terug met een nieuwer verslag', () => {
    const verworpen = { autoriteit: { bronId: 'nieuw', op: '2026-10-02T10:00:00Z' } }
    expect(bandVoorstellen(bronnen, {}, verworpen).some((x) => x.letter === 'autoriteit')).toBe(false)
    const later = [...bronnen, { id: 'later', soort: 'afspraak' as const, titel: 'Vervolg', datum: '2026-10-10T10:00:00Z', analyse: { samenvatting: 'De eigenaar beslist.' } }]
    expect(bandVoorstellen(later, {}, verworpen).find((x) => x.letter === 'autoriteit')?.bron.id).toBe('later')
  })
})

describe('Vul in met AI (bandInvulling)', () => {
  const verslagen: BandAiVerslag[] = [
    { nr: 'V1', bron: { id: 't1', soort: 'taak', titel: 'Bel over de levering', datum: '2026-10-12T09:00:00Z' }, tekst: 'De directeur beslist zelf over de keuze. Ze hebben budget vrijgemaakt.' },
    { nr: 'V2', bron: { id: 'tr1', soort: 'transcript', titel: 'Kennismaking', datum: '2026-10-01T09:00:00Z' }, tekst: 'Ze willen starten voor de zomer.' },
  ]
  it('de mock geeft per onderdeel een letterlijk citaat met het verslag', () => {
    const r = mockBandInvulling({ verslagen })
    expect(r.voorstellen.find((v) => v.onderdeel === 'autoriteit')).toMatchObject({ oordeel: 'ja', verslag: 'V1' })
    expect(r.voorstellen.find((v) => v.onderdeel === 'noodzaak')).toMatchObject({ verslag: 'V2', citaat: 'Ze willen starten voor de zomer.' })
  })
  it('alleen een citaat dat letterlijk in dat verslag staat, en geen voorstel voor een ingevulde letter', () => {
    const uit = bandAiUitAntwoord({ voorstellen: [
      { onderdeel: 'autoriteit', oordeel: 'ja', citaat: 'De directeur beslist zelf over de keuze.', verslag: 'V1' },
      { onderdeel: 'draagvlak', oordeel: 'ja', citaat: 'Ze hebben een groot budget.', verslag: 'V1' },
      { onderdeel: 'noodzaak', oordeel: 'ja', citaat: 'Ze willen starten voor de zomer.', verslag: 'V1' },
      { onderdeel: 'behoefte', oordeel: 'ja', citaat: 'Ze willen starten voor de zomer.', verslag: 'V2' },
    ] }, verslagen, { behoefte: { ja: true, bron: 'hand' } })
    expect(Object.keys(uit)).toEqual(['autoriteit'])
    expect(uit.autoriteit?.bron.id).toBe('t1')
  })
  it('een AI-voorstel gaat voor het voorstel uit de analyse; een ingevulde letter krijgt niets', () => {
    const bronnen = [{ id: 'a1', soort: 'afspraak' as const, titel: 'Afspraak', datum: '2026-10-05T10:00:00Z', analyse }]
    const ai = { op: '2026-10-13T10:00:00Z', door: 'u', verslagen: 2, voorstellen: { autoriteit: { ja: false, citaat: 'x', bron: verslagen[0]!.bron } } }
    const v = bandVoorstellenMetAi(bronnen, { draagvlak: { ja: true } }, {}, ai)
    expect(v.find((x) => x.letter === 'autoriteit')).toMatchObject({ ai: true, ja: false })
    expect(v.some((x) => x.letter === 'draagvlak')).toBe(false)
    expect(v.find((x) => x.letter === 'behoefte')?.ai).toBeUndefined()
  })
})
