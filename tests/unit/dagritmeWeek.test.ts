// Dagritme: weekreview (F10), weekstart, dagplanner (F3) en de mails. Pure functies met `nu` als
// parameter; fictieve data (Testbedrijven, .test-adressen).
import { describe, expect, it } from 'vitest'
import { bereikbaarheid, bereikVoorDoelgroep, bouwWeekstart, planDag, planModus, watSchoof, weekSamenvatting, weekVan, type BereikPoging, type PlanInput } from '../../shared/dagritme'
import { controleerMailTijd, dagstartMail, mailAanDeBeurt, mailDag, mailSleutel, mailVoorkeuren, weekreviewMail, weekstartMail } from '../../shared/dagritmeMail'
import { nlTijdstip, plusDagen } from '../../shared/datum'
import { MELDING_STANDAARD } from '../../shared/meldingsregels'
import type { KpiActiviteit } from '../../shared/team'
import { belblokMomenten, belmomenten, controleerVoornemens, maandagVan, reviewKlaar, voornemenStand, voornemenVoorstellen, weekreview, winpuntDatRaakte, type WeekreviewBron } from '../../shared/weekreview'

const VRIJDAG = '2026-10-16'
const MAANDAG = '2026-10-12'
const om = (d: string, u: number, m = 0) => nlTijdstip(d, u, m).toISOString()
const NU = nlTijdstip(VRIJDAG, 15, 45)
let n = 0
const bel = (d: string, u: number, uitkomst: string, extra: Partial<KpiActiviteit> = {}): KpiActiviteit => ({ id: `a${n++}`, door: 'u-01', op: om(d, u, 10), soort: 'gebeld', uitkomst, accountId: extra.accountId ?? `acc-${n}`, ...extra })

/** Acht eerdere weken met elk 2 gesprekken en 0 of 1 afspraak; deze week 6 gesprekken en 3 afspraken. */
function bron(extra: Partial<WeekreviewBron> = {}): WeekreviewBron {
  const act: KpiActiviteit[] = []
  for (let w = 1; w <= 8; w++) {
    const di = plusDagen(MAANDAG, -7 * w + 1)
    act.push(bel(di, 16, 'gesproken'), bel(di, 16, w % 2 ? 'afspraak' : 'gesproken'), bel(di, 9, 'geen_reactie'), bel(di, 9, 'geen_reactie'))
  }
  for (const [d, u, uk, acc] of [[MAANDAG, 9, 'geen_reactie', 'x1'], [MAANDAG, 9, 'voicemail', 'x2'], ['2026-10-13', 16, 'afspraak', 'acc-w1'], ['2026-10-13', 16, 'afspraak', 'acc-w2'], ['2026-10-13', 16, 'gesproken', 'x3'], ['2026-10-14', 16, 'afspraak', 'acc-w3'], ['2026-10-15', 16, 'gesproken', 'x4'], ['2026-10-15', 16, 'gesproken', 'x5']] as const) {
    act.push(bel(d, u, uk, { accountId: acc }))
  }
  return {
    gebruiker: { id: 'u-01', naam: 'Testgebruiker Anouk Noorderveld', werkplek: 'buitendienst' },
    activiteiten: act, overdrachten: [om('2026-10-14', 11)],
    blijvers: [
      { id: 't1', titel: 'Bel Testkoeling Noorderveld terug', accountNaam: 'Testkoeling Noorderveld', accountId: 'k1', verschoven: 4, dueDate: om(VRIJDAG, 9), actionType: 'bellen' },
      { id: 't2', titel: 'Dossier Testbouw Hoogwerf aanvullen', accountNaam: null, accountId: null, verschoven: 3, dueDate: om(VRIJDAG, 9), actionType: 'taak' },
      { id: 't3', titel: 'Een keer verschoven', accountNaam: null, accountId: null, verschoven: 1, dueDate: om(VRIJDAG, 9), actionType: 'taak' },
    ],
    winpunten: [{ accountId: 'acc-w1', titel: 'Levering binnen 24 uur' }, { accountId: 'acc-w2', titel: 'Levering binnen 24 uur' }, { accountId: 'acc-w3', titel: 'Vaste prijs per jaar' }],
    regios: [{ id: 'r1', naam: 'Testregio Eemland', stil: 5, accountIds: ['p1', 'p2', 'p3', 'p4', 'p5'], datum: '2026-10-22' }],
    zonderVerslag: 0, collegas: true,
    ...extra,
  }
}

describe('weekreview()', () => {
  it('vergelijkt met het eigen gemiddelde van acht weken', () => {
    const r = weekreview(bron(), NU)
    expect(r.week).toMatchObject({ nummer: 42, van: MAANDAG, tot: VRIJDAG, volgende: '2026-10-19' })
    const c = Object.fromEntries(r.bewoog.cijfers.map((x) => [x.sleutel, x]))
    expect(c.gesprekken).toMatchObject({ waarde: 6, gemiddelde: 2, tekst: '+4 tegen je gemiddelde', richting: 'hoger' })
    expect(c.afspraken).toMatchObject({ waarde: 3, gemiddelde: 0.5, richting: 'hoger' })
    expect(c.overdrachten).toMatchObject({ waarde: 1, gemiddelde: 0 })
    expect(c.bereik!.eenheid).toBe('%')
    expect(c.bereik!.tekst).toMatch(/punten tegen je gemiddelde/)
    expect(c.pogingen!.tekst).toMatch(/van je doel van 50$/) // buitendienst: 10 per werkdag, vijf werkdagen
    expect(r.bewoog.kop).toBe('3 afspraken, je beste week in twee maanden.')
    expect(r.titel).toBe('Een goede week, Anouk.')
    expect(r.bewoog.genoeg).toBe(true)
  })

  it('zegt eerlijk dat er te weinig is om te vergelijken', () => {
    const r = weekreview(bron({ activiteiten: [bel('2026-10-13', 16, 'afspraak')] }), NU)
    expect(r.bewoog.genoeg).toBe(false)
    expect(r.bewoog.cijfers[0]!.tekst).toBe('Te weinig om te vergelijken')
    expect(r.bewoog.melding).toMatch(/Te weinig om te vergelijken/)
    expect(r.werkte.patronen).toEqual([])
    expect(r.werkte.melding).toMatch(/vanaf 10 gesprekken/)
    expect(r.titel).toBe('Je week in het kort, Anouk.')
  })

  it('vindt het beste belmoment en het winpunt dat raakte', () => {
    const r = weekreview(bron(), NU)
    const moment = r.werkte.patronen.find((p) => p.soort === 'belmoment')!
    expect(moment.tekst).toMatch(/^Dinsdag 16:00 tot 17:00: \d+ van \d+ opgenomen/)
    expect(moment.tekst).toMatch(/Dinsdag 09:00: 0 van 16\.$/)
    expect(r.werkte.patronen.find((p) => p.soort === 'winpunt')!.tekst).toBe('"Levering binnen 24 uur" stond in je script bij 2 van je 3 afspraken.')
  })

  it('blijvers zijn taken die drie keer of vaker doorschoven, met de keuzes', () => {
    const r = weekreview(bron(), NU)
    expect(r.liggen.blijvers.map((b) => [b.id, b.tekst])).toEqual([['t1', '4 keer verschoven'], ['t2', '3 keer verschoven']])
    expect(r.liggen.blijvers[0]!.keuzes).toEqual(['inplannen', 'overdragen', 'loslaten'])
    expect(r.liggen.kop).toBe('2 taken schoof je drie keer of vaker door.')
    const zonder = weekreview(bron({ collegas: false }), NU)
    expect(zonder.liggen.blijvers[0]!.keuzes).toEqual(['inplannen', 'loslaten'])
    const besloten = weekreview(bron({ besluiten: { t1: { besluit: 'loslaten', reden: 'Klant koos een ander' }, t2: { besluit: 'inplannen', datum: '2026-10-20' } } }), NU)
    expect(besloten.liggen.kop).toBe('Elke blijver heeft een besluit.')
    expect(weekreview(bron({ blijvers: [] }), NU).liggen.kop).toBe('Niets bleef liggen. Geen taak schoof drie keer door.')
  })

  it('stelt voornemens voor die iets concreets worden, de eerste twee gekozen', () => {
    const r = weekreview(bron(), NU)
    const v = r.volgende.voorstellen
    expect(v[0]).toMatchObject({ sleutel: 'belmoment', soort: 'belblok', tekst: 'Belblok naar dinsdag en donderdag 16:00', data: { dagen: [2, 4], uur: 16 } })
    expect(v.find((x) => x.soort === 'regiodag')).toMatchObject({ tekst: 'Bezoeken in Testregio Eemland combineren', wordt: 'Wordt: regiodag donderdag met 4 bezoeken', data: { datum: '2026-10-22', accountIds: ['p1', 'p2', 'p3', 'p4'] } })
    expect(v.filter((x) => x.gekozen)).toHaveLength(2)
    expect(v.length).toBeLessThanOrEqual(5)
    expect(r.volgende.kop).toBe('Kies tot 3 voornemens.')
    const binnen = weekreview(bron({ gebruiker: { id: 'u-01', naam: 'Anouk', werkplek: 'binnendienst' } }), NU)
    expect(binnen.volgende.voorstellen.some((x) => x.soort === 'regiodag')).toBe(false)
    const ingepland = weekreview(bron({ ingepland: [{ id: 'v1', tekst: 'Belblok', soort: 'belblok', status: 'gepland', gedeeld: false, data: {} }] }), NU)
    expect(ingepland.volgende.voorstellen).toEqual([])
    expect(ingepland.volgende.kop).toBe('1 voornemen staat in volgende week.')
  })

  it('staat vrijdag vanaf 15:30 klaar', () => {
    expect(reviewKlaar(nlTijdstip(VRIJDAG, 15, 29))).toBe(false)
    expect(reviewKlaar(nlTijdstip(VRIJDAG, 15, 30))).toBe(true)
    expect(reviewKlaar(nlTijdstip('2026-10-14', 16))).toBe(false)
    expect(weekreview(bron(), nlTijdstip('2026-10-14', 10)).moment).toMatch(/Vrijdag om 15:30/)
    expect(maandagVan('2026-10-18')).toBe(MAANDAG)
  })

  it('belmomenten tellen alleen vanaf vijf pogingen per uur', () => {
    const l = [bel(MAANDAG, 10, 'gesproken'), bel(MAANDAG, 10, 'gesproken'), bel(MAANDAG, 10, 'gesproken')]
    expect(belmomenten(l, 'u-01').beste).toBeNull()
    expect(winpuntDatRaakte(['a'], [{ accountId: 'a', titel: 'X' }])).toBeNull()
  })

  it('voornemens: hooguit drie, met tekst en zonder gedachtestreepjes', () => {
    expect(controleerVoornemens([])).toContain('Kies minstens één voornemen')
    expect(controleerVoornemens([{ soort: 'taak', tekst: 'a' }, { soort: 'taak', tekst: 'b' }, { soort: 'taak', tekst: 'c' }, { soort: 'taak', tekst: 'd' }])).toContain('Hooguit 3 voornemens')
    expect(controleerVoornemens([{ soort: 'taak', tekst: 'Bel eerst — dan mail' }])).toContain('Gebruik geen gedachtestreepjes')
    expect(controleerVoornemens([{ soort: 'iets', tekst: 'x' }])).toContain('Onbekende soort voornemen')
    expect(controleerVoornemens([{ soort: 'belblok', tekst: 'Belblok dinsdag 16:00' }])).toEqual([])
  })

  it('belblokMomenten zet de dagen in de week van maandag, zonder feestdagen', () => {
    expect(belblokMomenten({ dagen: [2, 4], uur: 16 }, '2026-10-19')).toEqual([{ datum: '2026-10-20', uur: 16, minuut: 0, minuten: 60 }, { datum: '2026-10-22', uur: 16, minuut: 0, minuten: 60 }])
    expect(belblokMomenten({ dagen: [1], uur: 10 }, '2026-12-21').map((m) => m.datum)).toEqual(['2026-12-21'])
    expect(belblokMomenten({ dagen: [5], uur: 10 }, '2026-12-21')).toEqual([]) // eerste kerstdag
  })

  it('voornemenStand telt gehouden belblokken en afgeronde taken', () => {
    const bronS = { taken: [{ id: 'k1', status: 'klaar' }, { id: 'k2', status: 'open' }], sessies: [{ id: 's1', status: 'klaar' }, { id: 's2', status: 'gepland', start: om('2026-10-22', 16) }] }
    expect(voornemenStand({ soort: 'belblok', status: 'gepland', data: { sessieIds: ['s1', 's2'] } }, bronS, NU)).toMatchObject({ tekst: '1 van 2 belblokken gehouden, 1 nog gepland', klaar: false })
    expect(voornemenStand({ soort: 'taak', status: 'gepland', data: { taakIds: ['k1'] } }, bronS)).toMatchObject({ tekst: 'Gedaan', klaar: true })
    expect(voornemenStand({ soort: 'regiodag', status: 'gepland', data: { taakIds: ['k1', 'k2'] } }, bronS).tekst).toBe('1 van 2 bezoeken gedaan')
    expect(voornemenStand({ soort: 'belblok', status: 'gepland', data: { sessieIds: ['weg'] } }, bronS).tekst).toBe('Geen belblok meer in je agenda')
  })

  it('voornemenVoorstellen vult aan tot minstens twee', () => {
    const v = voornemenVoorstellen({ beste: null, tempoAchter: false, beslisserLaag: false, zonderVerslag: 0, regios: [], werkplek: 'binnendienst', volgende: '2026-10-19', blijvers: 0 })
    expect(v.length).toBeGreaterThanOrEqual(1)
    expect(v[0]!.soort).toBe('belblok')
  })
})

describe('weekstart', () => {
  const bronW = {
    gebruiker: { id: 'u-03', naam: 'Testgebruiker Sanne Belhuis', werkplek: 'binnendienst' },
    afspraken: [
      { id: 'ap1', start: om(MAANDAG, 10), eind: om(MAANDAG, 11), titel: 'Kennismaking', accountId: 'a1', accountNaam: 'Testinstallatie Spanning', vorm: 'online', eerste: true },
      { id: 'ap2', start: om('2026-10-14', 13), eind: om('2026-10-14', 14), titel: 'Gepland bezoek', accountId: 'a2', accountNaam: 'Testbouw Hoogwerf', vorm: 'bezoek' },
    ],
    belblokken: [{ id: 'b1', start: om(MAANDAG, 9), eind: om(MAANDAG, 10), status: 'gepland', gesprekken: 12 }, { id: 'b2', start: om(MAANDAG, 15), eind: om(MAANDAG, 16), status: 'geannuleerd' }],
    voornemens: [{ id: 'v1', tekst: 'Belblok naar dinsdag 16:00', soort: 'belblok', gedeeld: true, stand: { tekst: '0 van 1 belblokken gehouden', klaar: false } }],
    open: { totaal: 14, achterstallig: 2, dezeWeek: 9, blijvers: 1 },
    pogingen: 0,
    aanleidingen: [{ id: 's1', titel: 'Testbouw zoekt monteurs', accountId: 'a2', accountNaam: 'Testbouw Hoogwerf', relevantie: 80, op: om(MAANDAG, 7) }, { id: 's2', titel: 'Testzorg opent vestiging', accountId: 'a3', accountNaam: 'Testzorg', relevantie: 95, op: om(MAANDAG, 6) }],
  }
  it('bouwt het weekplan op maandag', () => {
    const w = bouwWeekstart(bronW, nlTijdstip(MAANDAG, 7, 30))
    expect(w.vorm).toBe('weekstart')
    expect(w.titel).toBe('Goedemorgen, Sanne. Een nieuwe week.')
    expect(w.kicker).toBe('Weekstart · week 42')
    expect(w.samenvatting).toBe('1 afspraak, 1 bezoek, 1 belblok en 1 voornemen.')
    expect(w.dagen).toHaveLength(5)
    expect(w.dagen[0]!.items.map((i) => [i.tijd, i.soort])).toEqual([['09:00', 'belblok'], ['10:00', 'afspraak']])
    expect(w.dagen[0]!.items[1]!.sub).toBe('Eerste afspraak')
    expect(w.dagen[2]!.items[0]).toMatchObject({ soort: 'bezoek', titel: 'Gepland bezoek met Testbouw Hoogwerf' })
    expect(w.tempo).toMatchObject({ doel: 125, perDag: 25, stand: 'geen' })
    expect(w.open.tekst).toBe('14 taken staan open, 9 met een datum deze week, 2 over tijd, 1 blijver.')
    expect(w.aanleidingen.map((a) => a.id)).toEqual(['s2', 's1'])
  })
  it('in het weekend al de week erna; zonder iets een eerlijke samenvatting', () => {
    expect(weekVan(nlTijdstip('2026-10-18', 20))).toEqual({ van: '2026-10-19', tot: '2026-10-23' })
    expect(weekSamenvatting([[0, 'a', 'b']])).toBe('Nog niets gepland deze week.')
    const w = bouwWeekstart({ ...bronW, pogingen: 30 }, nlTijdstip('2026-10-14', 9))
    expect(w.tempo.stand).toBe('achter') // 30 van 50 na twee werkdagen
    expect(w.titel).toMatch(/Je week in één blik\.$/)
  })
})

describe('dagplanner', () => {
  const pogingen: BereikPoging[] = []
  for (let i = 0; i < 20; i++) pogingen.push({ op: om('2026-10-13', 9, i), brancheId: 'br-1', gesproken: i < 2 }, { op: om('2026-10-13', 16, i), brancheId: 'br-1', gesproken: i < 7 })
  for (let i = 0; i < 10; i++) pogingen.push({ op: om('2026-10-13', 10, i), brancheId: 'br-2', gesproken: true })
  it('rekent de bereikbaarheid per uur en branche uit belpogingen', () => {
    const b = bereikbaarheid(pogingen, ['br-1'])
    expect(b.pogingen).toBe(40)
    expect(b.genoeg).toBe(true)
    expect(b.uren.find((u) => u.uur === 9)!.procent).toBe(10)
    expect(b.uren.find((u) => u.uur === 16)!.procent).toBe(35)
    expect(b.uren.find((u) => u.uur === 10)!.procent).toBeNull()
    expect(bereikVoorDoelgroep(pogingen, ['br-2']).bron).toBe('alle') // te weinig in br-2
  })
  const basis = (extra: Partial<PlanInput> = {}): PlanInput => ({
    dag: '2026-10-19', nu: nlTijdstip('2026-10-19', 7), modus: 'buiten', vast: [
      { id: 'ap1', soort: 'bezoek', start: om('2026-10-19', 10), eind: om('2026-10-19', 11), titel: 'Bezoek Testinstallatie Vonkdal', accountId: 'a1', reisMinuten: 24, eerste: true },
      { id: 'ap2', soort: 'afspraak', start: om('2026-10-19', 13), eind: om('2026-10-19', 14), titel: 'Online Testzorg Lindehof', accountId: 'a2' },
    ],
    belblokken: [], belTaken: 6, acties: 3, bereik: bereikbaarheid(pogingen, ['br-1']), ...extra,
  })
  it('afspraken vast, reistijd ervoor, voorbereiding, lunch en het belblok op het beste uur', () => {
    const p = planDag(basis())
    const kort = p.blokken.map((b) => [b.soort, b.start])
    expect(kort).toContainEqual(['reis', om('2026-10-19', 9, 36)])
    expect(kort).toContainEqual(['voorbereiding', om('2026-10-19', 9, 6)])
    expect(kort).toContainEqual(['lunch', om('2026-10-19', 12)])
    expect(p.voorstellen).toHaveLength(1)
    expect(p.voorstellen[0]!.start).toBe(om('2026-10-19', 16))
    expect(p.belUur).toBe(16)
    expect(p.belUitleg).toBe('Daarom ligt het belblok om 16:00: 35% neemt dan op tegen 10% om 09:00.')
    expect(p.samenvatting).toBe('1 afspraak, 1 bezoek, 1 belblok')
  })
  it('binnendienst: belblokken voor alle belacties (hooguit drie) en een focusblok', () => {
    const p = planDag(basis({ modus: 'binnen', belTaken: 25 }))
    expect(p.voorstellen).toHaveLength(3)
    expect(p.blokken.some((b) => b.soort === 'focus')).toBe(true)
    expect(p.voorstellen[0]!.sub).toMatch(/beste uur/)
  })
  it('een bezet beste uur schuift naar het beste vrije uur, en zonder data het eerste vrije uur', () => {
    const p = planDag(basis({ belblokken: [], vast: [{ id: 'x', soort: 'afspraak', start: om('2026-10-19', 16), eind: om('2026-10-19', 17), titel: 'Overleg' }] }))
    expect(p.belUur).not.toBe(16)
    expect(p.belUitleg).toMatch(/het beste vrije uur/)
    const leeg = planDag(basis({ bereik: bereikbaarheid([]) }))
    expect(leeg.belUitleg).toMatch(/Nog te weinig belpogingen \(0 van 30\)/)
    expect(leeg.voorstellen[0]!.start).toBe(om('2026-10-19', 8))
  })
  it('na het werk is er geen vrij uur meer; zonder belacties buiten geen belblok', () => {
    expect(planDag(basis({ nu: nlTijdstip('2026-10-19', 18, 30) })).voorstellen).toEqual([])
    expect(planDag(basis({ belTaken: 0 })).belUitleg).toMatch(/geen belblok nodig/)
  })
  it('wat schoof: verzet, vervallen, nieuw en het belblok', () => {
    const oud = planDag(basis()).blokken
    const nieuw = planDag(basis({ vast: [{ id: 'ap1', soort: 'bezoek', start: om('2026-10-19', 11), eind: om('2026-10-19', 12), titel: 'Bezoek Testinstallatie Vonkdal' }, { id: 'ap3', soort: 'afspraak', start: om('2026-10-19', 16), eind: om('2026-10-19', 17), titel: 'Online Testkoeling' }] })).blokken
    const s = watSchoof(oud, nieuw)
    expect(s).toContain('Bezoek Testinstallatie Vonkdal is verzet van 10:00 naar 11:00.')
    expect(s).toContain('Online Testzorg Lindehof staat niet meer in je agenda.')
    expect(s).toContain('Nieuw: Online Testkoeling om 16:00.')
    expect(s.some((x) => x.startsWith('Het belblok schoof van 16:00 naar'))).toBe(true)
    expect(watSchoof(null, nieuw)).toEqual([])
  })
  it('planModus volgt de keuze, anders de werkplek', () => {
    expect(planModus('binnendienst', 'buiten', 0)).toBe('buiten')
    expect(planModus('buitendienst', null, 0)).toBe('buiten')
    expect(planModus('hybride', null, 2)).toBe('buiten')
    expect(planModus('hybride', null, 0)).toBe('binnen')
  })
})

describe('dagritme per mail', () => {
  it('voorkeuren: standaard uit, met een geldig tijdstip', () => {
    expect(mailVoorkeuren(null)).toEqual({ weekreview: { aan: false, tijd: '15:30' }, weekstart: { aan: false, tijd: '07:30' }, dagstart: { aan: false, tijd: '07:00' } })
    expect(mailVoorkeuren({ dagstart: { aan: true, tijd: '25:00' } }).dagstart).toEqual({ aan: true, tijd: '07:00' })
    expect(controleerMailTijd('07:30')).toBeNull()
    expect(controleerMailTijd('05:00')).toMatch(/tussen 06:00 en 20:00/)
    expect(controleerMailTijd('07:10')).toMatch(/kwartier/)
    expect(mailSleutel('weekreview', VRIJDAG)).toBe('mail:weekreview:2026-10-16')
  })
  it('de juiste dag: weekstart de eerste werkdag, weekreview de laatste, dagstart elke werkdag', () => {
    expect(mailDag('weekstart', '2026-10-14')).toBe(MAANDAG)
    expect(mailDag('weekreview', '2026-10-14')).toBe(VRIJDAG)
    expect(mailDag('dagstart', '2026-10-17')).toBeNull()
    expect(mailDag('weekstart', '2026-12-29')).toBe('2026-12-28')
    expect(mailDag('weekreview', '2026-12-22')).toBe('2026-12-24') // kerst op vrijdag
  })
  it('op of na het tijdstip, buiten de stille uren, binnen het venster', () => {
    const v = { aan: true, tijd: '15:30' }
    expect(mailAanDeBeurt('weekreview', v, nlTijdstip(VRIJDAG, 15, 20), MELDING_STANDAARD)).toBeNull()
    expect(mailAanDeBeurt('weekreview', v, nlTijdstip(VRIJDAG, 15, 30), MELDING_STANDAARD)?.toISOString()).toBe(om(VRIJDAG, 15, 30))
    expect(mailAanDeBeurt('weekreview', v, nlTijdstip(VRIJDAG, 19, 0), MELDING_STANDAARD)).toBeNull() // venster voorbij
    expect(mailAanDeBeurt('weekreview', v, nlTijdstip('2026-10-15', 15, 45), MELDING_STANDAARD)).toBeNull() // donderdag
    expect(mailAanDeBeurt('weekreview', { ...v, aan: false }, nlTijdstip(VRIJDAG, 15, 45), MELDING_STANDAARD)).toBeNull()
    // Dagstart om 06:30 valt in de stille uren (tot 07:00): hij komt om 07:00.
    const d = { aan: true, tijd: '06:30' }
    expect(mailAanDeBeurt('dagstart', d, nlTijdstip(MAANDAG, 6, 45), MELDING_STANDAARD)).toBeNull()
    expect(mailAanDeBeurt('dagstart', d, nlTijdstip(MAANDAG, 7, 5), MELDING_STANDAARD)?.toISOString()).toBe(om(MAANDAG, 7))
    // Stilte die tot de volgende dag loopt: niet versturen.
    expect(mailAanDeBeurt('weekreview', { aan: true, tijd: '19:30' }, nlTijdstip(VRIJDAG, 19, 45), MELDING_STANDAARD)).toBeNull()
  })
  it('de mails zeggen wat het scherm zegt, met link en zonder gedachtestreepjes', () => {
    const r = weekreview(bron(), NU)
    const m = weekreviewMail(r, 'https://dealtrace.test/weekreview')
    expect(m.onderwerp).toBe('Je weekreview van week 42 staat klaar')
    expect(m.tekst).toContain('Een goede week, Anouk.')
    expect(m.tekst).toContain('Wat bewoog\n3 afspraken, je beste week in twee maanden.')
    expect(m.tekst).toContain('- Gesprekken: 6 (+4 tegen je gemiddelde)')
    expect(m.tekst).toContain('- Bel Testkoeling Noorderveld terug (4 keer verschoven)')
    expect(m.tekst).toContain('Begin je weekreview: https://dealtrace.test/weekreview')
    expect(m.tekst).toContain('Weekreview per mail aanstaat')
    const w = weekstartMail(bouwWeekstart({ gebruiker: { id: 'u', naam: 'Sanne', werkplek: 'binnendienst' }, afspraken: [], belblokken: [], voornemens: [], open: { totaal: 0, achterstallig: 0, dezeWeek: 0, blijvers: 0 }, pogingen: 0, aanleidingen: [] }, nlTijdstip(MAANDAG, 7, 30)), 'https://dealtrace.test/weekstart')
    expect(w.onderwerp).toBe('Je week 42: Nog niets gepland deze week')
    expect(w.tekst).toContain('Geen voornemens uit de weekreview.')
    const plan = planDag({ dag: '2026-10-19', nu: nlTijdstip('2026-10-19', 7), modus: 'binnen', vast: [], belblokken: [], belTaken: 4, bereik: bereikbaarheid([]) })
    const d = dagstartMail({ titel: 'Je dag staat klaar.', plan, schoof: ['Het belblok schoof van 09:00 naar 10:00.'], doelgroep: 'Testinstallateurs' }, 'https://dealtrace.test/dagstart')
    expect(d.onderwerp).toBe('Je dag: 1 belblok')
    expect(d.tekst).toContain('Belmoment voor Testinstallateurs')
    expect(d.tekst).toContain('Wat schoof\n- Het belblok schoof van 09:00 naar 10:00.')
    for (const t of [m.tekst, w.tekst, d.tekst, m.onderwerp, w.onderwerp, d.onderwerp]) expect(t).not.toMatch(/[–—]/)
  })
})
