// P21: kpi met noemer, tempo, minimumaantallen, aandachtspunten, coachpunten (golden master), gesprekken
// om te bespreken, CSV en de ritmeafrekening per account (regel 44).
import { describe, expect, it } from 'vitest'
import { ritmeAfrekening } from '../../shared/ritmematrix'
import { aandachtspunten, coachPunten, genoegOmTeVergelijken, kiesGesprekken, kpi, naarCsv, periodeVoor, teamGemiddelde, tempo, werkdagen, type KpiActiviteit, type TeamRij } from '../../shared/team'

const a = (x: Partial<KpiActiviteit>): KpiActiviteit => ({ door: 'u-1', op: '2026-10-14T09:00:00Z', soort: 'gebeld', uitkomst: 'geen_reactie', accountId: 'acc-1', ...x })
describe('kpi', () => {
  const p = { van: '2026-10-12', tot: '2026-10-16' }
  it('telt pogingen, gesprekken, beslisser en afspraken met noemer; intern overleg telt niet', () => {
    const k = kpi('u-1', p, [a({}), a({ uitkomst: 'later', beslisser: true }), a({ uitkomst: 'afspraak', accountId: 'acc-2' }), a({ soort: 'afspraak', uitkomst: null }), a({ uitkomst: 'later', intern: true }), a({ door: 'u-2', uitkomst: 'afspraak' }), a({ op: '2026-10-20T09:00:00Z' })])
    expect(k).toMatchObject({ werkdagen: 5, pogingen: 3, gesprekken: 2, beslisser: 1, afspraken: 1, accounts: 2 })
    expect(k.gesprekNaarAfspraak).toEqual({ waarde: 0.5, noemer: 2 })
    expect(k.pogingenTotAfspraak).toEqual({ waarde: 3, noemer: 1 })
  })
  it('lege periode; feestdagen zijn geen werkdag', () => {
    expect(kpi('u-1', p, []).gesprekNaarAfspraak).toEqual({ waarde: 0, noemer: 0 })
    expect(werkdagen({ van: '2026-12-24', tot: '2026-12-28' })).toBe(2)
  })
})

describe('tempo en minimum', () => {
  it('op schema vanaf 90 procent; zonder werkdag geen oordeel', () => {
    expect(tempo({ pogingen: 45, werkdagen: 2 }, 'binnendienst')).toEqual({ stand: 'op schema', procent: 90, norm: 50 })
    expect(tempo({ pogingen: 44, werkdagen: 2 }, 'binnendienst').stand).toBe('achter')
    expect(tempo({ pogingen: 0, werkdagen: 0 }, 'buitendienst').stand).toBe('geen')
  })
  it('29 en 30 gesprekken per script; 19 en 20 accounts per reisversie', () => {
    expect(genoegOmTeVergelijken(29, 'script')).toEqual({ genoeg: false, melding: 'Te weinig om te vergelijken' })
    expect(genoegOmTeVergelijken(30, 'script').genoeg).toBe(true)
    expect(genoegOmTeVergelijken(19, 'reisversie').genoeg).toBe(false)
    expect(genoegOmTeVergelijken(20, 'reisversie').genoeg).toBe(true)
  })
  it('periodes: week vanaf maandag, kwartaal vanaf de eerste maand', () => {
    expect(periodeVoor('week', '2026-10-15')).toEqual({ van: '2026-10-12', tot: '2026-10-15' })
    expect(periodeVoor('kwartaal', '2026-11-20')).toEqual({ van: '2026-10-01', tot: '2026-11-20' })
  })
})

const rij = (id: string, naam: string, x: Partial<TeamRij> & { k?: Partial<ReturnType<typeof kpi>> } = {}): TeamRij => ({
  id, naam, werkplek: 'binnendienst', achterstallig: 0, belblokkenGehouden: 1, belblokkenGepland: 1, conceptenWachten: 0, ...x,
  kpi: { werkdagen: 5, pogingen: 100, gesprekken: 20, beslisser: 5, afspraken: 4, accounts: 20, pogingenPerDag: { waarde: 20, noemer: 5 }, gesprekNaarAfspraak: { waarde: 0.2, noemer: 20 }, beslisserBereikt: { waarde: 0.25, noemer: 20 }, pogingenTotAfspraak: { waarde: 25, noemer: 4 }, ...(x.k ?? {}) },
})
describe('aandachtspunten', () => {
  it('hoogstens vijf, ernstigste eerst, vaste volgorde', () => {
    const r = [
      rij('u-1', 'Testgebruiker Mark Test', { k: { pogingen: 21, accounts: 10, afspraken: 1 } }),
      rij('u-2', 'Testgebruiker Sanne Test', { achterstallig: 14, belblokkenGehouden: 0 }),
      rij('u-3', 'Testgebruiker Eva Test', { belblokkenGehouden: 0, k: { gesprekken: 20, afspraken: 1, gesprekNaarAfspraak: { waarde: 0.05, noemer: 20 } } }),
    ]
    const p = aandachtspunten(r, { campagnesAchter: 3, terugDezeWeek: 6 })
    expect(p).toHaveLength(5)
    expect(p[0]!.tekst).toBe('Sanne heeft 14 taken achterstallig')
    expect(p[1]!.tekst).toMatch(/^Mark stopt gemiddeld na 2,1 pogingen \(team /)
    expect(p.map((x) => x.soort)).toEqual(['achterstallig', 'pogingen', 'conversie', 'belblok', 'belblok'])
  })
  it('niets bijzonders: geen punten', () => expect(aandachtspunten([rij('u-1', 'A')])).toEqual([]))
  it('teamgemiddelde zonder namen', () => {
    const g = teamGemiddelde([rij('u-1', 'A'), rij('u-2', 'B', { k: { pogingen: 50, gesprekken: 10, afspraken: 0 } })])
    expect(g).toEqual({ pogingen: 75, gesprekken: 15, afspraken: 2, gesprekNaarAfspraak: 0.133, beslisserBereikt: 0.333, personen: 2 })
    expect(JSON.stringify(g)).not.toContain('u-1')
  })
})

describe('coachPunten (golden master)', () => {
  it('alleen met cijfers en een bestaand artikel, hoogstens drie', () => {
    const punten = [
      { tekst: 'Sluit af met een voorstel.', onderbouwing: { cijfers: ['2 van 10 gesprekken'], bron: 'Log' }, artikelSleutel: 'een-belscript-kiezen' },
      { tekst: 'Zonder cijfers.', onderbouwing: { cijfers: ['vaak'], bron: 'Log' }, artikelSleutel: 'een-belscript-kiezen' },
      { tekst: 'Verzonnen artikel.', onderbouwing: { cijfers: ['3 keer'], bron: 'Log' }, artikelSleutel: 'bestaat-niet' },
      { tekst: 'Vijf pogingen.', onderbouwing: { cijfers: ['2,1 pogingen'], bron: 'Log' }, artikelSleutel: 'waarom-vijf-pogingen-werken' },
      { tekst: 'Winpunt.', onderbouwing: { cijfers: ['1 van 4'], bron: 'Log' }, artikelSleutel: 'een-winpunt-per-gesprek' },
      { tekst: 'Vierde.', onderbouwing: { cijfers: ['9'], bron: 'Log' }, artikelSleutel: 'een-winpunt-per-gesprek' },
    ]
    expect(coachPunten(punten, ['een-belscript-kiezen', 'waarom-vijf-pogingen-werken', 'een-winpunt-per-gesprek']).map((p) => p.tekst)).toEqual(['Sluit af met een voorstel.', 'Vijf pogingen.', 'Winpunt.'])
  })
})

describe('kiesGesprekken', () => {
  it('een goede, een verloren en het vaakst terugkomende bezwaar', () => {
    const l = [
      { id: '1', uitkomst: 'afspraak', op: '2026-10-10' }, { id: '2', uitkomst: 'geen_interesse', op: '2026-10-11', bezwaar: 'Te duur' },
      { id: '3', uitkomst: 'later', op: '2026-10-12', bezwaar: 'Te duur' }, { id: '4', uitkomst: 'later', op: '2026-10-09', bezwaar: 'Geen tijd' },
    ]
    expect(kiesGesprekken(l).map((x) => [x.soort, x.item.id])).toEqual([['goed', '1'], ['verloren', '2'], ['bezwaar', '3']])
    expect(kiesGesprekken([])).toEqual([])
  })
})

describe('CSV', () => {
  it('precies de getoonde rijen, puntkomma en aanhalingstekens waar nodig', () => {
    expect(naarCsv([{ sleutel: 'a', label: 'Naam' }, { sleutel: 'b', label: 'Aantal' }], [{ a: 'Test; B.V.', b: 3 }, { a: 'X', b: null }])).toBe('Naam;Aantal\n"Test; B.V.";3\nX;')
  })
})

describe('ritmeAfrekening per account (regel 44)', () => {
  it('een stil account in een klasse die als geheel op schema ligt, staat als achter', () => {
    const accounts = [{ id: 'a1', type: 'prospect' as const, klasseCode: 'A' }, { id: 'a2', type: 'prospect' as const, klasseCode: 'A' }]
    const acts = [1, 2].map((i) => ({ accountId: 'a1', kanaal: 'bellen', op: `2026-10-0${i}T09:00:00Z` }))
    const r = ritmeAfrekening(accounts, acts, { van: '2026-10-01', tot: '2026-10-31' })
    expect(r.find((x) => x.accountId === 'a2')!.stand).toBe('achter')
    expect(r.find((x) => x.accountId === 'a1')!.stand).not.toBe('achter')
  })
})
