// BAND uit de gespreksverslagen: voorstellen per letter uit de analyse van de Notulist, met citaat en herkomst.
import { describe, expect, it } from 'vitest'
import { bandUitAnalyse, bandVoorstellen } from '../../shared/bandUitVerslag'

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
