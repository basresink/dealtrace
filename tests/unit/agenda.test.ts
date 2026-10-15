// P13: de pure kern van de agenda. Gevolg van een uitkomst, de eerste afspraak (gat 3), "Wie is er
// aan de beurt?" met prospects zonder klasse (gat 33), vormadvies, vrije momenten met bezet uit de
// koppeling (gat 37) en conflicten.
import { describe, expect, it } from 'vitest'
import { aanDeBeurt, conflicten, isEersteAfspraak, meetingUitkomst, MEETINGSOORTEN_START, vormAdvies, vrijeMomentenAgenda, type AfspraakKort } from '../../shared/agenda'

const soort = (slug: string) => MEETINGSOORTEN_START.find((m) => m.slug === slug)!
const nu = new Date('2026-10-20T08:00:00Z')

describe('startset', () => {
  it('zeven meetingsoorten (met Ongepland bezoek), geen offertebespreking, eerste afspraak alleen bij kennismaking, inventarisatie en demo', () => {
    expect(MEETINGSOORTEN_START).toHaveLength(7)
    expect(MEETINGSOORTEN_START.some((m) => /offerte/i.test(m.naam))).toBe(false)
    expect(MEETINGSOORTEN_START.filter((m) => m.data.eersteAfspraak).map((m) => m.slug)).toEqual(['kennismaking', 'inventarisatie', 'demo'])
    expect(soort('weekoverleg').type).toBe('intern')
    for (const m of MEETINGSOORTEN_START) for (const u of m.data.uitkomsten) expect(u.gevolg.type).toBeTruthy()
  })
})

describe('isEersteAfspraak (gat 3)', () => {
  const a = (id: string, start: string, status: AfspraakKort['status'] = 'gepland', type: 'klant' | 'intern' = 'klant'): AfspraakKort => ({ id, accountId: 'acc', status, start, meetingsoortType: type })
  it('de tweede afspraak is niet de eerste', () => {
    const lijst = [a('1', '2026-10-20T08:00:00Z'), a('2', '2026-10-27T08:00:00Z')]
    expect(isEersteAfspraak(lijst, 'acc', '1')).toBe(true)
    expect(isEersteAfspraak(lijst, 'acc', '2')).toBe(false)
  })
  it('een geannuleerde eerste afspraak telt niet; intern overleg ook niet', () => {
    const lijst = [a('0', '2026-10-13T08:00:00Z', 'gepland', 'intern'), a('1', '2026-10-20T08:00:00Z', 'geannuleerd'), a('2', '2026-10-27T08:00:00Z')]
    expect(isEersteAfspraak(lijst, 'acc', '2')).toBe(true)
  })
})

describe('meetingUitkomst', () => {
  const kennis = soort('kennismaking')
  const bel = soort('belafspraak')
  const opties = { nu }
  it('vervolg na de eerste afspraak meldt eerste-afspraak-gehouden en vraagt Overdragen?', () => {
    const m = meetingUitkomst({ accountNaam: 'Testbedrijf', start: nu.toISOString(), eerste: true }, kennis, 'vervolg', { ...opties, vervolgstap: 'offerte' })
    expect(m).toMatchObject({ gebeurtenis: 'eerste-afspraak-gehouden', overdragen: true, klantcontact: true })
    expect(m.taken[0]!.titel).toContain('Overdragen: Testbedrijf (offerte)')
  })
  it('vervolg bij een latere afspraak vraagt niet om overdragen', () => {
    const m = meetingUitkomst({ start: nu.toISOString(), eerste: false }, kennis, 'vervolg', opties)
    expect(m.gebeurtenis).toBeNull(); expect(m.overdragen).toBe(false); expect(m.taken).toHaveLength(1)
  })
  it('later zet wachtend tot de datum met een terugkomtaak', () => {
    const m = meetingUitkomst({ start: nu.toISOString(), eerste: true }, kennis, 'later', { ...opties, laterOp: '2026-12-01' })
    expect(m.wachtendTot).toBe('2026-12-01'); expect(m.taken[0]).toMatchObject({ actiesoort: 'bellen', dueDatum: '2026-12-01' })
  })
  it('andere contactpersoon geeft een nieuwe poging', () => {
    expect(meetingUitkomst({ start: nu.toISOString(), eerste: true }, kennis, 'andere-contactpersoon', opties).taken[0]!.titel).toMatch(/Nieuwe contactpersoon/)
  })
  it('geen vervolg vraagt een reden en geeft nee met reden', () => {
    expect(meetingUitkomst({ start: nu.toISOString(), eerste: true }, kennis, 'geen-vervolg', opties).fout).toBe('Kies een reden')
    const m = meetingUitkomst({ start: nu.toISOString(), eerste: true }, kennis, 'geen-vervolg', { ...opties, reden: 'Geen budget' })
    expect(m).toMatchObject({ gebeurtenis: 'geen-vervolg', nee: { reden: 'Geen budget' } })
  })
  it('belafspraak: afspraak plant een kennismaking, geen interesse is nee', () => {
    expect(meetingUitkomst({ start: nu.toISOString(), eerste: false }, bel, 'afspraak', opties).planAfspraak).toBe('kennismaking')
    expect(meetingUitkomst({ start: nu.toISOString(), eerste: false }, bel, 'geen-interesse', { ...opties, reden: 'Geen behoefte' }).nee?.reden).toBe('Geen behoefte')
  })
  it('onbekende code en intern overleg', () => {
    expect(meetingUitkomst({ start: nu.toISOString(), eerste: true }, kennis, 'deal', opties).fout).toBe('Kies een uitkomst')
    const m = meetingUitkomst({ start: nu.toISOString(), eerste: false }, soort('weekoverleg'), 'iets', opties)
    expect(m.klantcontact).toBe(false); expect(m.fout).toBeUndefined()
  })
  it('geen enkele uitkomst maakt een deal of offerte', () => {
    for (const s of MEETINGSOORTEN_START) for (const u of s.data.uitkomsten) expect(JSON.stringify(u)).not.toMatch(/deal|offerte/i)
  })
})

describe('aanDeBeurt', () => {
  const advies = () => 'Belafspraak'
  it('prospect zonder klasse of historie met verlopen ritme doet mee (gat 33)', () => {
    const r = aanDeBeurt([{ id: 'p1', naam: 'Zonder klasse', klasse: null, ritmeVolgendeOp: '2026-10-19T08:00:00Z' }], [], nu, advies)
    expect(r).toEqual([expect.objectContaining({ accountId: 'p1', soort: 'ritme', reden: 'Ritme loopt af (nog geen klasse)' })])
  })
  it('no-show eerst, dan eerste gesprek, hooguit acht, niet met een geplande afspraak', () => {
    const accounts = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, naam: `P${i}`, ritmeVolgendeOp: '2026-10-10T08:00:00Z', faseId: 'benaderd', laatsteUitkomst: i === 3 ? 'gesproken' : null }))
    const afs: AfspraakKort[] = [{ id: 'x', accountId: 'p5', status: 'niet_verschenen', start: '2026-10-15T08:00:00Z' }, { id: 'y', accountId: 'p6', status: 'gepland', start: '2026-10-22T08:00:00Z' }]
    const r = aanDeBeurt(accounts, afs, nu, advies)
    expect(r).toHaveLength(8)
    expect(r[0]).toMatchObject({ accountId: 'p5', reden: 'No-show opnieuw inplannen' })
    expect(r[1]).toMatchObject({ accountId: 'p3', reden: 'Eerste gesprek nog niet ingepland' })
    expect(r.some((v) => v.accountId === 'p6')).toBe(false)
  })
})

describe('vormAdvies', () => {
  const rd = [{ regioId: 'oost', naam: 'Regio Oost', weekdag: 2, plaatsen: ['Assen'] }]
  it('binnendienst belt, buitendienst fysiek op de regiodag, anders online', () => {
    expect(vormAdvies({ plaats: 'Assen' }, { werkplek: 'binnendienst' }, rd, nu)).toBe('Belafspraak')
    expect(vormAdvies({}, { werkplek: 'binnendienst' }, rd, nu)).toBe('Taak in belblok')
    expect(vormAdvies({ plaats: 'Assen' }, { werkplek: 'buitendienst' }, rd, nu)).toBe('Fysiek · dinsdag Regio Oost')
    expect(vormAdvies({ plaats: 'Zwolle' }, { werkplek: 'buitendienst' }, rd, nu)).toBe('Online')
  })
})

describe('vrijeMomentenAgenda (gat 37)', () => {
  it('bezet uit de koppeling telt mee', () => {
    const alle = vrijeMomentenAgenda([], '2026-10-20', 30)
    const metBezet = vrijeMomentenAgenda([{ start: '2026-10-20T10:00:00Z', eind: '2026-10-20T10:30:00Z' }], '2026-10-20', 30)
    expect(alle).toHaveLength(20)
    expect(metBezet.some((m) => m.start === '2026-10-20T10:00:00.000Z')).toBe(false)
    expect(metBezet).toHaveLength(19)
  })
  it('een hele-dag-afspraak laat niets vrij; een blok over middernacht raakt de ochtend', () => {
    expect(vrijeMomentenAgenda([{ start: '2026-10-19T22:00:00Z', eind: '2026-10-20T22:00:00Z' }], '2026-10-20', 30)).toHaveLength(0)
    expect(vrijeMomentenAgenda([{ start: '2026-10-19T21:00:00Z', eind: '2026-10-20T06:30:00Z' }], '2026-10-20', 30)[0]!.start).toBe('2026-10-20T06:30:00.000Z')
  })
})

describe('conflicten', () => {
  it('overlap van dezelfde persoon, niet tussen collega\'s en niet bij geannuleerd', () => {
    const c = conflicten([
      { id: 'a', ownerId: 'u1', start: '2026-10-20T08:00:00Z', eind: '2026-10-20T08:30:00Z', status: 'gepland' },
      { id: 'b', ownerId: 'u1', start: '2026-10-20T08:15:00Z', eind: '2026-10-20T08:30:00Z', status: 'gepland' },
      { id: 'c', ownerId: 'u2', start: '2026-10-20T08:00:00Z', eind: '2026-10-20T09:00:00Z', status: 'gepland' },
      { id: 'd', ownerId: 'u1', start: '2026-10-20T08:00:00Z', eind: '2026-10-20T09:00:00Z', status: 'geannuleerd' },
    ])
    expect([...c].sort()).toEqual(['a', 'b'])
  })
})
