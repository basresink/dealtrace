import { describe, expect, it } from 'vitest'
import { RICHTING_TABS, bevestigdStand, ingevuldeTabs, tabIngevuld, doelVoortgang, eenheidTekst, kanaalIcoon, kerncijfers, tijdlijn } from '../../shared/richting'

// Richting verbeterd: kerncijfers, voetregel, tijdlijn en de vaste teksten per tabblad.
describe('richting', () => {
  it('zeven tabbladen in vaste volgorde, elk met titel en waarom', () => {
    expect(RICHTING_TABS.map((t) => t.k)).toEqual(['verhaal', 'richting', 'belofte', 'branches', 'concurrenten', 'winpunten', 'terugkomen'])
    for (const t of RICHTING_TABS) { expect(t.titel).toBeTruthy(); expect(t.waarom.length).toBeGreaterThan(40); expect(t.waarom).not.toMatch(/[—–]/) }
  })
  it('kerncijfers: branches nu en later, concurrenten met antwoord, winpunten in fasen, regels', () => {
    const c = kerncijfers({
      branches: [{ horizon: 'huidig' }, { horizon: 'huidig' }, { horizon: 'toekomstig' }],
      concurrenten: [{ zoZegJeHet: 'x' }, { alsDeKlantZegt: 'y' }, {}],
      winpunten: [{ actief: true }, { actief: false }], fasen: [1, 2, 3, 4, 5], terugkomregels: [1, 2],
    })
    expect(c.map((x) => `${x.cijfer} ${x.tekst}`)).toEqual(['2 + 1 branches nu en later', '2 concurrenten met antwoord', '1 winpunt in 5 fasen', '2 terugkomregels'])
    expect(kerncijfers({ branches: [{ horizon: 'huidig' }] })[0]).toMatchObject({ cijfer: '1', tekst: 'branche' })
  })
  it('voetregel telt bevestigde onderdelen en de laatste datum', () => {
    expect(bevestigdStand({ a: { status: 'bevestigd', bevestigdOp: '2026-10-01' }, b: { status: 'bevestigd', bevestigdOp: '2026-10-17' }, c: { status: 'concept', bevestigdOp: null } }))
      .toEqual({ aantal: 2, totaal: 3, tekst: '2 van 3 onderdelen bevestigd', laatst: '2026-10-17' })
  })
  it('tijdlijn, voortgang, eenheid en kanaal', () => {
    const l = tijdlijn([{ termijnDagen: 0 }, { termijnDagen: 182 }])
    expect(l.max).toBe(365)
    expect(l.positie(0)).toBe(0)
    expect(l.positie(365)).toBe(100)
    expect(tijdlijn([{ termijnDagen: 730 }]).schaal.at(-1)!.tekst).toBe('24 mnd')
    expect(doelVoortgang({ stand: 112, doel: 400 })).toBe(28)
    expect(doelVoortgang({ stand: null, doel: 60 })).toBeNull()
    expect(eenheidTekst('aantal')).toBe('')
    expect(eenheidTekst('procent')).toBe(' procent')
    expect([kanaalIcoon('E-mail'), kanaalIcoon('Bezoek'), kanaalIcoon('Telefoon')]).toEqual(['Mail', 'MapPin', 'Phone'])
  })
  it('tabIngevuld: een tabblad zonder bevestigde tekst of regel is leeg', () => {
    expect(ingevuldeTabs({})).toEqual([])
    expect(tabIngevuld('verhaal', { teksten: [{ sleutel: 'bedrijfsverhaal', tekst: '  ' }] })).toBe(false)
    expect(tabIngevuld('verhaal', { teksten: [{ sleutel: 'verhaal', tekst: 'Per branche' }] })).toBe(true)
    expect(tabIngevuld('richting', { ambitiedoelen: [{}] })).toBe(true)
    expect(tabIngevuld('belofte', { teksten: [{ sleutel: 'ambitie', tekst: 'Groei' }] })).toBe(false)
    expect(tabIngevuld('winpunten', { winpunten: [{ actief: false }] })).toBe(false)
    const st = { teksten: [{ sleutel: 'kernbelofte', tekst: 'Op tijd' }], concurrenten: [{}], terugkomregels: [{}] }
    expect(ingevuldeTabs(st).map((t) => t.k)).toEqual(['belofte', 'concurrenten', 'terugkomen'])
  })
})
