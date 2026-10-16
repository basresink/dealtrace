import { describe, expect, it } from 'vitest'
import { eersteRegels, filterConcepten, sindsVan, statusFilter } from '../../shared/concepten'

const rij = (type: string, status: string, agent: string, zoektekst: string) => ({ type, status, agent, zoektekst })
const LIJST = [
  rij('mail', 'klaar', 'schrijver', 'Testbouw Utrecht Anna Test'),
  rij('mail', 'goedgekeurd', 'schrijver', 'Testbouw Utrecht'),
  rij('whatsapp', 'klaar', 'schrijver', 'Testvloer Houten'),
  rij('taak', 'klaar', 'notulist', 'Testvloer Houten'),
  rij('mail', 'verstuurd', 'mens', 'Testbouw Utrecht'),
  rij('linkedin', 'verworpen', 'schrijver', 'Testzon Veenendaal'),
]

describe('conceptfilters', () => {
  it('toont standaard alleen open concepten (klaar en goedgekeurd)', () => {
    const r = filterConcepten(LIJST, {})
    expect(r.concepten).toHaveLength(4)
    expect(r.tellers.status).toMatchObject({ klaar: 3, goedgekeurd: 1, verstuurd: 1, afgewezen: 1, open: 4, alle: 6 })
  })
  it('verworpen heet afgewezen in de filter', () => {
    expect(statusFilter('verworpen')).toBe('afgewezen')
    expect(filterConcepten(LIJST, { status: 'afgewezen' }).concepten.map((c) => c.type)).toEqual(['linkedin'])
  })
  it('telt per soort en agent met de andere filters erop', () => {
    const r = filterConcepten(LIJST, { status: 'alle', agent: 'schrijver' })
    expect(r.concepten).toHaveLength(4)
    expect(r.tellers.soort).toEqual({ mail: 2, whatsapp: 1, linkedin: 1 })
    expect(r.tellers.agent).toEqual({ schrijver: 4, notulist: 1, mens: 1 })
  })
  it('zoekt op account of contact, zonder hoofdletters', () => {
    expect(filterConcepten(LIJST, { status: 'alle', zoek: 'houten' }).concepten).toHaveLength(2)
    expect(filterConcepten(LIJST, { zoek: 'anna' }).concepten).toHaveLength(1)
  })
  it('periode: vandaag vanaf middernacht in Amsterdam, anders dagen terug', () => {
    const nu = new Date('2026-10-16T10:00:00Z')
    expect(sindsVan('vandaag', nu)!.toISOString()).toBe('2026-10-15T22:00:00.000Z')
    expect(sindsVan('week', nu)!.toISOString()).toBe('2026-10-09T10:00:00.000Z')
    expect(sindsVan('onzin', nu)).toBeNull()
  })
  it('eerste regels: tekst of blokken, ingekort op een woordgrens', () => {
    expect(eersteRegels({ blokken: { a: 'Een', b: 'twee' } })).toBe('Een twee')
    expect(eersteRegels({ tekst: 'aaa bbb ccc' }, 6)).toBe('aaa...')
  })
})
