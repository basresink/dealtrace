// Opvolgreeksen (F7): de pure reekslogica in shared/opvolgreeks.ts. Plannen per dag op werkdagen, wat aan de beurt
// is (concepten een dag vooruit), stopregels, bel terug, pauze, de stand in woorden, mandaatkeuzes en de controle.
import { describe, expect, it } from 'vitest'
import { STARTSJABLONEN, aanDeBeurt, belTerugNa, mandaatKeuzes, momentVoorDag, planReeks, reeksStand, schuifOp, staptStop, stopReden, valideerSjabloon } from '../../shared/opvolgreeks'

// Maandag 12 oktober 2026, 10:00 in Nederland.
const START = new Date('2026-10-12T08:00:00Z')

describe('opvolgreeks', () => {
  it('startset: drie sjablonen met oplopende dagen en een einde erna', () => {
    expect(STARTSJABLONEN.map((s) => s.naam)).toEqual(['Na informatie', 'Na voicemail', 'Na eerste gesprek'])
    for (const s of STARTSJABLONEN) expect(valideerSjabloon(s)).toEqual([])
  })

  it('planReeks: dag 0 is nu, daarna 09:00 op een werkdag, en het einde als laatste stap', () => {
    const p = planReeks(STARTSJABLONEN[0]!, START)
    expect(p.map((x) => [x.dag, x.kanaal])).toEqual([[0, 'mail'], [3, 'linkedin'], [6, 'bellen'], [10, 'mail'], [21, 'einde']])
    expect(p[0]!.geplandOp).toBe(START.toISOString())
    expect(p[1]!.geplandOp).toBe('2026-10-15T07:00:00.000Z') // donderdag 09:00
    expect(p[2]!.geplandOp).toBe('2026-10-19T07:00:00.000Z') // zaterdag 18 schuift naar maandag 19
    expect(p.at(-1)!.titel).toBe('Geen reactie: terug naar het ritme, volgende poging na 30 dagen')
  })

  it('momentVoorDag: buiten werktijd start dag 0 op het volgende werkmoment', () => {
    expect(momentVoorDag(new Date('2026-10-12T18:30:00Z'), 0).toISOString()).toBe('2026-10-13T07:00:00.000Z')
    expect(momentVoorDag(new Date('2026-10-17T10:00:00Z'), 0).toISOString()).toBe('2026-10-19T07:00:00.000Z')
  })

  it('aanDeBeurt: een werkdag vooruit, dag 0 meteen, het einde pas op het moment zelf', () => {
    const s = { status: 'gepland' as const, kanaal: 'mail' as const, dag: 3, geplandOp: '2026-10-15T07:00:00.000Z' }
    expect(aanDeBeurt(s, new Date('2026-10-13T10:00:00Z'))).toBe(false)
    expect(aanDeBeurt(s, new Date('2026-10-14T06:00:00Z'))).toBe(true)
    // Vrijdag: de stap van maandag komt al klaar.
    expect(aanDeBeurt({ ...s, geplandOp: '2026-10-19T07:00:00.000Z' }, new Date('2026-10-16T15:00:00Z'))).toBe(true)
    expect(aanDeBeurt({ ...s, dag: 0, geplandOp: '2026-10-19T07:00:00.000Z' }, new Date('2026-10-12T10:00:00Z'))).toBe(true)
    expect(aanDeBeurt({ ...s, kanaal: 'einde' }, new Date('2026-10-14T07:00:00Z'))).toBe(false)
    expect(aanDeBeurt({ ...s, status: 'open' }, new Date('2026-10-20T07:00:00Z'))).toBe(false)
  })

  it('stopReden: afspraak, nee, afmelding en reactie, alleen na de start', () => {
    const leeg = { afspraken: [], nbStatus: 'in reis', afgemeld: false, momenten: [] }
    const g = START.toISOString()
    expect(stopReden(g, leeg)).toBeNull()
    expect(stopReden(g, { ...leeg, afspraken: [{ createdAt: '2026-10-13T09:00:00Z', status: 'gepland' }] })).toBe('afspraak')
    expect(stopReden(g, { ...leeg, afspraken: [{ createdAt: '2026-10-01T09:00:00Z', status: 'gepland' }] })).toBeNull()
    expect(stopReden(g, { ...leeg, afspraken: [{ createdAt: '2026-10-13T09:00:00Z', status: 'geannuleerd' }] })).toBeNull()
    expect(stopReden(g, { ...leeg, nbStatus: 'nee' })).toBe('nee')
    expect(stopReden(g, { ...leeg, afgemeld: true })).toBe('afmelding')
    expect(stopReden(g, { ...leeg, momenten: [{ op: '2026-10-13T09:00:00Z', soort: 'reactie', uitkomst: 'reactie' }] })).toBe('reactie')
    expect(stopReden(g, { ...leeg, momenten: [{ op: '2026-10-13T09:00:00Z', soort: 'gebeld', uitkomst: 'later' }] })).toBe('reactie')
    expect(stopReden(g, { ...leeg, momenten: [{ op: '2026-10-13T09:00:00Z', soort: 'gebeld', uitkomst: 'geen_interesse' }] })).toBe('nee')
    // Eigen stappen zonder reactie stoppen niets.
    expect(stopReden(g, { ...leeg, momenten: [{ op: '2026-10-13T09:00:00Z', soort: 'gebeld', uitkomst: 'voicemail' }, { op: '2026-10-13T10:00:00Z', soort: 'mail', uitkomst: 'verzonden' }, { op: '2026-10-13T11:00:00Z', soort: 'bericht', uitkomst: 'verstuurd' }] })).toBeNull()
  })

  it('bel terug na een reactie, een afspraak of een afmelding; niet na een nee of handmatig', () => {
    expect(['reactie', 'afspraak', 'afmelding', 'nee', 'handmatig'].map((r) => belTerugNa(r as any))).toEqual([true, true, true, false, false])
  })

  it('stoppen en pauzeren', () => {
    const st = [{ status: 'gedaan' as const, geplandOp: '2026-10-12T08:00:00Z' }, { status: 'open' as const, geplandOp: '2026-10-15T07:00:00Z' }, { status: 'gepland' as const, geplandOp: '2026-10-19T07:00:00Z' }]
    expect(staptStop(st).map((s) => s.status)).toEqual(['gedaan', 'overgeslagen', 'overgeslagen'])
    const na = schuifOp(st, 2 * 864e5, new Date('2026-10-14T08:00:00Z'))
    expect(na[2]!.geplandOp).toBe('2026-10-21T07:00:00.000Z')
    expect(na[1]!.geplandOp).toBe(st[1]!.geplandOp)
  })

  it('reeksStand in woorden', () => {
    const stappen = [{ status: 'gedaan' as const, kanaal: 'mail' as const }, { status: 'open' as const, kanaal: 'linkedin' as const }, { status: 'gepland' as const, kanaal: 'bellen' as const }, { status: 'gepland' as const, kanaal: 'einde' as const }]
    expect(reeksStand({ status: 'loopt', gestartOp: START.toISOString() }, stappen, new Date('2026-10-16T08:00:00Z'))).toEqual({ dag: 4, stap: 2, van: 3, wacht: 1, label: 'Loopt · dag 4' })
    expect(reeksStand({ status: 'gestopt', gestartOp: START.toISOString(), stopreden: 'afspraak' }, stappen, START).label).toBe('Gestopt: er staat een afspraak')
  })

  it('mandaatkeuzes: B alleen als de Verzender A of B mag', () => {
    expect(mandaatKeuzes('B')).toEqual(['C', 'B'])
    expect(mandaatKeuzes('C')).toEqual(['C'])
  })

  it('valideerSjabloon', () => {
    expect(valideerSjabloon({ naam: '', stappen: [], einde: { dag: 0, wachtDagen: 0 } })).toEqual(['Naam ontbreekt', 'Een reeks heeft minstens één stap', 'Het einde ligt na de laatste stap', 'Kies na hoeveel dagen het ritme verder gaat'])
  })
})

// F7 compleet: het overzicht, stopregels per sjabloon, uitkomsten, de strip en het herkennen van een antwoord.
describe('opvolgreeks: overzicht, stopregels en mailbox', async () => {
  const o = await import('../../shared/opvolgreeks')
  const NU = new Date('2026-10-15T10:00:00Z') // donderdag

  it('overzichtStand: concept, open, loopt, raak en gestopt', () => {
    const loopt = { status: 'loopt' as const }
    expect(o.overzichtStand(loopt, [{ status: 'open', kanaal: 'mail', conceptStatus: 'klaar' }, { status: 'gepland', kanaal: 'bellen' }])).toBe('concept')
    expect(o.overzichtStand(loopt, [{ status: 'open', kanaal: 'mail', conceptStatus: 'goedgekeurd' }])).toBe('open')
    expect(o.overzichtStand(loopt, [{ status: 'open', kanaal: 'bellen' }])).toBe('open')
    expect(o.overzichtStand(loopt, [{ status: 'gedaan', kanaal: 'mail' }, { status: 'gepland', kanaal: 'bellen' }])).toBe('loopt')
    expect(o.overzichtStand({ status: 'gepauzeerd' }, [{ status: 'gepland', kanaal: 'mail' }])).toBe('loopt')
    expect(o.overzichtStand({ status: 'gestopt', stopreden: 'reactie' }, [])).toBe('raak')
    expect(o.overzichtStand({ status: 'gestopt', stopreden: 'afspraak' }, [])).toBe('raak')
    expect(o.overzichtStand({ status: 'gestopt', stopreden: 'nee' }, [])).toBe('gestopt')
    expect(o.overzichtStand({ status: 'klaar' }, [])).toBe('gestopt')
  })

  it('sorteerOverzicht: wat op jou wacht bovenaan, gestopte nieuwste eerst', () => {
    const r = (id: string, stand: any, extra: any = {}) => ({ id, stand, gestartOp: '2026-10-01T08:00:00Z', ...extra })
    const lijst = o.sorteerOverzicht([r('a', 'gestopt', { gestoptOp: '2026-10-02T08:00:00Z' }), r('b', 'loopt', { volgendeOp: '2026-10-20T07:00:00Z' }), r('c', 'concept'), r('d', 'gestopt', { gestoptOp: '2026-10-09T08:00:00Z' }), r('e', 'open'), r('f', 'loopt', { volgendeOp: '2026-10-16T07:00:00Z' }), r('g', 'raak')])
    expect(lijst.map((x) => x.id)).toEqual(['c', 'e', 'f', 'b', 'g', 'd', 'a'])
  })

  it('overzichtKop en weekRegel in woorden', () => {
    expect(o.overzichtKop(11, 2)).toBe('11 reeksen lopen, 2 wachten op jou.')
    expect(o.overzichtKop(1, 1)).toBe('1 reeks loopt, 1 wacht op jou.')
    expect(o.overzichtKop(0, 0)).toBe('Geen reeks loopt, niets wacht op jou.')
    expect(o.maandagVan(NU)).toBe('2026-10-12')
    const stops = [{ stopreden: 'reactie' as const, gestoptOp: '2026-10-13T09:00:00Z' }, { stopreden: 'reactie' as const, gestoptOp: '2026-10-14T09:00:00Z' }, { stopreden: 'afspraak' as const, gestoptOp: '2026-10-15T08:00:00Z' }, { stopreden: 'reactie' as const, gestoptOp: '2026-10-09T09:00:00Z' }]
    expect(o.weekRegel(stops, NU)).toBe('Deze week: 2 reacties, 1 afspraak uit een reeks.')
    expect(o.weekRegel([], NU)).toBe('Deze week nog geen reactie of afspraak uit een reeks.')
  })

  it('stopregels per sjabloon: uitgezette regels stoppen niet, een afmelding altijd', () => {
    const start = '2026-10-12T08:00:00Z'
    const s = { afspraken: [{ createdAt: '2026-10-13T08:00:00Z', status: 'gepland' }], nbStatus: 'in reis', afgemeld: false, momenten: [] }
    expect(o.stopReden(start, s)).toBe('afspraak')
    expect(o.stopReden(start, s, { afspraak: false })).toBeNull()
    expect(o.stopReden(start, { ...s, afspraken: [], afgemeld: true }, { reactie: false, afspraak: false, nee: false })).toBe('afmelding')
    const mail = { ...s, afspraken: [], momenten: [{ op: '2026-10-13T09:00:00Z', soort: 'reactie', uitkomst: 'reactie' }] }
    expect(o.stopReden(start, mail)).toBe('reactie')
    expect(o.stopReden(start, mail, { reactie: false })).toBeNull()
  })

  it('uitkomsten: het sjabloon bij voicemail, later en informatie', () => {
    const sj = o.STARTSJABLONEN.map((x, i) => ({ id: `s${i}`, uitkomsten: x.uitkomsten }))
    expect(o.sjabloonVoorUitkomst(sj, o.reeksUitkomstVan('voicemail'))?.id).toBe('s1')
    expect(o.sjabloonVoorUitkomst(sj, o.reeksUitkomstVan('later'))?.id).toBe('s2')
    expect(o.sjabloonVoorUitkomst(sj, 'informatie')?.id).toBe('s0')
    expect(o.reeksUitkomstVan('geen_reactie')).toBeNull()
    expect(o.sjabloonVoorUitkomst(sj, null)).toBeNull()
  })

  it('valideerSjabloon: onbekende uitkomst, te veel stappen en te lange teksten', () => {
    const basis = { naam: 'Eigen', stappen: [{ dag: 0, kanaal: 'mail' as const, titel: 'Mail' }], einde: { dag: 5, wachtDagen: 30 } }
    expect(o.valideerSjabloon(basis)).toEqual([])
    expect(o.valideerSjabloon({ ...basis, uitkomsten: ['onzin' as any] })).toContain('Onbekende uitkomst onzin')
    expect(o.valideerSjabloon({ ...basis, stappen: [{ dag: 0, kanaal: 'mail', titel: 'Mail', instructie: 'x'.repeat(601) }] })).toContain('De instructie van stap 1 is langer dan 600 tekens')
    expect(o.valideerSjabloon({ ...basis, stappen: Array.from({ length: 13 }, (_, i) => ({ dag: i, kanaal: 'mail' as const, titel: 'Mail' })), einde: { dag: 20, wachtDagen: 30 } })).toContain('Een reeks heeft hooguit 12 stappen')
  })

  it('planReeks neemt het onderwerp van een stap mee', () => {
    const p = o.planReeks({ stappen: [{ dag: 0, kanaal: 'mail', titel: 'Mail', onderwerp: 'Het overzicht' }], einde: { dag: 4, wachtDagen: 30 } }, START)
    expect(p[0]!.onderwerp).toBe('Het overzicht')
  })

  it('reeksStrip: stap x van y en de volgende stap', () => {
    expect(o.reeksStrip({ naam: 'Na informatie', status: 'loopt', stap: 2, van: 4, volgende: { kanaal: 'bellen', titel: 'Bellen', geplandOp: '2026-10-20T07:00:00Z' } })).toBe('Na informatie · stap 2 van 4 · volgende: Bellen di 20 okt')
    expect(o.reeksStrip({ naam: 'Na voicemail', status: 'gepauzeerd', stap: 1, van: 4, volgende: null })).toBe('Na voicemail · stap 1 van 4 · gepauzeerd')
  })

  it('mailAdres en isAutoAntwoord', () => {
    expect(o.mailAdres('Mira Proefhuis <Mira@Rietpunt.test>')).toBe('mira@rietpunt.test')
    expect(o.mailAdres('mira@rietpunt.test')).toBe('mira@rietpunt.test')
    expect(o.mailAdres('geen adres')).toBeNull()
    expect(o.isAutoAntwoord({ onderwerp: 'Re: kostenoverzicht', van: 'mira@rietpunt.test' })).toBe(false)
    expect(o.isAutoAntwoord({ onderwerp: 'Automatisch antwoord: afwezig tot maandag' })).toBe(true)
    expect(o.isAutoAntwoord({ onderwerp: 'Out of office' })).toBe(true)
    expect(o.isAutoAntwoord({ onderwerp: 'Re: vraag', headers: { 'Auto-Submitted': 'auto-replied' } })).toBe(true)
    expect(o.isAutoAntwoord({ onderwerp: 'Hallo', van: 'MAILER-DAEMON@rietpunt.test' })).toBe(true)
  })
})
