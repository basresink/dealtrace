import { describe, expect, it } from 'vitest'
import {
  campagneAdvies, campagneResultaat, campagneTempo, CAMPAGNESOORTEN_START, capaciteit, isAfgelopen, kanaalDekking, kolomUitUitkomst, KOLOMMEN,
  omvangMelding, overslagen, spreidTaken, taakTitel, type Item,
} from '../../shared/campagnes'
import { nlTijdstip } from '../../shared/datum'

const item = (x: Partial<Item> & { accountId: string }): Item => ({ kolom: 'gespot', poging: 0, eigenaarId: 'u-07', einddoelGehaald: false, ...x })

describe('soorten en kolommen (gat 16: één keer in shared)', () => {
  it('acht startsoorten, elk met doel, ritme, kanaal en uitvoerder', () => {
    expect(CAMPAGNESOORTEN_START).toHaveLength(8)
    expect(new Set(CAMPAGNESOORTEN_START.map((s) => s.sleutel)).size).toBe(8)
    for (const s of CAMPAGNESOORTEN_START) { expect(s.startsoort).toBe(true); expect(s.kanalen.length).toBeGreaterThan(0); expect(s.pogingen).toBeGreaterThan(0) }
  })
  it('zes kolommen in de volgorde van het bord', () => {
    expect(KOLOMMEN).toEqual(['gespot', 'benaderd', 'in-gesprek', 'afspraak', 'geparkeerd', 'afgewezen'])
  })
})

describe('campagneTempo (één functie voor scherm en motor, gat 13)', () => {
  const c = { startedAt: '2026-10-01', endsAt: '2026-10-11', doel: null }
  const items = (gehaald: number, totaal = 10) => Array.from({ length: totaal }, (_, i) => ({ einddoelGehaald: i < gehaald }))
  const op = (dag: string) => new Date(`${dag}T00:00:00Z`)
  it('zonder einddatum of zonder accounts: geen tempo', () => {
    expect(campagneTempo({ ...c, endsAt: null }, items(1), op('2026-10-05'))).toBeNull()
    expect(campagneTempo(c, [], op('2026-10-05'))).toBeNull()
  })
  it('grens +5: precies 5 punten boven verwacht is Voor op schema', () => {
    // Verwacht 50 procent op dag 6 van 10; voortgang 55 kan niet met 10 items, dus 20 items: 11 van 20 = 55.
    expect(campagneTempo(c, items(11, 20), op('2026-10-06'))!.pil).toBe('Voor op schema')
    expect(campagneTempo(c, items(10, 20), op('2026-10-06'))!.pil).toBe('Op schema')
  })
  it('grens -10: precies 10 punten eronder is nog Op schema, 11 is Achter', () => {
    const t = campagneTempo(c, items(8, 20), op('2026-10-06'))!
    expect([t.voortgang, t.verwacht, t.pil]).toEqual([40, 50, 'Op schema'])
    const a = campagneTempo(c, items(39, 100), op('2026-10-06'))!
    expect(a.pil).toBe('Achter op schema')
    expect(a.achterstand).toBe(11)
  })
  it('een doel in afspraken of procent rekent tegen het doel, niet tegen alle items', () => {
    expect(campagneTempo({ ...c, doel: { type: 'afspraken', waarde: 4 } }, items(2), op('2026-10-06'))!.voortgang).toBe(50)
    expect(campagneTempo({ ...c, doel: { type: 'procent', waarde: 20 } }, items(1), op('2026-10-06'))!.voortgang).toBe(50)
  })
})

describe('campagneAdvies ("Begin hier", geen AI)', () => {
  it('nooit contact eerst, dan langst stil; aanleiding als tweede sleutel; geen eindkolommen', () => {
    const r = campagneAdvies([
      item({ accountId: 'a', laatsteContactOp: '2026-09-01', naam: 'A' }),
      item({ accountId: 'b', laatsteContactOp: null, naam: 'B' }),
      item({ accountId: 'c', laatsteContactOp: '2026-08-01', naam: 'C' }),
      item({ accountId: 'd', laatsteContactOp: null, naam: 'D', kolom: 'afspraak' }),
      item({ accountId: 'e', laatsteContactOp: '2026-08-01', aanleiding: true, naam: 'E' }),
    ])
    expect(r.map((i) => i.accountId)).toEqual(['b', 'e', 'c'])
  })
})

describe('spreidTaken', () => {
  const looptijd = { start: '2026-10-19', eind: '2026-10-30' }
  it('binnendienst in de koude belblokken, hooguit het aantal plekken per blok', () => {
    const blokken = [{ datum: '2026-10-19', start: '10:00', plekken: 2, eigenaarId: 'u-07' }, { datum: '2026-10-20', start: '09:30', plekken: 2, eigenaarId: 'u-07' }]
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ accountId: id, eigenaarId: 'u-07', werkplek: 'binnendienst' as const }))
    const plan = spreidTaken(items, blokken, [], looptijd)
    expect(plan.get('a')).toBe(nlTijdstip('2026-10-19', 10).toISOString())
    expect(plan.get('c')).toBe(nlTijdstip('2026-10-20', 9, 30).toISOString())
    // Meer items dan plekken: op een werkdag binnen de looptijd.
    expect(plan.get('e')! >= nlTijdstip('2026-10-19', 0).toISOString()).toBe(true)
  })
  it('buitendienst op de regiodag van het account, verdeeld over de dagen', () => {
    const dagen = [{ gebiedId: 'regio-noord', gebruikerId: 'u-05', datum: '2026-10-20' }, { gebiedId: 'regio-noord', gebruikerId: 'u-05', datum: '2026-10-22' }, { gebiedId: 'regio-oost', gebruikerId: 'u-05', datum: '2026-10-21' }]
    const plan = spreidTaken([{ accountId: 'x', eigenaarId: 'u-05', werkplek: 'buitendienst', regioId: 'regio-noord' }, { accountId: 'y', eigenaarId: 'u-05', werkplek: 'buitendienst', regioId: 'regio-noord' }], [], dagen, looptijd)
    expect(plan.get('x')).toBe(nlTijdstip('2026-10-20', 9).toISOString())
    expect(plan.get('y')).toBe(nlTijdstip('2026-10-22', 9).toISOString())
  })
  it('buitendienst zonder regiodag en feestdagen: een werkdag, geen feestdag', () => {
    const plan = spreidTaken([{ accountId: 'z', eigenaarId: 'u-05', werkplek: 'buitendienst', regioId: 'regio-zuid' }], [], [], looptijd, ['2026-10-19'])
    expect(plan.get('z')).toBe(nlTijdstip('2026-10-20', 9).toISOString())
  })
})

describe('capaciteit', () => {
  const koud = CAMPAGNESOORTEN_START.find((s) => s.sleutel === 'koude-belcampagne')!
  it('uren per week tegen beschikbaar, met tekst', () => {
    const c = capaciteit(30, koud, 6)
    expect(c.nodigUren).toBeGreaterThan(0)
    expect(c.tekst).toMatch(/uur bellen per week tegen 6 beschikbaar/)
  })
  it('eigenaar zonder blokken: altijd boven capaciteit', () => {
    expect(capaciteit(1, koud, 0).boven).toBe(true)
  })
})

describe('campagneResultaat (geen deals, B17)', () => {
  it('lege campagne', () => {
    expect(campagneResultaat([], [])).toEqual({ accounts: 0, bereikt: 0, gesprekken: 0, afsprakenGepland: 0, afsprakenGehouden: 0, overgedragen: 0, conversie: 0, winpuntUitgevoerd: null })
  })
  it('overgedragen telt alleen accounts met de gebeurtenis overgedragen; winpunt uitgevoerd als percentage', () => {
    const r = campagneResultaat(
      [{ accountId: 'a', kolom: 'afspraak', winpuntUitgevoerd: true }, { accountId: 'b', kolom: 'afgewezen', winpuntUitgevoerd: false }, { accountId: 'c', kolom: 'benaderd' }],
      [{ accountId: 'a', soort: 'contact', uitkomst: 'afspraak' }, { accountId: 'a', soort: 'reis', gebeurtenis: 'overgedragen' }, { accountId: 'b', soort: 'contact', uitkomst: 'geen_interesse' }, { accountId: 'c', soort: 'contact', uitkomst: 'geen_reactie' }, { accountId: 'x', soort: 'reis', gebeurtenis: 'overgedragen' }],
    )
    expect(r).toMatchObject({ accounts: 3, bereikt: 2, gesprekken: 2, afsprakenGepland: 1, overgedragen: 1, conversie: 33, winpuntUitgevoerd: 50 })
  })
})

describe('overslagen en kanaaldekking', () => {
  const nu = new Date('2026-10-15T10:00:00Z')
  it('ritme, campagne, afkoeling en partner met reden en telling', () => {
    const r = overslagen([
      { id: '1', naam: 'Een', ritmeActief: true }, { id: '2', naam: 'Twee', ritmeActief: true }, { id: '3', naam: 'Drie', afkoelingTot: '2026-12-01' },
      { id: '4', naam: 'Vier', partner: 'p-1' }, { id: '5', naam: 'Vijf', campagneIds: ['cp-01'] }, { id: '6', naam: 'Zes', afkoelingTot: '2026-01-01' },
    ], 'direct', nu)
    expect(r.mee.map((a) => a.id)).toEqual(['6'])
    expect(r.samenvatting).toEqual(['2 zitten al in een ritme', '1 in afkoelperiode', '1 hoort bij een partner', '1 zit al in een campagne'])
    expect(overslagen([{ id: '4', naam: 'Vier', partner: 'p-1' }], 'partner', nu).mee).toHaveLength(1)
  })
  it('grens 80 procent; de tekst noemt de aantallen', () => {
    const met = (n: number, zonder: number) => [...Array(n).fill({ telefoon: true }), ...Array(zonder).fill({ telefoon: false })]
    expect(kanaalDekking(met(8, 2), 'bellen').mag).toBe(true)
    const d = kanaalDekking(met(23, 7), 'bellen')
    expect(d.mag).toBe(false)
    expect(d.tekst).toBe('23 van de 30 accounts hebben een telefoonnummer. Vul eerst de nummers aan of kies een ander kanaal voor de eerste stap.')
  })
})

describe('kolom, titel, omvang en afsluiter', () => {
  it('kolomUitUitkomst: afspraak, afgewezen, laatste poging zonder reactie parkeert', () => {
    expect(kolomUitUitkomst('afspraak')).toBe('afspraak')
    expect(kolomUitUitkomst('geen_interesse')).toBe('afgewezen')
    expect(kolomUitUitkomst('geen_reactie')).toBe('benaderd')
    expect(kolomUitUitkomst('geen_reactie', true)).toBe('geparkeerd')
    expect(kolomUitUitkomst('later')).toBe('in-gesprek')
    expect(kolomUitUitkomst(null)).toBeNull()
  })
  it('taakTitel en omvang (waarschuwing, geen blokkade)', () => {
    expect(taakTitel('Bel', 'Testinstallatie Noord', 'Koude ronde')).toBe('Bel Testinstallatie Noord (Koude ronde)')
    expect(omvangMelding(19)).toMatch(/20 tot 80/)
    expect(omvangMelding(20)).toBeNull()
    expect(omvangMelding(80)).toBeNull()
    expect(omvangMelding(81)).toMatch(/splitsen/)
  })
  it('isAfgelopen: pas de dag na de einddatum, alleen actief', () => {
    expect(isAfgelopen({ status: 'actief', endsAt: '2026-10-15' }, new Date('2026-10-15T20:00:00Z'))).toBe(false)
    expect(isAfgelopen({ status: 'actief', endsAt: '2026-10-15' }, new Date('2026-10-15T23:00:00Z'))).toBe(true)
    expect(isAfgelopen({ status: 'concept', endsAt: '2026-10-01' }, new Date('2026-10-15T10:00:00Z'))).toBe(false)
  })
})
