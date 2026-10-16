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
