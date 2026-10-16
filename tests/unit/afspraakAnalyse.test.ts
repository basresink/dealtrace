// Bezoek- en meetinganalyse: venster, dekking per account en regio, ritme per klasse, cijfers over
// afspraken (conversie, verslag, doorlooptijd naar vervolg) en regiodagen met routes.
import { describe, expect, it } from 'vitest'
import {
  afspraakCijfers, bezoekKpi, cijfersPerSoort, dekkingPerAccount, doorlooptijden, klasseDekking, leesVenster, mediaan, meetingKpi, regioDekking,
  regioRitme, regiodagenEnRoutes, ritmeStatus, vasteDagen, type AnalyseAccount, type AnalyseAfspraak,
} from '../../shared/afspraakAnalyse'
import type { Regio } from '../../shared/gebieden'

const NU = new Date('2026-10-16T10:00:00Z')
const dagenTerug = (n: number) => new Date(NU.getTime() - n * 864e5).toISOString()
const REGIOS: Regio[] = [
  { id: 'r-noord', naam: 'Regio Noord', reeksen: [{ van: 9000, tot: 9999 }], plaatsen: [], eigenaren: { buitendienst: ['u-1'], binnendienst: [] }, dagen: [{ gebruikerId: 'u-1', weekdag: 4, weken: 'alle' }, { gebruikerId: 'u-1', weekdag: 1, weken: 'alle' }] },
  { id: 'r-zuid', naam: 'Regio Zuid', reeksen: [], plaatsen: ['Testdorp'], eigenaren: { buitendienst: [], binnendienst: [] }, dagen: [] },
]
const acc = (id: string, x: Partial<AnalyseAccount> = {}): AnalyseAccount => ({ id, naam: `Test ${id}`, soort: 'prospect', nbStatus: 'in reis', regioId: 'r-noord', klasseCode: 'A', ...x })
const afs = (id: string, x: Partial<AnalyseAfspraak> = {}): AnalyseAfspraak => ({ id, accountId: 'a1', ownerId: 'u-1', soortSlug: 'kennismaking', soortNaam: 'Kennismaking', vorm: 'online', status: 'afgerond', start: dagenTerug(10), uitkomstCode: 'vervolg', uitkomstLabel: 'Vervolg afgesproken', gevolg: 'gehouden', verslag: true, transcript: false, notulist: false, ...x })

describe('leesVenster', () => {
  it('kwartaal is de ruststand: 90 dagen terug tot nu', () => {
    const b = leesVenster({}, NU)
    expect(b.venster).toBe('kwartaal')
    expect(b.dagen).toBe(90)
    expect(b.totMs).toBe(NU.getTime())
    expect(b.binnen).toBe('binnen 90 dagen')
  })
  it('periode loopt van begin tot en met einde; een begin na het eind schuift het eind mee', () => {
    const b = leesVenster({ venster: 'periode', van: '2026-09-01', tot: '2026-09-30' }, NU)
    expect(b.dagen).toBe(30)
    expect(new Date(b.totMs).toISOString()).toBe('2026-09-30T21:59:59.999Z')
    expect(leesVenster({ venster: 'periode', van: '2026-09-10', tot: '2026-09-01' }, NU).tot).toBe('2026-09-10')
  })
  it('een onbekend venster valt terug op kwartaal', () => expect(leesVenster({ venster: 'jaar' }, NU).venster).toBe('kwartaal'))
})

describe('dekking per account en per regio', () => {
  const accounts = [acc('a1'), acc('a2'), acc('a3', { soort: 'klant' }), acc('a4', { regioId: null, nbStatus: 'nieuw' }), acc('a5', { regioId: 'weg' })]
  const momenten = [{ accountId: 'a1', op: dagenTerug(5) }, { accountId: 'a2', op: dagenTerug(200) }, { accountId: 'a2', op: dagenTerug(120), soort: 'Inventarisatie' }]
  const d = dekkingPerAccount(accounts, momenten, leesVenster({}, NU), NU)
  it('gezien in het venster, stil daarbuiten, nooit zonder moment; het laatste moment telt voor de datum', () => {
    expect(d.get('a1')!.status).toBe('gezien')
    expect(d.get('a2')).toMatchObject({ status: 'stil', dagenGeleden: 120, soort: 'Inventarisatie' })
    expect(d.get('a3')!.status).toBe('nooit')
  })
  it('in een eerdere periode telt elk moment, ook als er daarna nog een was', () => {
    const b = leesVenster({ venster: 'periode', van: dagenTerug(210).slice(0, 10), tot: dagenTerug(190).slice(0, 10) }, NU)
    const oud = dekkingPerAccount(accounts, [...momenten, { accountId: 'a2', op: dagenTerug(1) }], b, NU)
    expect(oud.get('a2')!.status).toBe('gezien')
    expect(oud.get('a1')!.status).toBe('nooit')
  })
  it('regio\'s gesorteerd op stil en nooit, Zonder regio als laatste met wees-accounts', () => {
    const rijen = regioDekking(accounts, d, REGIOS)
    expect(rijen.map((r) => r.naam)).toEqual(['Regio Noord', 'Regio Zuid', 'Zonder regio'])
    expect(rijen[0]).toMatchObject({ totaal: 3, gezien: 1, stil: 1, nooit: 1, klanten: 1, dekking: 33, regiodag: 'ma, do' })
    expect(rijen[2]).toMatchObject({ totaal: 2, nooit: 2, nietBenaderd: 1 })
  })
  it('de cijfers: in beeld, stil of nooit, niet benaderd en dekking tegen het doel', () => {
    expect(bezoekKpi(accounts, d, NU)).toMatchObject({ inBeeld: 5, inEenRegio: 4, stilOfNooit: 4, nooit: 3, stil: 1, nietBenaderd: 1, dekking: 20, doel: 80 })
  })
  it('vaste dagen in weekvolgorde', () => expect(vasteDagen({ dagen: [{ gebruikerId: 'x', weekdag: 5, weken: 'alle' }, { gebruikerId: 'y', weekdag: 1, weken: 'oneven' }] })).toBe('ma, vr'))
})

describe('meetingritme per accountklasse', () => {
  const ritme = (code: string) => (code === 'A' ? { perJaar: 4, interval: 91, label: '4×/jaar' } : code === 'B' ? { perJaar: 2, interval: 183, label: '2×/jaar' } : { perJaar: 0, interval: null, label: 'uit' })
  const accounts = [acc('a1'), acc('a2'), acc('a3'), acc('b1', { klasseCode: 'B', soort: 'klant' }), acc('d1', { klasseCode: 'D' }), acc('z1', { klasseCode: null })]
  const laatste = new Map<string, string | null>([['a1', dagenTerug(30)], ['a2', dagenTerug(100)], ['b1', dagenTerug(150)]])
  const k = klasseDekking(accounts, laatste, [{ code: 'A', naam: 'A · Groot' }, { code: 'B', naam: 'B · Midden' }], ritme, NU)
  it('op schema binnen het interval, achter daarbuiten, nooit zonder meeting; zonder doel geen status', () => {
    expect(ritmeStatus(dagenTerug(30), 91, NU)).toBe('opSchema')
    expect(ritmeStatus(dagenTerug(100), 91, NU)).toBe('achter')
    expect(ritmeStatus(null, 91, NU)).toBe('nooit')
    expect(ritmeStatus(null, null, NU)).toBeNull()
  })
  it('een rij per klassecode, ook voor codes die alleen op accounts staan; zonder klasse apart geteld', () => {
    expect(k.rijen.map((r) => r.code)).toEqual(['A', 'B', 'D'])
    expect(k.rijen[0]).toMatchObject({ totaal: 3, opSchema: 1, achter: 1, nooit: 1, namen: ['A · Groot'] })
    expect(k.rijen[1]).toMatchObject({ klanten: 1, opSchema: 1 })
    expect(k.rijen[2]).toMatchObject({ interval: null, opSchema: 0 })
    expect(k.zonderKlasse).toBe(1)
  })
  it('doel naar rato van de periode, achter en ritmedekking alleen over klassen met een doel', () => {
    expect(meetingKpi(k.rijen, 5, 90)).toEqual({ meetings: 5, doel: Math.round((4 * 3 + 2 * 1) * 90 / 365), achter: 2, dekking: 50, metDoel: 4 })
  })
  it('de regiobril telt alleen accounts met een meetingdoel', () => {
    const r = regioRitme(accounts, k.status, REGIOS)
    expect(r.find((x) => x.regioId === 'r-noord')).toMatchObject({ totaal: 4, opSchema: 2, achter: 1, nooit: 1 })
  })
})

describe('cijfers over afspraken', () => {
  const alle = [
    afs('m1'), // vervolg, volgende afspraak 6 dagen later
    afs('m2', { start: dagenTerug(4), uitkomstCode: null, uitkomstLabel: null, gevolg: null, status: 'gepland', verslag: false }),
    afs('m3', { accountId: 'a2', uitkomstCode: 'geen-vervolg', uitkomstLabel: 'Geen interesse', gevolg: 'nee', verslag: false, transcript: true, notulist: true }),
    afs('m4', { accountId: 'a3', status: 'niet_verschenen', uitkomstCode: null, gevolg: null, soortSlug: 'belafspraak', soortNaam: 'Belafspraak', vorm: 'telefoon' }),
    afs('m5', { accountId: 'a4', start: dagenTerug(20), soortSlug: 'belafspraak', soortNaam: 'Belafspraak', vorm: 'telefoon', uitkomstCode: 'afspraak', uitkomstLabel: 'Afspraak gemaakt', gevolg: 'afspraak' }),
    afs('m6', { accountId: 'a4', start: dagenTerug(-3), status: 'geannuleerd', uitkomstCode: null, gevolg: null }),
    afs('m7', { accountId: 'a4', start: dagenTerug(-10), status: 'gepland', uitkomstCode: null, gevolg: null }),
  ]
  const inVenster = alle.filter((a) => Date.parse(a.start) <= NU.getTime())
  it('mediaan van even en oneven reeksen', () => {
    expect(mediaan([])).toBeNull()
    expect(mediaan([5, 1, 3])).toBe(3)
    expect(mediaan([1, 2, 3, 4])).toBe(2.5)
  })
  it('doorlooptijd naar de volgende niet-geannuleerde afspraak met hetzelfde account', () => {
    expect(doorlooptijden(inVenster, alle)).toEqual({ dagen: [6, 30], nietIngepland: [] })
    expect(doorlooptijden([afs('x', { accountId: 'a9' })], alle).nietIngepland).toEqual(['x'])
  })
  it('status, verslag, transcript, Notulist, uitkomsten en conversie', () => {
    const c = afspraakCijfers(inVenster, alle, NU)
    expect(c).toMatchObject({ totaal: 5, afgerond: 3, zonderAfronding: 1, nietVerschenen: 1, metVerslag: 2, metTranscript: 1, metNotulist: 1, vervolg: 2, conversie: 67, verslagProcent: 67 })
    expect(c.doorlooptijd).toEqual({ mediaan: 18, gemiddeld: 18, n: 2 })
    expect(c.uitkomsten.map((u) => [u.label, u.aantal, u.vervolg])).toEqual([['Afspraak gemaakt', 1, true], ['Geen interesse', 1, false], ['Vervolg afgesproken', 1, true]])
  })
  it('per soort, de drukste eerst', () => {
    const s = cijfersPerSoort(inVenster, alle, NU)
    expect(s.map((x) => [x.slug, x.totaal, x.afgerond])).toEqual([['kennismaking', 3, 2], ['belafspraak', 2, 1]])
  })
})

describe('regiodagen en routes', () => {
  // 12 okt 2026 is een maandag, 15 okt een donderdag.
  const p = (lat: number, lng: number) => ({ lat, lng })
  const bezoeken = [
    { ownerId: 'u-1', start: '2026-10-12T07:00:00Z', eind: '2026-10-12T08:00:00Z', accountId: 'a1', regioId: 'r-noord', punt: p(53.2, 6.5) },
    { ownerId: 'u-1', start: '2026-10-12T10:00:00Z', eind: '2026-10-12T11:00:00Z', accountId: 'a2', regioId: 'r-zuid', punt: p(53.0, 6.5) },
    { ownerId: 'u-1', start: '2026-10-14T10:00:00Z', eind: '2026-10-14T11:00:00Z', accountId: 'a3', regioId: null, punt: null },
    { ownerId: 'u-2', start: '2026-10-14T10:00:00Z', eind: '2026-10-14T11:00:00Z', accountId: 'a4', regioId: null, punt: null },
  ]
  const r = regiodagenEnRoutes(REGIOS, ['u-1'], bezoeken, '2026-10-12', '2026-10-16')
  it('elke regiodag en elke bezoekdag van de mensen in beeld, nieuwste eerst', () => {
    expect(r.dagen.map((d) => [d.datum, d.regioId, d.bezoeken])).toEqual([['2026-10-15', 'r-noord', 0], ['2026-10-14', null, 1], ['2026-10-12', 'r-noord', 2]])
  })
  it('in de regio, km tussen de stops en de samenvatting', () => {
    const ma = r.dagen.find((d) => d.datum === '2026-10-12')!
    expect(ma.inRegio).toBe(1)
    expect(ma.km).toBeGreaterThan(25)
    expect(r.samenvatting).toMatchObject({ regiodagen: 2, benut: 1, leeg: 1, bezoekenOpRegiodag: 2, gemiddeld: 2, inRegio: 50, bezoekdagen: 2 })
  })
  it('een feestdag is geen regiodag', () => {
    expect(regiodagenEnRoutes(REGIOS, ['u-1'], [], '2026-10-15', '2026-10-15', ['2026-10-15']).dagen).toEqual([])
  })
})
