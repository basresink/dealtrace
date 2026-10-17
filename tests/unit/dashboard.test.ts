import { describe, expect, it } from 'vitest'
import {
  activiteitReeks, asMax, DASH_KANALEN, KANAAL_LABEL, dashboardPeriode, dashboardTitel, delta, doelStand, funnelTegels, kanaalVan, maandenTerug, normRegels,
  prospectDekking, uitkomsten, uitvalTotaal,
} from '../../shared/dashboard'
import { kpi, type KpiActiviteit } from '../../shared/team'

const act = (dag: string, soort = 'gebeld', uitkomst: string | null = 'geen_reactie', extra: Partial<KpiActiviteit> = {}): KpiActiviteit => ({ door: 'u', op: `${dag}T09:00:00.000Z`, soort, uitkomst, accountId: 'a', ...extra })

describe('dashboardPeriode', () => {
  it('deze maand loopt van de eerste tot vandaag, met dezelfde dagen vorige maand', () => {
    const p = dashboardPeriode({}, '2026-10-16')
    expect(p).toMatchObject({ sleutel: 'maand', van: '2026-10-01', tot: '2026-10-16', eind: '2026-10-31', label: 'Deze maand' })
    expect(p.vorige).toEqual({ van: '2026-09-01', tot: '2026-09-16' })
  })
  it('deze week begint op maandag; het einde is zondag', () => {
    const p = dashboardPeriode({ periode: 'week' }, '2026-10-16')
    expect(p).toMatchObject({ van: '2026-10-12', tot: '2026-10-16', eind: '2026-10-18' })
    expect(p.vorige).toEqual({ van: '2026-10-05', tot: '2026-10-09' })
  })
  it('dit kwartaal en de vergelijking drie maanden eerder', () => {
    const p = dashboardPeriode({ periode: 'kwartaal' }, '2026-10-16')
    expect(p).toMatchObject({ van: '2026-10-01', eind: '2026-12-31' })
    expect(p.vorige).toEqual({ van: '2026-07-01', tot: '2026-07-16' })
  })
  it('eigen periode: nooit voorbij vandaag, hoogstens een jaar, vergelijking met even lang ervoor', () => {
    const p = dashboardPeriode({ periode: 'eigen', van: '2026-10-01', tot: '2026-12-01' }, '2026-10-16')
    expect(p).toMatchObject({ van: '2026-10-01', tot: '2026-10-16', eind: '2026-10-16' })
    expect(p.vorige).toEqual({ van: '2026-09-15', tot: '2026-09-30' })
    expect(dashboardPeriode({ periode: 'eigen', van: '2020-01-01', tot: '2026-10-16' }, '2026-10-16').van).toBe('2025-10-16')
  })
  it('onbekend of eigen zonder datum valt terug op deze maand', () => {
    expect(dashboardPeriode({ periode: 'jaar' }, '2026-10-16').sleutel).toBe('maand')
    expect(dashboardPeriode({ periode: 'eigen' }, '2026-10-16').sleutel).toBe('maand')
  })
  it('maandenTerug begrenst op het einde van de maand', () => {
    expect(maandenTerug('2026-03-31', 1)).toBe('2026-02-28')
    expect(maandenTerug('2026-01-15', 1)).toBe('2025-12-15')
  })
})

describe('delta', () => {
  it('geeft richting en een zin zonder procent', () => {
    expect(delta(5, 3, 'vorige week')).toEqual({ verschil: 2, richting: 'op', tekst: '+2 t.o.v. vorige week' })
    expect(delta(1, 3, 'vorige week').richting).toBe('neer')
    expect(delta(2, 2, 'vorige week').tekst).toBe('gelijk aan vorige week')
  })
})

describe('activiteitReeks', () => {
  const p = { van: '2026-10-01', tot: '2026-10-07' }
  it('elke dag staat erin, gestapeld per kanaal; intern overleg en andere gebruikers tellen niet', () => {
    const r = activiteitReeks([
      act('2026-10-01'), act('2026-10-01', 'mail', 'verzonden'), act('2026-10-03', 'gebeld', 'afspraak'),
      act('2026-10-03', 'gebeld', 'gesproken', { intern: true }), act('2026-10-04', 'gebeld', 'gesproken', { door: 'ander' }), act('2026-10-09'),
      act('2026-10-02', 'notitie', null),
    ], p, 'u')
    expect(r.per).toBe('dag')
    expect(r.punten).toHaveLength(7)
    expect(r.punten[0]!.delen).toMatchObject({ bellen: 1, mail: 1 })
    expect(r.punten[2]!).toMatchObject({ totaal: 1, gesprekken: 1 })
    expect(r.totaal).toBe(3)
    expect(r.max).toBe(2)
    expect(r.punten.filter((x) => x.kern).map((x) => x.sleutel)).toEqual(['2026-10-01', '2026-10-05'])
  })
  it('langer dan 31 dagen telt per week vanaf maandag', () => {
    const r = activiteitReeks([act('2026-07-01'), act('2026-07-02'), act('2026-08-10')], { van: '2026-07-01', tot: '2026-09-30' })
    expect(r.per).toBe('week')
    expect(r.punten[0]!.sleutel).toBe('2026-06-29')
    expect(r.punten[0]!.totaal).toBe(2)
    expect(r.punten.find((x) => x.sleutel === '2026-08-10')!.totaal).toBe(1)
  })
  it('kanaalVan: WhatsApp en SMS los, op het kanaal van een bericht; een kaart is overig', () => {
    expect(kanaalVan({ soort: 'whatsapp' })).toBe('whatsapp')
    expect(kanaalVan({ soort: 'bericht', kanaal: 'whatsapp' })).toBe('whatsapp')
    expect(kanaalVan({ soort: 'bericht' })).toBe('whatsapp')
    expect(kanaalVan({ soort: 'bericht', kanaal: 'sms' })).toBe('sms')
    expect(kanaalVan({ soort: 'bericht', kanaal: 'linkedin' })).toBe('linkedin')
    expect(kanaalVan({ soort: 'bezoek' })).toBe('bezoek')
    expect(kanaalVan({ soort: 'kaart' })).toBe('overig')
  })
  it('een afgeronde WhatsApp- en SMS-taak staan per dag in hun eigen kanaal', () => {
    const r = activiteitReeks([
      act('2026-10-02', 'bericht', 'verzonden', { kanaal: 'whatsapp' }), act('2026-10-02', 'bericht', 'verzonden', { kanaal: 'sms' }),
      act('2026-10-02', 'bericht', 'gesproken', { kanaal: 'sms' }),
    ], p, 'u')
    expect(r.punten[1]!.delen).toMatchObject({ whatsapp: 1, sms: 2, bezoek: 0, overig: 0 })
    expect(r.punten[1]!).toMatchObject({ totaal: 3, gesprekken: 1 })
    expect(Object.keys(r.punten[1]!.delen)).toEqual([...DASH_KANALEN])
    expect(DASH_KANALEN.map((k) => KANAAL_LABEL[k])).toEqual(['Bellen', 'Mail', 'LinkedIn', 'WhatsApp', 'SMS', 'Bezoek', 'Overig'])
  })
  it('asMax rondt naar 1, 2, 5 of 10 maal een macht van tien', () => {
    expect([0, 3, 7, 12, 48, 51].map(asMax)).toEqual([1, 5, 10, 20, 50, 100])
  })
})

describe('uitkomsten', () => {
  it('groepeert in vaste volgorde en laat lege groepen weg', () => {
    const u = uitkomsten([act('2026-10-01', 'gebeld', 'voicemail'), act('2026-10-01', 'gebeld', 'afspraak'), act('2026-10-02', 'gebeld', 'bezet'), act('2026-10-02', 'gebeld', 'geen_reactie'), act('2026-10-02', 'gebeld', null)], { van: '2026-10-01', tot: '2026-10-31' })
    expect(u.map((x) => [x.sleutel, x.aantal])).toEqual([['afspraak', 1], ['geen', 2], ['voicemail', 1], ['overig', 1]])
  })
})

describe('prospectDekking', () => {
  it('verdeelt over zes bakken; zonder contact is de koudste bak', () => {
    const nu = new Date('2026-10-16T12:00:00Z')
    const d = prospectDekking(['2026-10-15T12:00:00Z', '2026-10-05T12:00:00Z', '2026-09-20T12:00:00Z', '2026-08-01T12:00:00Z', null], nu)
    expect(d.bakken.map((b) => b.aantal)).toEqual([1, 1, 1, 0, 1, 1])
    expect(d).toMatchObject({ recent: 3, actief: 5, zonderContact: 1, procent: 60 })
    expect(prospectDekking([], nu).procent).toBe(0)
  })
})

describe('doelStand', () => {
  it('rekent het doel over de hele maand en het verwachte aantal tot vandaag', () => {
    // Oktober 2026: 22 werkdagen; 1 t/m 16 oktober zijn 12 werkdagen. Binnendienst: 25 per dag.
    const d = doelStand(270, { van: '2026-10-01', tot: '2026-10-16', eind: '2026-10-31' }, 'binnendienst', '2026-10-16')
    expect(d).toMatchObject({ doel: 550, verwacht: 300, pct: 49, verwachtPct: 55, stand: 'op schema', resterend: 280, werkdagenRest: 10, perDag: 28, afgerond: false })
    expect(d.prognose).toBe(495)
    expect(doelStand(100, { van: '2026-10-01', tot: '2026-10-16', eind: '2026-10-31' }, 'binnendienst', '2026-10-16').stand).toBe('achter')
    expect(doelStand(300, { van: '2026-10-01', tot: '2026-10-16', eind: '2026-10-31' }, 'binnendienst', '2026-10-16').stand).toBe('voor')
  })
  it('een afgelopen eigen periode heeft geen resterende werkdagen', () => {
    const d = doelStand(10, { van: '2026-10-05', tot: '2026-10-09', eind: '2026-10-09' }, 'buitendienst', '2026-10-16')
    expect(d).toMatchObject({ doel: 50, afgerond: true, werkdagenRest: 0, perDag: 0 })
  })
})

describe('normRegels en dashboardTitel', () => {
  const p = { van: '2026-10-01', tot: '2026-10-31' }
  const acts = [act('2026-10-01', 'gebeld', 'afspraak'), act('2026-10-02', 'gebeld', 'gesproken', { beslisser: true }), act('2026-10-02', 'gebeld', 'gesproken'), act('2026-10-03')]
  const k = kpi('u', p, acts)
  it('zet je cijfer naast de norm met een oordeel', () => {
    const r = normRegels(k, { gepland: 1, gehouden: 1 })
    expect(r.map((x) => [x.sleutel, x.waarde, x.stand])).toEqual([
      ['gesprekNaarAfspraak', '33%', 'boven'], ['beslisserBereikt', '33%', 'boven'], ['pogingenTotAfspraak', '4', 'boven'], ['geplandNaarGehouden', '100%', 'boven'],
    ])
    expect(normRegels(kpi('u', p, []), { gepland: 0, gehouden: 0 }).every((x) => x.stand === 'geen')).toBe(true)
  })
  it('kop noemt pogingen, gesprekken en afspraken; de duiding de hefboom', () => {
    const doel = doelStand(4, { van: '2026-10-01', tot: '2026-10-16', eind: '2026-10-31' }, 'binnendienst', '2026-10-16')
    const t = dashboardTitel({ pogingen: 4, gesprekken: 3, afspraken: 1, doel, conversie: k.gesprekNaarAfspraak, verlopen: 0, label: 'Deze maand' })
    expect(t.titel).toBe('4 pogingen, 3 gesprekken en 1 afspraak deze maand.')
    expect(t.duiding).toContain('achter op je pogingendoel')
    expect(dashboardTitel({ pogingen: 0, gesprekken: 0, afspraken: 0, doel: { ...doel, stand: 'geen' }, conversie: { waarde: 0, noemer: 0 }, verlopen: 0, label: 'Deze week' }).titel).toBe('Nog geen contactpogingen deze week.')
  })
})

describe('funnelTegels en uitvalTotaal', () => {
  const fases = [
    { faseId: 'gevonden', aantal: 10, doorgestroomd: 8, uitgevallen: 2, aanwezig: 0, doorlooptijd: 2, uitval: [{ reden: 'Nee', aantal: 2 }] },
    { faseId: 'benaderd', aantal: 8, doorgestroomd: 4, uitgevallen: 3, aanwezig: 1, doorlooptijd: 5.5, uitval: [{ reden: 'Geparkeerd', aantal: 2 }, { reden: 'Nee', aantal: 1 }] },
    { faseId: 'afspraak-gepland', aantal: 4, doorgestroomd: 3, uitgevallen: 1, aanwezig: 0, doorlooptijd: 10, uitval: [{ reden: 'No-show', aantal: 1 }] },
    { faseId: 'afspraak-gehouden', aantal: 3, doorgestroomd: 2, uitgevallen: 0, aanwezig: 1, doorlooptijd: null },
    { faseId: 'overgedragen', aantal: 2, doorgestroomd: 0, uitgevallen: 0, aanwezig: 2 },
  ]
  it('telt instroom, afspraken, overdrachten en de doorlooptijd tot de eerste afspraak', () => {
    expect(funnelTegels(fases, 10)).toEqual({
      instroom: 10, gepland: 4, gehouden: 3, overgedragen: 2, uitval: 6, naarAfspraak: 40, naarOverdracht: 20, gehoudenVanGepland: 75,
      doorlooptijdTotAfspraak: 7.5, topReden: { reden: 'Nee', aantal: 3 },
    })
    expect(funnelTegels([], 0)).toMatchObject({ naarAfspraak: null, doorlooptijdTotAfspraak: null, topReden: null })
  })
  it('somt de redenen over de fases met de fase waar ze het meest voorkomen', () => {
    expect(uitvalTotaal(fases)).toEqual([
      { reden: 'Nee', aantal: 3, fase: 'Gevonden' }, { reden: 'Geparkeerd', aantal: 2, fase: 'Benaderd' }, { reden: 'No-show', aantal: 1, fase: 'Afspraak gepland' },
    ])
  })
})
