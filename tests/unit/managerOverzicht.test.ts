import { describe, expect, it } from 'vitest'
import { analyseBeeld, coachingKop, coachingLede, coachingRedenen, coachingStand, opsomming, sorteerCoaching, teamKop, teamLede, type CoachingLid, type TeamRijLite } from '../../shared/managerOverzicht'

const rij = (naam: string, procent: number, stand: 'op schema' | 'achter' | 'geen' = procent >= 90 ? 'op schema' : 'achter', achterstallig = 0): TeamRijLite => ({ id: naam, naam: `Testgebruiker ${naam}`, tempo: { stand, procent, norm: 125 }, achterstallig, kpi: { pogingen: Math.round(procent * 1.25), gesprekken: 10, afspraken: 2, werkdagen: 5 } })
const lid = (naam: string, dagen: number | null, extra: Partial<CoachingLid> = {}): CoachingLid => ({ id: naam, naam, niveau: 'gevorderd', werkplek: 'binnendienst', laatsteGesprek: dagen == null ? null : '2026-10-01', dagenSindsGesprek: dagen, openAfspraken: 0, ...extra })

describe('team', () => {
  it('kop zegt verbaal hoeveel er op tempo liggen', () => {
    expect(teamKop([])).toBe('Er zit nog niemand in dit team.')
    expect(teamKop([rij('Eva Ervaren', 52), rij('Sanne Belhuis', 24)])).toBe('Sanne en Eva liggen allebei achter op tempo.')
    expect(teamKop([rij('Eva Ervaren', 95), rij('Sanne Belhuis', 24), rij('Anouk Noorderveld', 91)])).toBe('2 van de 3 op tempo; Sanne ligt achter.')
    expect(teamKop([rij('Eva Ervaren', 95), rij('Sanne Belhuis', 99)])).toBe('Iedereen ligt op tempo.')
    expect(teamKop([rij('Eva Ervaren', 0, 'geen')])).toBe('In deze periode valt nog geen werkdag.')
  })
  it('lede noemt wie het verst achter ligt en de achterstand', () => {
    expect(teamLede([rij('Eva Ervaren', 52, 'achter', 11), rij('Sanne Belhuis', 24)])).toBe('Sanne haalt 24 procent van de pogingennorm (30 van 125). Eva heeft 11 taken over tijd.')
  })
})

describe('coaching', () => {
  it('stand volgt het ritme van veertien dagen', () => {
    expect(coachingStand(lid('a', null))).toBe('nooit')
    expect(coachingStand(lid('a', 15))).toBe('te-laat')
    expect(coachingStand(lid('a', 12))).toBe('binnenkort')
    expect(coachingStand(lid('a', 8))).toBe('op-ritme')
  })
  it('redenen komen uit de cijfers, hoogstens drie', () => {
    expect(coachingRedenen(lid('a', null, { tempo: { stand: 'achter', procent: 18, norm: 100 }, achterstallig: 7, afspraken: [{ id: 'x', tekst: 't', termijn: '2026-10-01', overTermijn: true }] })))
      .toEqual(['Nog nooit een coachingsgesprek', 'Tempo 18 procent van de norm', '7 taken over tijd'])
    expect(coachingRedenen(lid('a', 3))).toEqual([])
  })
  it('volgorde: nooit en te laat eerst, dan laagste tempo', () => {
    const l = sorteerCoaching([lid('Eva', 8, { tempo: { stand: 'achter', procent: 60, norm: 1 } }), lid('Bram', null, { tempo: { stand: 'achter', procent: 18, norm: 1 } }), lid('Sanne', 9, { tempo: { stand: 'achter', procent: 27, norm: 1 } })])
    expect(l.map((x) => x.naam)).toEqual(['Bram', 'Sanne', 'Eva'])
  })
  it('kop en lede', () => {
    const l = [lid('Anouk', null), lid('Eva', 8, { openAfspraken: 1, afspraken: [{ id: '1', tekst: 't', termijn: null, overTermijn: false }] }), lid('Sanne', 20)]
    expect(coachingKop(l)).toBe('2 van de 3 accountmanagers wachten op een coachingsgesprek.')
    expect(coachingKop([lid('Eva', 2)])).toBe('Iedereen is de afgelopen twee weken gecoacht.')
    expect(coachingLede(l)).toBe('Eén gesprek per accountmanager per twee weken. 1 afspraak uit eerdere gesprekken staat open.')
  })
  it('opsomming', () => {
    expect(opsomming(['Eva'])).toBe('Eva')
    expect(opsomming(['Anouk', 'Bram', 'Eva'])).toBe('Anouk, Bram en Eva')
  })
})

describe('analyse', () => {
  const K = (sleutel: string, label: string, getal = true) => ({ sleutel, label, getal })
  it('lege periode', () => {
    expect(analyseBeeld('funnel', [{ titel: 'x', kolommen: [], rijen: [] }]).titel).toBe('Nog niets om te analyseren in deze periode.')
  })
  it('funnel: melding als titel, stokpunt als rode tegel', () => {
    const b = analyseBeeld('funnel', [{ titel: 'Funnel', kolommen: [K('label', 'Fase', false), K('aantal', 'Accounts')], rijen: [
      { label: 'Gevonden', aantal: 84, doorgestroomd: 21, uitgevallen: 0, conversie: 25, doorlooptijd: 3.6 },
      { label: 'Afspraak gepland', aantal: 34, doorgestroomd: 13, uitgevallen: 2, conversie: 38, doorlooptijd: 6 },
      { label: 'Overgedragen', aantal: 5, doorgestroomd: 0, uitgevallen: 0, conversie: '', doorlooptijd: '' },
    ] }], 'Van 172 prospects kwamen er 34 tot een eerste afspraak.')
    expect(b.titel).toBe('Van 172 prospects kwamen er 34 tot een eerste afspraak.')
    expect(b.tegels.map((t) => t.waarde)).toEqual(['84', '34', '5', '25%'])
    expect(b.tegels[3]!.rood).toBe(true)
    expect(b.opvallend[0]).toBe('Het stokpunt zit in de fase gevonden: daar stroomt 25 procent door naar de volgende fase.')
  })
  it('activiteit: totalen, per persoon in de flyout en wat opvalt', () => {
    const b = analyseBeeld('activiteit', [
      { titel: 'Per persoon', kolommen: [K('persoon', 'Persoon', false), K('kanaal', 'Kanaal', false), K('pogingen', 'Pogingen')], rijen: [
        { persoon: 'Eva Ervaren', kanaal: 'gebeld', pogingen: 96, gesprekken: 47, afspraken: 19, conversie: 40 },
        { persoon: 'Eva Ervaren', kanaal: 'mail', pogingen: 75, gesprekken: 0, afspraken: 0, conversie: '' },
        { persoon: 'Anouk Noorderveld', kanaal: 'gebeld', pogingen: 48, gesprekken: 27, afspraken: 6, conversie: 22 },
      ] },
      { titel: 'Per poging', kolommen: [], rijen: [{ poging: '1', afspraken: 18 }, { poging: '4', afspraken: 7 }] },
    ])
    expect(b.titel).toBe('25 afspraken uit 74 gesprekken en 219 pogingen.')
    expect(b.tegels.find((t) => t.sleutel === 'afspraken')!.regels[0]).toMatchObject({ label: 'Eva Ervaren', waarde: '19' })
    expect(b.opvallend).toContain('Eva maakt van de meeste gesprekken een afspraak (40 procent), Anouk van de minste (22 procent).')
    expect(b.opvallend).toContain('Mail leverde veel pogingen maar geen afspraak op.')
  })
  it('prospectmix: wie afwijkt', () => {
    const b = analyseBeeld('prospectmix', [{ titel: 'Mix', kolommen: [K('persoon', 'Persoon', false), K('accounts', 'Accounts benaderd')], rijen: [
      { persoon: 'Eva Ervaren', accounts: 59, voorstel: 'Start een campagne Referral of Signaal' }, { persoon: 'Sanne Belhuis', accounts: 12, voorstel: '' },
    ] }])
    expect(b.titel).toBe('1 van de 2 accountmanagers wijkt af van de afgesproken mix.')
    expect(b.tegels[0]).toMatchObject({ waarde: '71', label: 'Accounts benaderd' })
  })
})
