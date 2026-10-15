import { describe, expect, it } from 'vitest'
import {
  adviesMomenten, blokFouten, blokResultaat, blokduur, bouwBellijst, bellijstKop, gesprekstijdIn, marge, planVuller, rangorde, schatDuur,
  standaardBlokken, soortLabel, blokMoment, uitkomstNaarCode, UITKOMST_KNOPPEN, HOE_GING_HET, urgentie, valideerBlokken, verdeelOverBlok, volgendVastBlok, vulBlok,
  type BelKandidaat, type VastBlok,
} from '../../shared/belblokken'
import {
  STARTSET_SCRIPTS, TE_WEINIG, bezwarenMetConcurrent, conversieLabel, kiesScript, scriptVergelijking, scriptWaarden, valideerScript, variabelenVan, vulScript, zichtbareScripts,
  type Belscript,
} from '../../shared/belscripts'
import { verkoopverhaalUitSeed } from '../../shared/verkoopverhaal'
import voltvast from '../../seed/voltvast.json'

const NU = new Date('2026-10-14T08:00:00Z') // woensdag 10:00 in Nederland
const dagen = (n: number) => new Date(NU.getTime() + n * 864e5).toISOString()
function k(id: string, p: Partial<BelKandidaat> = {}): BelKandidaat {
  return { accountId: id, accountNaam: `Testprospect ${id}`, score: 50, herkomst: 'koud', reden: 'Nieuw in de reis', ...p }
}
const metDuur = <T extends BelKandidaat>(l: T[]) => l.map((x) => ({ ...x, duur: schatDuur(x) }))

describe('rangorde en bellijst (gat 35)', () => {
  it('urgentie: achterstallig 100, vandaag 80, later 50, zonder datum 40', () => {
    expect([urgentie(dagen(-1), NU), urgentie(dagen(0), NU), urgentie(dagen(2), NU), urgentie(null, NU)]).toEqual([100, 80, 50, 40])
  })
  it('open beltaken altijd boven aanvulling; achterstallig boven vandaag', () => {
    const taak = k('a', { taskId: 't1', due: dagen(0), prioriteit: 'laag', score: 0 })
    const aanvulling = k('b', { score: 100, aanleidingen: 10, openTaken: 10, heet: true })
    expect(rangorde(taak, NU)).toBe(1000 + 800 + 20)
    expect(rangorde(aanvulling, NU)).toBe(100 + 20 + 15 + 15)
    expect(rangorde(k('c', { taskId: 't2', due: dagen(-1), score: 0 }), NU)).toBeGreaterThan(rangorde(taak, NU))
    expect(rangorde(k('d', { waarschuwing: true }), NU)).toBe(55)
  })
  it('bel-me-niet nooit; per account één regel; prospects zonder historie doen mee; Top 5', () => {
    const lijst = bouwBellijst([k('a', { belMeNiet: true, taskId: 't', due: dagen(-3) }), k('b', { taskId: 't1', due: dagen(0) }), k('b', { taskId: 't2', due: dagen(-1) }), k('c'), k('d'), k('e'), k('f'), k('g')], NU, { top: 5 })
    expect(lijst.map((x) => x.accountId)).not.toContain('a')
    expect(lijst.filter((x) => x.accountId === 'b')).toHaveLength(1)
    expect(lijst[0]).toMatchObject({ accountId: 'b', taskId: 't2' })
    expect(lijst).toHaveLength(5)
  })
  it('de kop zegt eerlijk wat de lijst is', () => {
    expect(bellijstKop(false)).toBe('Bellijst')
    expect(bellijstKop(true)).toBe('Bellijst van vandaag')
  })
})

describe('duur, marge en blok (gat 16)', () => {
  it('schatDuur: 8, 12 bij urgent, plus 2 bij score 70, plus 2 bij meer dan één taak; na 20 gesprekken het eigen gemiddelde', () => {
    expect(schatDuur({ score: 50 })).toBe(8)
    expect(schatDuur({ score: 70, prioriteit: 'urgent', openTaken: 2 })).toBe(16)
    expect(schatDuur({ score: 50 }, { gesprekken: 19, gemiddeldeMinuten: 5 })).toBe(8)
    expect(schatDuur({ score: 50 }, { gesprekken: 20, gemiddeldeMinuten: 5.4 })).toBe(5)
  })
  it('marge en blokduur: afronden op 5 en op 30, minimaal 30', () => {
    expect([marge(0), marge(8), marge(40), marge(41)]).toEqual([0, 5, 10, 15])
    expect([blokduur(8), blokduur(40), blokduur(80)]).toEqual([30, 60, 120])
    expect(gesprekstijdIn(60)).toBe(45)
    expect(45 + marge(45)).toBeLessThanOrEqual(60)
  })
  it('verdeelOverBlok: wat niet past schuift naar het volgende vaste blok, anders blijft het in de lijst', () => {
    const l = metDuur([k('a'), k('b'), k('c'), k('d'), k('e'), k('f'), k('g')])
    const met = verdeelOverBlok(l, 60, { label: 'maandag 19 okt 09:00', start: '' })
    expect(met.inBlok).toHaveLength(5)
    expect(met.geschoven).toHaveLength(2)
    expect(met.melding).toBe('5 in dit blok, 2 naar maandag 19 okt 09:00')
    const zonder = verdeelOverBlok(l, 60, null)
    expect(zonder.inLijst).toHaveLength(2)
    expect(zonder.melding).toBe('5 in dit blok, 2 blijven in je bellijst')
  })
})

describe('vulBlok: de soort stuurt (gat 36)', () => {
  const koud = metDuur(Array.from({ length: 10 }, (_, i) => k(`k${i}`, { herkomst: 'koud' })))
  const opv = metDuur(Array.from({ length: 10 }, (_, i) => k(`o${i}`, { herkomst: 'opvolging', taskId: `t${i}`, due: dagen(-1) })))
  it('een koud blok alleen koud, ook als opvolging hoger scoort', () => {
    const r = vulBlok('koud', [...opv, ...koud], 80)
    expect(r.every((x) => x.herkomst === 'koud')).toBe(true)
    expect(r).toHaveLength(10)
  })
  it('opvolging alleen opvolging', () => {
    expect(vulBlok('opvolging', [...koud, ...opv], 40).every((x) => x.herkomst === 'opvolging')).toBe(true)
  })
  it('gemengd 70/30 precies bij 10 gesprekken; opvolging verdringt koud niet', () => {
    const r = vulBlok('gemengd', [...opv, ...koud], 80)
    expect(r).toHaveLength(10)
    expect(r.filter((x) => x.herkomst === 'koud')).toHaveLength(7)
  })
  it('ruimte onder 8 minuten wordt overgeslagen', () => {
    expect(vulBlok('koud', koud, 7)).toHaveLength(0)
    expect(vulBlok('koud', koud, 15)).toHaveLength(1)
  })
})

describe('de vuller: regressiegevallen', () => {
  const blokken: VastBlok[] = [
    { id: 'ochtend', dagen: [1, 2, 3, 4], start: '09:00', minuten: 90, plek: 'Kantoor', soort: 'koud', automatisch: true },
    { id: 'middag', dagen: [1, 2, 3, 4], start: '14:00', minuten: 60, plek: 'Kantoor', soort: 'opvolging', automatisch: true },
    { id: 'zelf', dagen: [3], start: '16:00', minuten: 60, plek: 'Thuis', soort: 'koud', automatisch: false },
  ]
  const kand = metDuur([...Array.from({ length: 12 }, (_, i) => k(`k${i}`)), ...Array.from({ length: 6 }, (_, i) => k(`o${i}`, { herkomst: 'opvolging', taskId: `t${i}`, due: dagen(0) }))])
  it('1. vult beide automatische blokken van vandaag', () => {
    expect(planVuller(blokken, kand, [], NU).map((o) => o.blokId)).toEqual(['ochtend', 'middag'])
  })
  it('2. een blok dat niet automatisch is, wordt niet gevuld', () => {
    expect(planVuller(blokken, kand, [], NU).some((o) => o.blokId === 'zelf')).toBe(false)
  })
  it('3. een blok dat voorbij is, slaat hij over', () => {
    expect(planVuller(blokken, kand, [], new Date('2026-10-14T09:00:00Z')).map((o) => o.blokId)).toEqual(['middag'])
  })
  it('4. weekend: niets', () => {
    expect(planVuller(blokken, kand, [], new Date('2026-10-17T08:00:00Z'))).toEqual([])
  })
  it('5. feestdag: niets', () => {
    expect(planVuller(blokken, kand, [], new Date('2026-12-25T08:00:00Z'))).toEqual([])
  })
  it('6. geen kandidaten: geen leeg blok', () => {
    expect(planVuller(blokken, [], [], NU)).toEqual([])
  })
  it('7. handmatig ingeplande taken blijven en tellen mee voor de ruimte', () => {
    const r = planVuller(blokken, kand, [{ blokId: 'ochtend', accountId: 'k0', duur: 60 }], NU)
    const o = r.find((x) => x.blokId === 'ochtend')!
    expect(o.alGepland).toBe(1)
    expect(o.ruimte).toBe(gesprekstijdIn(90) - 60)
    expect(o.toevoegen.map((x) => x.accountId)).not.toContain('k0')
  })
  it('8. vol blok (ruimte onder 8 minuten): niets erbij', () => {
    expect(planVuller(blokken, kand, [{ blokId: 'middag', accountId: 'x', duur: 40 }], NU).some((o) => o.blokId === 'middag')).toBe(false)
  })
  it('9. een tweede run vult niet opnieuw wat er al in staat', () => {
    const eerste = planVuller(blokken, kand, [], NU)
    const bestaand = eerste.flatMap((o) => o.toevoegen.map((x) => ({ blokId: o.blokId, accountId: x.accountId, duur: x.duur })))
    expect(planVuller(blokken, kand, bestaand, NU)).toEqual([])
  })
  it('10. de soort stuurt: ochtend koud, middag opvolging', () => {
    const r = planVuller(blokken, kand, [], NU)
    expect(r[0]!.toevoegen.every((x) => x.herkomst === 'koud')).toBe(true)
    expect(r[1]!.toevoegen.every((x) => x.herkomst === 'opvolging')).toBe(true)
  })
  it('11. een account komt nooit in twee blokken; bel-me-niet nooit', () => {
    const r = planVuller(blokken, [...kand, { ...k('verboden', { belMeNiet: true, score: 99 }), duur: 8 }], [], NU)
    const ids = r.flatMap((o) => o.toevoegen.map((x) => x.accountId))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('verboden')
  })
  it('12. gemengd houdt de verhouding', () => {
    const r = planVuller([{ id: 'g', dagen: [3], start: '11:00', minuten: 120, plek: 'Kantoor', soort: 'gemengd', verhouding: 50, automatisch: true }], kand, [], NU)
    const n = r[0]!.toevoegen
    const koud = n.filter((x) => x.herkomst === 'koud').length
    expect(koud - (n.length - koud)).toBeGreaterThanOrEqual(0)
    expect(koud - (n.length - koud)).toBeLessThanOrEqual(1)
  })
})

describe('vaste blokken en advies', () => {
  it('standaardblokken: binnendienst ma tot en met do 09:00 tot 10:30 koud en 14:00 opvolging; buitendienst vrijdag gemengd', () => {
    const b = standaardBlokken('binnendienst')
    expect(b.map(blokMoment)).toEqual(['Maandag tot en met donderdag 09:00 tot 10:30', 'Maandag tot en met donderdag 14:00 tot 15:00'])
    expect(b.map(soortLabel)).toEqual(['Koude acquisitie', 'Opvolging en ritme'])
    expect(soortLabel(standaardBlokken('buitendienst')[0]!)).toBe('Gemengd 70/30')
    expect(valideerBlokken(b)).toEqual([])
  })
  it('validatie: geen dag, rare tijd, te lang, meer dan 20', () => {
    expect(blokFouten({ id: 'x', dagen: [], start: '9:00', minuten: 10, soort: 'koud', automatisch: true })).toEqual(['Kies minstens één werkdag', 'Begintijd als UU:MM', 'Duur tussen 30 en 240 minuten'])
    expect(valideerBlokken(Array.from({ length: 21 }, () => standaardBlokken('binnendienst')[0]))).toEqual(['Maximaal 20 blokken'])
  })
  it('adviesMomenten: hooguit vijf, nooit in de lunch, het weekend of over een afspraak', () => {
    const bezet = [{ start: '2026-10-14T09:00:00Z', eind: '2026-10-14T10:00:00Z' }]
    const m = adviesMomenten(bezet, [], NU, { duur: 60 })
    expect(m.length).toBeLessThanOrEqual(5)
    for (const x of m) {
      const s = new Date(x.start)
      expect([0, 6]).not.toContain(s.getUTCDay())
      expect(Date.parse(x.start) >= Date.parse('2026-10-14T10:00:00Z') || Date.parse(x.eind) <= Date.parse('2026-10-14T09:00:00Z')).toBe(true)
      const uur = Number(new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', timeZone: 'Europe/Amsterdam' }).format(s))
      expect(uur === 12).toBe(false)
    }
    const vast = adviesMomenten([], standaardBlokken('binnendienst'), NU, { duur: 60 })
    expect(vast.some((x) => x.bron === 'vast' && x.label.endsWith('(vast blok)'))).toBe(true)
  })
  it('volgendVastBlok: het eerstvolgende blok na nu', () => {
    const v = volgendVastBlok(standaardBlokken('binnendienst'), NU)
    expect(v?.blok.id).toBe('vb-middag')
  })
})

describe('uitkomsten (7.3)', () => {
  it('de negen knoppen en de vier tegels', () => {
    expect(UITKOMST_KNOPPEN).toHaveLength(9)
    expect(HOE_GING_HET).toHaveLength(4)
    expect(uitkomstNaarCode('geen_gehoor')?.code).toBe('geen_reactie')
    expect(uitkomstNaarCode('poortwachter')).toMatchObject({ code: 'later', vraagtDatum: true, bereikt: false })
    expect(uitkomstNaarCode('verkeerd_nummer')).toMatchObject({ code: 'nieuw_contact', extraTaak: { title: 'Nummer controleren' } })
    expect(uitkomstNaarCode('geen_interesse')).toMatchObject({ code: 'geen_interesse', vraagtReden: true })
    expect(uitkomstNaarCode('terugbellen')?.code).toBe('later')
    expect(uitkomstNaarCode('gesproken')).toBeNull()
  })
  it('blokresultaat telt bereik, beslisser, afspraken en terugbellen', () => {
    const r = blokResultaat([
      { accountId: 'a', knop: 'afspraak', duurSec: 600, contactRol: 'beslisser' }, { accountId: 'b', knop: 'geen_gehoor', duurSec: 60 },
      { accountId: 'c', knop: 'later', duurSec: 300 }, { accountId: 'd', knop: 'voicemail', duurSec: 60 }, { accountId: 'e', knop: 'poortwachter', duurSec: 120 },
    ])
    expect(r).toMatchObject({ gevoerd: 5, bereikt: 2, beslisserBereikt: 1, afspraken: 1, terugbellen: 2, gemiddeldeDuurSec: 228 })
  })
})

const vv = verkoopverhaalUitSeed((voltvast as any).verkoopverhaal)
const scripts: Belscript[] = STARTSET_SCRIPTS.map((s, i) => ({ ...s, id: `s${i}`, versie: 1, status: 'actief' }))

describe('belscripts (F08)', () => {
  it('de startset: zes scripts, allemaal te activeren en zonder onbekende variabelen', () => {
    expect(scripts).toHaveLength(6)
    for (const s of scripts) expect(valideerScript(s, { activeren: true }).fouten, s.naam).toEqual([])
  })
  it('een onbekende variabele blokkeert opslaan met de naam', () => {
    const s = { ...scripts[0]!, data: { ...scripts[0]!.data, blokken: [...scripts[0]!.data.blokken, { id: 'x', soort: 'vrij' as const, tekst: 'Hallo {klant.schoenmaat}', invulwijze: 'vast' as const }] } }
    expect(valideerScript(s).fouten).toEqual(['Onbekende variabele {klant.schoenmaat}'])
    expect(variabelenVan(s.data)).toContain('klant.schoenmaat')
  })
  it('activeren vraagt opening, afsluiting en voicemail; lengte boven 200 woorden waarschuwt', () => {
    const s = { ...scripts[0]!, data: { ...scripts[0]!.data, blokken: scripts[0]!.data.blokken.filter((b) => b.soort !== 'voicemail') } }
    expect(valideerScript(s, { activeren: true }).fouten).toEqual(['Een actief script heeft een voicemail'])
    const lang = { ...scripts[0]!, data: { ...scripts[0]!.data, blokken: [...scripts[0]!.data.blokken, { id: 'l', soort: 'vrij' as const, tekst: 'woord '.repeat(210), invulwijze: 'vast' as const }] } }
    expect(valideerScript(lang).waarschuwingen[0]).toMatch(/richtlijn 150/)
  })
  it('een verdwenen concurrent zet het script op Controleren', () => {
    const s = { ...scripts[0]!, data: { ...scripts[0]!.data, bezwaren: [{ id: 'b', bezwaar: 'x', antwoord: 'y', argumentRef: 'cc-99' }] } }
    expect(valideerScript(s, { concurrentIds: vv.concurrenten.map((c) => c.id) }).controleren).toBe(true)
  })
  it('kiesScript: campagne, belblok, beste match, eigen variant, startscript', () => {
    const g = { id: 'u1', niveau: 'gevorderd', teamId: 't1' }
    expect(kiesScript({ campagneScriptId: 's3', belblokScriptId: 's2' }, scripts, g)).toEqual({ scriptId: 's3', reden: 'Script van de campagne' })
    expect(kiesScript({ belblokScriptId: 's2' }, scripts, g)?.scriptId).toBe('s2')
    expect(kiesScript({ doel: 'winback' }, scripts, g)?.scriptId).toBe('s4')
    expect(kiesScript({ doel: 'koud', contactRol: 'receptie' }, scripts, g)?.scriptId).toBe('s1')
    const variant: Belscript = { ...scripts[4]!, id: 'v1', isPersoonlijk: true, gebruikerId: 'u1', basisScriptId: 's4' }
    expect(kiesScript({ doel: 'winback' }, [...scripts, variant], g)).toEqual({ scriptId: 'v1', reden: 'Past bij doel, fase, doelgroep en rol, jouw variant' })
    expect(kiesScript({}, scripts, g)?.reden).toBe('Startscript van de organisatie')
  })
  it('een Beginner ziet alleen actieve scripts van zijn team, geen varianten', () => {
    const team: Belscript = { ...scripts[0]!, id: 'team2', data: { ...scripts[0]!.data, teamIds: ['t2'] } }
    const concept: Belscript = { ...scripts[0]!, id: 'concept', status: 'concept' }
    const variant: Belscript = { ...scripts[0]!, id: 'v', isPersoonlijk: true, gebruikerId: 'u1', basisScriptId: 's0' }
    const z = zichtbareScripts([...scripts, team, concept, variant], { id: 'u1', niveau: 'beginner', teamId: 't1' }).map((s) => s.id)
    expect(z).not.toContain('team2')
    expect(z).not.toContain('concept')
    expect(z).not.toContain('v')
  })
  it('vulScript: onbekende variabele krijgt de terugvalzin en een markering; AI-tekst gaat voor', () => {
    const r = vulScript(scripts[0]!, { waarden: { 'contact.voornaam': 'Pim', 'gebruiker.voornaam': 'Lieke', 'organisatie.naam': 'Voltvast' }, ai: { aanleiding: { tekst: 'Ik zag dat jullie twee monteurs zoeken.', bronnen: [{ soort: 'vacature', url: 'https://werk.test/1' }] } } })
    const opening = r.blokken.find((b) => b.id === 'opening')!
    expect(opening.onbekend).toEqual(['verhaal.kernzin'])
    expect(opening.segmenten.at(-1)).toMatchObject({ onbekend: 'verhaal.kernzin' })
    expect(r.blokken.find((b) => b.id === 'aanleiding')).toMatchObject({ vanAi: true, bronnen: [{ soort: 'vacature' }] })
    expect(r.blokken.map((b) => b.soort)).toEqual(['opening', 'aanleiding', 'toestemming', 'vragen', 'winpunt', 'afsluiting', 'voicemail', 'opvolgmail'])
  })
  it('C.9 geval 2: br-01 met huidige leverancier cc-02 geeft kernzin, belofte van br-01, wp-01 en het bezwaar met antwoord', () => {
    const w = scriptWaarden({ gebruiker: { naam: 'Testgebruiker Lieke Noord' }, organisatie: { naam: 'Testbedrijf Voltvast' }, account: { naam: 'Testinstallatie Koperwiek', brancheId: 'br-01', huidigeLeverancierId: 'cc-02' }, verhaal: vv })
    expect(w.waarden['verhaal.kernzin']).toBe('Bij woningbouwprojecten staan monteurs vaak te wachten op materiaal.')
    expect(w.waarden['belofte.branche']).toBe('Binnen 48 uur een gratis projectschouw, daarna levering per bouwfase.')
    expect(w.winpuntId).toBe('wp-01')
    expect(w.meldingen).toEqual([])
    const bz = bezwarenMetConcurrent(scripts[0]!, vv, w.concurrentId)
    expect(bz[0]).toMatchObject({ bezwaar: 'Online is het goedkoper.', antwoord: 'Per stuk soms wel. Zullen we uw laatste project naast elkaar leggen?', argumentRef: 'cc-02' })
    expect(w.waarden['gebruiker.voornaam']).toBe('Lieke')
  })
  it('C.9 geval 1: br-03 valt terug op het algemene verhaal met melding', () => {
    const w = scriptWaarden({ gebruiker: { naam: 'Lieke' }, organisatie: { naam: 'Voltvast' }, account: { naam: 'x', brancheId: 'br-03' }, verhaal: vv })
    expect(w.waarden['verhaal.kernzin']).toBe('Voltvast is een technische groothandel voor installateurs in Midden- en Noord-Nederland.')
    expect(w.meldingen[0]).toMatch(/algemene verhaal/)
  })
  it('C.9 geval 4: wp-02 onder de norm komt niet als eerste, ook niet in zijn eigen fase', () => {
    const w = scriptWaarden({ gebruiker: { naam: 'Lieke' }, organisatie: { naam: 'Voltvast' }, account: { naam: 'x', brancheId: 'br-01', faseId: 'fa-04' }, verhaal: vv })
    expect(w.winpuntId).not.toBe('wp-02')
  })
  it('scriptVergelijking: onder 30 gesprekken geen vergelijking', () => {
    expect(scriptVergelijking([{ scriptId: 'a', versie: 1, gesprekken: 29, bereikt: 10, afspraken: 5 }, { scriptId: 'b', versie: 1, gesprekken: 40, bereikt: 10, afspraken: 4 }]).melding).toBe(TE_WEINIG)
    const r = scriptVergelijking([{ scriptId: 'a', versie: 1, gesprekken: 30, bereikt: 10, afspraken: 6 }, { scriptId: 'b', versie: 1, gesprekken: 40, bereikt: 10, afspraken: 4 }])
    expect(r.melding).toBeNull()
    expect(r.beste?.scriptId).toBe('a')
    expect(conversieLabel({ gesprekken: 25, afspraken: 7 })).toBe('28% naar afspraak')
  })
})
