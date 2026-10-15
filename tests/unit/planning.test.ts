// P12: shared/planning.ts met jaarwissel, startmaand, lege invoer, capaciteit en de normen.
import { describe, expect, it } from 'vitest'
import {
  benaderdDitJaar, hercontactOpTijd, leesPlanning, maandInJaar, metAfkoeling, planningStand, potentieVan, spreidOverBlokken, statusVan, vensterVan, verkoopjaar, watKnelt,
  PLANNING_STANDAARD, type IngedeeldAccount,
} from '../../shared/planning'

const nu = new Date('2026-10-15T10:00:00Z')
const VOLTVAST = [{ id: 'kl-a-prospects', naam: 'A · Aantal monteurs (Prospects)' }, { id: 'kl-c-prospects', naam: 'C · Aantal monteurs (Prospects)' }]

describe('potentie', () => {
  it('standaardklassen: A en B groot, C middel, D klein; zonder klasse null; eigen klasse standaard middel of gekoppeld', () => {
    expect(['A', 'B', 'C', 'D'].map((k) => potentieVan({ klasse: k }, PLANNING_STANDAARD))).toEqual(['groot', 'groot', 'middel', 'klein'])
    expect(potentieVan({ klasse: null }, PLANNING_STANDAARD)).toBe(null)
    expect(potentieVan({ klasse: 'kl-a-prospects' }, PLANNING_STANDAARD, VOLTVAST)).toBe('middel')
    expect(potentieVan({ klasse: 'kl-a-prospects' }, { ...PLANNING_STANDAARD, klassePotentie: { 'kl-a-prospects': 'groot' } }, VOLTVAST)).toBe('groot')
  })
  it('eigen veld als potentie; leeg valt terug op de klasse; score als bron', () => {
    const inst = { ...PLANNING_STANDAARD, potentieBron: 'eigenVeld' as const, eigenVeldSleutel: 'omzetpotentie' }
    expect(potentieVan({ klasse: 'D', cf: { omzetpotentie: 150000 } }, inst)).toBe('groot')
    expect(potentieVan({ klasse: 'D', cf: { omzetpotentie: 30000 } }, inst)).toBe('middel')
    expect(potentieVan({ klasse: 'A', cf: { omzetpotentie: '' } }, inst)).toBe('groot')
    expect(potentieVan({ klasse: null, score: 75 }, { ...PLANNING_STANDAARD, potentieBron: 'score' })).toBe('groot')
  })
})

describe('verkoopjaar en vensters', () => {
  it('startmaand januari en april; jaarwissel', () => {
    expect(verkoopjaar(nu, 1)).toEqual({ jaar: 2026, start: '2026-01-01', eind: '2026-12-31' })
    expect(verkoopjaar(new Date('2026-02-10T00:00:00Z'), 4)).toEqual({ jaar: 2025, start: '2025-04-01', eind: '2026-03-31' })
    expect(verkoopjaar(new Date('2026-04-01T00:00:00Z'), 4).start).toBe('2026-04-01')
  })
  it('groot maand 1 tot 2, middel 1 tot 5, klein doorlopend; over de jaarwissel', () => {
    expect(vensterVan('groot', '2026-01-01')).toEqual({ van: '2026-01-01', tot: '2026-02-28' })
    expect(vensterVan('middel', '2026-01-01').tot).toBe('2026-05-31')
    expect(vensterVan('klein', '2026-01-01').tot).toBe('2026-12-31')
    expect(vensterVan('middel', '2025-10-01').tot).toBe('2026-02-28')
    expect(maandInJaar('2026-02-28', '2025-10-01')).toBe(5)
  })
  it('vensters uit de instelling, begrensd op 1 tot 12', () => {
    expect(leesPlanning({ vensters: { groot: 3, middel: 99 } }, 4)).toMatchObject({ startmaand: 4, vensters: { groot: 3, middel: 12, klein: 12 } })
  })
})

describe('benaderd', () => {
  const jaar = { start: '2026-01-01', eind: '2026-12-31' }
  it('alleen echte pogingen in het lopende verkoopjaar; 31 december telt niet, 1 januari wel; import telt niet', () => {
    expect(benaderdDitJaar([{ soort: 'gebeld', uitkomst: 'geen_reactie', op: '2025-12-31T16:00:00Z' }], jaar).benaderd).toBe(false)
    expect(benaderdDitJaar([{ soort: 'gebeld', uitkomst: 'geen_reactie', op: '2026-01-01T08:00:00Z' }], jaar).benaderd).toBe(true)
    expect(benaderdDitJaar([{ soort: 'import', op: '2026-03-01T08:00:00Z' }, { soort: 'notitie', op: '2026-03-01T08:00:00Z' }], jaar).benaderd).toBe(false)
  })
  it('gesproken vraagt een gesprek; afspraak gaat voor', () => {
    expect(statusVan(benaderdDitJaar([{ soort: 'gebeld', uitkomst: 'voicemail', op: '2026-03-01' }], jaar))).toBe('Benaderd')
    expect(statusVan(benaderdDitJaar([{ soort: 'gebeld', uitkomst: 'gesproken', op: '2026-03-01' }], jaar))).toBe('Gesproken')
    expect(statusVan(benaderdDitJaar([{ soort: 'gebeld', uitkomst: 'afspraak', op: '2026-03-01' }], jaar))).toBe('Afspraak')
    expect(statusVan(benaderdDitJaar([], jaar))).toBe('Nog niet benaderd')
  })
})

describe('stand en knelpunten', () => {
  const jaar = verkoopjaar(nu, 1)
  const acc = (id: string, potentie: any, benaderd: boolean): IngedeeldAccount => ({ id, potentie, benaderd, venster: potentie ? vensterVan(potentie, jaar.start) : null })
  it('36 grote prospects niet benaderd geeft urgent met inplannen; zeven zonder klasse "Buiten de planning"', () => {
    const lijst = [...Array.from({ length: 36 }, (_, i) => acc(`g${i}`, 'groot', false)), ...Array.from({ length: 4 }, (_, i) => acc(`b${i}`, 'groot', true)), ...Array.from({ length: 7 }, (_, i) => acc(`z${i}`, null, false))]
    const s = planningStand(lijst, jaar, nu)
    expect(s.achterstand.groot).toBe(36)
    expect(s.zonderKlasse).toBe(7)
    expect(s.maanden[0]!.groepen[0]).toEqual({ potentie: 'groot', totaal: 40, benaderd: 4, teLaat: 36 })
    expect(s.maanden[2]!.groepen.find((g) => g.potentie === 'groot')).toBeUndefined()
    const k = watKnelt(s, nu)
    expect(k[0]).toMatchObject({ niveau: 'urgent', titel: 'Achterstallig · Groot', tekst: 'Het is oktober en 36 grote prospects zijn nog niet benaderd. Dat hoorde in januari en februari.', actie: { soort: 'inplannen', aantal: 36 } })
    expect(k[1]).toMatchObject({ niveau: 'letop', tekst: '7 prospects zonder klasse' })
  })
  it('geen achterstand geeft "goed"; lege invoer ook', () => {
    expect(watKnelt(planningStand([], jaar, nu), nu)).toEqual([{ niveau: 'goed', titel: 'Op schema', tekst: 'Iedereen die aan de beurt was, is benaderd.' }])
  })
})

describe('spreiden over belblokken', () => {
  const blok = (d: string, minuten = 90) => ({ start: `${d}T07:00:00.000Z`, minuten })
  it('per blok wat past (90 minuten is 18), nooit boven 40 per dag; wat niet past blijft over', () => {
    const ids = Array.from({ length: 36 }, (_, i) => `a${i}`)
    const r = spreidOverBlokken(ids, [blok('2026-10-19'), blok('2026-10-20'), blok('2026-10-21')], '2026-11-05', 40, nu)
    expect(r.verdeling.map((v) => v.accountIds.length)).toEqual([18, 18])
    expect(r.over).toEqual([])
  })
  it('capaciteit 40 per dag met wat er al staat; minder blokken dan nodig', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `a${i}`)
    const r = spreidOverBlokken(ids, [blok('2026-10-19', 240)], '2026-11-05', 40, nu, { '2026-10-19': 35 })
    expect(r.verdeling).toEqual([{ start: '2026-10-19T07:00:00.000Z', accountIds: ids.slice(0, 5) }])
    expect(r.over.length).toBe(25)
  })
  it('venster sluit eerder en blokken in het verleden tellen niet', () => {
    const r = spreidOverBlokken(['a'], [blok('2026-10-14'), blok('2026-11-10')], '2026-11-05', 40, nu)
    expect(r.over).toEqual(['a'])
  })
})

describe('terugkomen', () => {
  const nee = { op: '2026-10-01T00:00:00Z', reden: 'Prijs', afkoeling: { bellen: 90, mail: 30, kaart: 365 } } as any
  it('een datum binnen de afkoelperiode schuift naar het einde; precies op de grens niet; per kanaal', () => {
    expect(metAfkoeling('2026-11-01', nee, 'bellen')).toEqual({ datum: '2026-12-30', geschoven: true, tot: '2026-12-30' })
    expect(metAfkoeling('2026-12-30', nee, 'bellen').geschoven).toBe(false)
    expect(metAfkoeling('2026-11-01', nee, 'mail').geschoven).toBe(false)
    expect(metAfkoeling('2027-06-01', nee, 'kaart')).toMatchObject({ datum: '2027-10-01', geschoven: true })
    expect(metAfkoeling('2026-11-01', null, 'bellen').geschoven).toBe(false)
  })
  it('hercontact op tijd: 90 gezond, 70 aandacht, op de grens', () => {
    const r = (opTijd: number, laat: number) => hercontactOpTijd([
      ...Array.from({ length: opTijd }, () => ({ terugOp: '2026-09-01', eerstePogingNa: '2026-09-03T09:00:00Z' })),
      ...Array.from({ length: laat }, () => ({ terugOp: '2026-09-01', eerstePogingNa: null })),
    ], nu)
    expect(r(9, 1)).toMatchObject({ procent: 90, stand: 'gezond' })
    expect(r(89, 11).stand).toBe('aandacht')
    expect(r(7, 3)).toMatchObject({ procent: 70, stand: 'aandacht' })
    expect(r(69, 31).stand).toBe('risico')
    expect(hercontactOpTijd([], nu).procent).toBe(null)
    expect(hercontactOpTijd([{ terugOp: '2026-10-14' }], nu).bereikt).toBe(0)
  })
})
