// P14 (test:route): gebieden, regiodagen en dekking. Gat 45: overlap geblokkeerd, synoniemen.
import { describe, expect, it } from 'vitest'
import { dekking, normPlaats, overlap, pc4, regiodagVan, regiodagenVoor, regioVan, valideerRegios, voorstelUitAccounts, weeknummer, type Regio } from '../../shared/gebieden'

const r = (id: string, x: Partial<Regio> = {}): Regio => ({ id, naam: id, reeksen: [], plaatsen: [], eigenaren: { buitendienst: [], binnendienst: [] }, dagen: [], ...x })
const midden = r('midden', { naam: 'Regio Midden', reeksen: [{ van: 3701, tot: 3799 }, { van: 3800, tot: 3829 }], plaatsen: ["'s-Hertogenbosch"] })
const noord = r('noord', { reeksen: [{ van: 9000, tot: 9999 }], plaatsen: ['Assen'], dagen: [{ gebruikerId: 'u', weekdag: 2, weken: 'alle' }, { gebruikerId: 'u', weekdag: 4, weken: 'even' }] })

describe('regioVan', () => {
  it('postcode gaat voor plaats; synoniem; buitenland nooit in een Nederlandse reeks', () => {
    expect(regioVan({ postcode: '3750 AB', plaats: 'Assen' }, [midden, noord])).toBe('midden')
    expect(regioVan({ plaats: 'Den Bosch' }, [midden, noord])).toBe('midden')
    expect(regioVan({ plaats: 'den  bosch' }, [midden, noord])).toBe('midden')
    expect(regioVan({ postcode: '9401', land: 'BE' }, [midden, noord])).toBeNull()
    expect(regioVan({ plaats: 'Onbekend' }, [midden, noord])).toBeNull()
    expect(regioVan({ plaats: 'Bossche Bol' }, [midden], { 'bossche bol': "'s-hertogenbosch" })).toBe('midden')
  })
  it('pc4 en normPlaats', () => {
    expect(pc4('3701ab')).toBe(3701); expect(pc4('0123 AB')).toBeNull(); expect(pc4('B-1000')).toBeNull()
    expect(normPlaats('Den Bosch')).toBe("'s-hertogenbosch")
  })
})

describe('overlap (gat 45)', () => {
  it('overlap gemeld met de tekst; aangrenzende reeksen zijn geen overlap', () => {
    expect(overlap([midden, r('b', { naam: 'Regio B', reeksen: [{ van: 3829, tot: 3900 }] })])[0]!.tekst).toBe('Postcode 3829 valt al in Regio Midden. Haal hem daar eerst weg of kies een andere reeks.')
    expect(overlap([midden, r('b', { reeksen: [{ van: 3830, tot: 3900 }] })])).toEqual([])
    expect(overlap([midden, r('b', { plaatsen: ['Den Bosch'] })])).toHaveLength(1)
  })
  it('valideert reeksen en regiodagen', () => {
    expect(valideerRegios([r('x', { reeksen: [{ van: 3800, tot: 3700 }] })])).toHaveLength(1)
    expect(valideerRegios([r('x', { dagen: [{ gebruikerId: 'u', weekdag: 6, weken: 'alle' }] })])).toHaveLength(1)
    expect(valideerRegios([midden])).toEqual([])
  })
})

describe('regiodagVan', () => {
  it('weekdag, even en oneven weken, feestdag', () => {
    expect(weeknummer('2026-10-15')).toBe(42)
    expect(regiodagVan('u', '2026-10-13', [noord])?.id).toBe('noord') // dinsdag
    expect(regiodagVan('u', '2026-10-15', [noord])?.id).toBe('noord') // donderdag, week 42 even
    expect(regiodagVan('u', '2026-10-22', [noord])).toBeNull() // week 43 oneven
    expect(regiodagVan('u', '2026-10-13', [noord], ['2026-10-13'])).toBeNull()
    expect(regiodagVan('ander', '2026-10-13', [noord])).toBeNull()
    expect(regiodagenVoor([noord], '2026-10-12', 7).map((d) => d.datum)).toEqual(['2026-10-13', '2026-10-15'])
  })
})

describe('voorstel en dekking', () => {
  it('voorstel groepeert op het eerste cijfer van de postcode', () => {
    const v = voorstelUitAccounts([{ postcode: '3701', plaats: 'Zeist' }, { postcode: '3811', plaats: 'Amersfoort' }, { postcode: '3812', plaats: 'Amersfoort' }, { postcode: '9401', plaats: 'Assen' }, { postcode: null }])
    expect(v.map((x) => x.naam)).toEqual(['Regio Amersfoort', 'Regio Assen'])
    expect(overlap(v)).toEqual([])
  })
  it('dekking per regio met altijd een rij Zonder regio', () => {
    const nu = new Date('2026-10-15T12:00:00Z')
    const d = dekking([{ id: 'a', regioId: 'noord', soort: 'prospect' }, { id: 'b', regioId: 'noord', soort: 'klant' }, { id: 'c', regioId: null, soort: 'prospect' }],
      [{ accountId: 'a', op: '2026-10-01T10:00:00Z' }, { accountId: 'b', op: '2026-01-01T10:00:00Z' }], [noord], nu)
    expect(d).toHaveLength(2)
    expect(d[0]).toMatchObject({ naam: 'noord', bezocht: 1, stil: 1, nooit: 0, dekking: 50, regiodag: 'dinsdag, donderdag' })
    expect(d[1]).toMatchObject({ naam: 'Zonder regio', nooit: 1, nietBenaderd: 1 })
  })
})
