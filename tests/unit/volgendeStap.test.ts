// Volgende beste stap (F2): de weging in shared/volgendeStap.ts. Taken, inzichten, ritme, terugkomregel, fase-norm,
// bereikbaarheid, klasse, een lopende opvolgreeks, de Bewaker (afkoeling, bel-me-niet, afmelding, plafond), de
// leerlus en Niet nu. Alles fictief.
import { describe, expect, it } from 'vitest'
import { besteUur, plafondStand, volgendeStap, type VolgInvoer } from '../../shared/volgendeStap'

// Woensdag 14 oktober 2026, 10:00 in Nederland (08:00 UTC).
const NU = new Date('2026-10-14T08:00:00Z')
const dagen = (n: number, uur = 8) => new Date(Date.UTC(2026, 9, 14 + n, uur)).toISOString()

function basis(over: Partial<VolgInvoer> = {}): VolgInvoer {
  return {
    nu: NU,
    account: { id: 'acc-1', naam: 'Testinstallatie Vonkdal', nbStatus: 'in reis', data: {}, klasse: 'A', fase: { label: 'Gekwalificeerd', dagen: 5, norm: 21 }, ritme: null, terugOp: null },
    contacten: [{ id: 'c-ruud', naam: 'Ruud de Test', rol: 'beslisser' }, { id: 'c-anna', naam: 'Anna Proef', rol: 'gebruiker' }],
    taken: [], inzichten: [], belpogingen: [], contactmomenten: [], reeks: null,
    ...over,
  }
}

describe('volgendeStap', () => {
  it('een verse aanleiding wint, met bereikbaarheid in de titel en factoren met punten', () => {
    const u = volgendeStap(basis({
      inzichten: [{ id: 'i1', titel: 'Vacature voor 12 monteurs', relevantie: 90, op: dagen(-2), contactId: null }],
      belpogingen: [
        { contactId: 'c-ruud', op: '2026-10-01T14:20:00Z', opgenomen: true }, { contactId: 'c-ruud', op: '2026-10-05T14:40:00Z', opgenomen: true },
        { contactId: 'c-ruud', op: '2026-10-06T14:10:00Z', opgenomen: true }, { contactId: 'c-ruud', op: '2026-10-07T07:10:00Z', opgenomen: false },
      ],
    }))
    expect(u.stap.sleutel).toBe('inzicht:i1')
    expect(u.stap.soort).toBe('bellen')
    expect(u.stap.titel).toBe('Bel Ruud over: Vacature voor 12 monteurs vandaag tussen 16:00 en 17:00')
    expect(u.stap.factoren.map((f) => f.label)).toEqual(expect.arrayContaining([
      'Verse aanleiding: Vacature voor 12 monteurs, 2 dagen oud', 'Ruud nam 3 van 3 keer op tussen 16:00 en 17:00', 'Klasse A in de accountmatrix',
    ]))
    expect(u.stap.score).toBe(u.stap.factoren.reduce((s, f) => s + f.punten, 0))
    expect(u.stap.bewaker.mag).toBe(true)
    expect(u.alternatieven).toHaveLength(2)
    expect(u.herkomst).toEqual(expect.arrayContaining(['Belpogingen', 'Accountmatrix', 'Bewaker']))
    expect(u.bereikbaarheid).toEqual({ contactId: 'c-ruud', uur: 16, opgenomen: 3, totaal: 3 })
  })

  it('een achterstallige taak met hoge prioriteit gaat voor een oude aanleiding', () => {
    const u = volgendeStap(basis({
      taken: [{ id: 't1', titel: 'Offerte nabellen', actionType: 'bellen', dueDate: dagen(-3), priority: 'hoog', contactId: 'c-ruud' }],
      inzichten: [{ id: 'i1', titel: 'Nieuwbouw gemeld', relevantie: 60, op: dagen(-25), contactId: null }],
    }))
    expect(u.stap.sleutel).toBe('taak:t1')
    expect(u.stap.taakId).toBe('t1')
    expect(u.stap.factoren[0]).toMatchObject({ label: 'Taak staat 3 dagen over tijd', punten: 26 })
  })

  it('inzichten van 30 dagen of ouder en met een open taak tellen niet', () => {
    const u = volgendeStap(basis({ inzichten: [
      { id: 'oud', titel: 'Oud', relevantie: 100, op: dagen(-30), contactId: null },
      { id: 'taak', titel: 'Heeft al een taak', relevantie: 100, op: dagen(0), contactId: null, heeftTaak: true },
    ] }))
    expect([u.stap, ...u.alternatieven].some((k) => k.inzichtId)).toBe(false)
  })

  it('ritme en fase-norm: poging over tijd en te lang in de fase', () => {
    const u = volgendeStap(basis({
      account: { ...basis().account, fase: { label: 'Gekwalificeerd', dagen: 30, norm: 21 }, ritme: { actief: true, naam: 'Koud', stap: 2, van: 5, kanaal: 'bellen', volgendeOp: dagen(-1) } },
    }))
    expect(u.stap.sleutel).toBe('ritme:2')
    expect(u.stap.factoren.map((f) => f.label)).toEqual(expect.arrayContaining(['Ritme Koud: poging 2 1 dag over tijd', '30 dagen in Gekwalificeerd, norm 21']))
  })

  it('een open ritmepoging maakt geen tweede ritmekandidaat', () => {
    const u = volgendeStap(basis({
      account: { ...basis().account, ritme: { actief: true, stap: 2, van: 5, kanaal: 'bellen', volgendeOp: dagen(-1) } },
      taken: [{ id: 't2', titel: 'Poging 2: Testinstallatie Vonkdal', actionType: 'bellen', dueDate: dagen(-1), priority: 'middel', contactId: 'c-ruud', ritmePoging: { n: 2, van: 5 } }],
    }))
    expect([u.stap, ...u.alternatieven].filter((k) => k.sleutel.startsWith('ritme:'))).toHaveLength(0)
    expect(u.stap.sleutel).toBe('taak:t2')
  })

  it('terugkomregel: de terugkomdatum is bereikt', () => {
    const u = volgendeStap(basis({ account: { ...basis().account, terugOp: '2026-10-13', terugkom: { aanpak: 'Vraag naar de nieuwe vestiging', kanaal: 'bellen' } } }))
    expect(u.stap.sleutel).toBe('terugkom:2026-10-13')
    expect(u.stap.titel).toBe('Bellen: terugkomen bij Ruud, vraag naar de nieuwe vestiging')
  })

  it('een lopende reeks: niets doen is de beste stap, extra contact weegt minder', () => {
    const u = volgendeStap(basis({
      reeks: { id: 'r1', naam: 'Na informatie', status: 'loopt', volgende: { kanaal: 'bellen', titel: 'Bellen: heeft u het overzicht bekeken?', geplandOp: '2026-10-20T07:00:00Z' } },
      taken: [{ id: 't1', titel: 'Losse beltaak', actionType: 'bellen', dueDate: dagen(0), priority: 'middel', contactId: 'c-ruud' }],
    }))
    expect(u.stap.soort).toBe('wachten')
    expect(u.stap.titel).toBe('Niets doen: de opvolgreeks belt dinsdag 20 oktober')
    const los = u.alternatieven.find((k) => k.sleutel === 'taak:t1')!
    expect(los.factoren.some((f) => f.punten === -20 && f.bron === 'Opvolgreeks')).toBe(true)
  })

  it('een taak uit de reeks zelf krijgt geen aftrek', () => {
    const u = volgendeStap(basis({
      reeks: { id: 'r1', naam: 'Na informatie', status: 'loopt', volgende: { kanaal: 'linkedin', titel: 'LinkedIn', geplandOp: dagen(0) } },
      taken: [{ id: 't3', titel: 'LinkedIn: connectieverzoek', actionType: 'linkedin', dueDate: dagen(-1), priority: 'middel', contactId: 'c-ruud', reeksId: 'r1' }],
    }))
    const t = [u.stap, ...u.alternatieven].find((k) => k.sleutel === 'taak:t3')!
    expect(t.factoren.some((f) => f.punten < 0)).toBe(false)
    expect(t.factoren.some((f) => f.label === 'Stap uit de lopende opvolgreeks')).toBe(true)
  })

  it('de Bewaker: afkoeling na nee geeft wachten met de reden', () => {
    const u = volgendeStap(basis({
      account: { ...basis().account, nbStatus: 'nee', data: { nee: { reden: 'Geen behoefte', op: '2026-10-01T10:00:00Z', afkoeling: { bellen: 90, mail: 60, linkedin: 90, whatsapp: 180, bezoek: 180, kaart: 365 } } } },
      taken: [{ id: 't1', titel: 'Bel nog eens', actionType: 'bellen', dueDate: dagen(0), priority: 'hoog', contactId: 'c-ruud' }],
    }))
    expect(u.stap.soort).toBe('wachten')
    expect(u.stap.titel).toMatch(/^Niets doen: afkoelperiode/)
    expect(u.alternatieven[0]!.waarom).toMatch(/^De Bewaker houdt dit tegen/)
  })

  it('de Bewaker: bel-me-niet blokkeert bellen, mail mag nog; afmelding blokkeert mail', () => {
    const u = volgendeStap(basis({ contacten: [{ id: 'c-ruud', naam: 'Ruud de Test', rol: 'beslisser', belMeNiet: true, afgemeld: true }] }))
    const bel = [u.stap, ...u.alternatieven].find((k) => k.sleutel === 'std:bellen:c-ruud')
    expect(bel?.bewaker).toMatchObject({ mag: false })
    expect(bel?.bewaker.tekst).toMatch(/bel-me-niet/)
    expect(u.stap.soort).toBe('linkedin')
    const mail = u.alternatieven.find((k) => k.soort === 'mail')
    expect(mail?.bewaker.tekst).toBe('Tegengehouden: dit contact meldde zich af voor mail.')
  })

  it('het frequentieplafond: gisteren gebeld, dan nu niet nog eens', () => {
    const u = volgendeStap(basis({ contactmomenten: [dagen(-1)], taken: [{ id: 't1', titel: 'Bel', actionType: 'bellen', dueDate: dagen(0), priority: 'middel', contactId: 'c-ruud' }] }))
    expect(u.stap.soort).toBe('wachten')
    expect(u.stap.titel).toBe('Niets doen: laatste contact was dinsdag 13 oktober (plafond 1 per 3 werkdagen)')
  })

  it('de leerlus: vaak "klopt niet" bij bellen laat bellen minder wegen', () => {
    const zonder = volgendeStap(basis())
    const met = volgendeStap(basis({ leerlus: { bellen: 4 } }))
    const b0 = [zonder.stap, ...zonder.alternatieven].find((k) => k.sleutel === 'std:bellen:c-ruud')!
    const b1 = [met.stap, ...met.alternatieven].find((k) => k.sleutel === 'std:bellen:c-ruud')!
    expect(b1.score).toBeLessThan(b0.score)
    expect(b1.factoren.at(-1)!.label).toBe('Leerlus: 4 keer "klopt niet" bij bellen')
  })

  it('Niet nu: een onderdrukte stap valt weg', () => {
    const u = volgendeStap(basis({ onderdrukt: ['std:bellen:c-ruud'] }))
    expect([u.stap, ...u.alternatieven].some((k) => k.sleutel === 'std:bellen:c-ruud')).toBe(false)
  })

  it('contactkaart: de stap gaat over dat contact', () => {
    const u = volgendeStap(basis({
      focusContactId: 'c-anna',
      taken: [{ id: 't-ruud', titel: 'Bel Ruud', actionType: 'bellen', dueDate: dagen(-2), priority: 'urgent', contactId: 'c-ruud' }],
    }))
    expect(u.stap.contactId).toBe('c-anna')
    expect([u.stap, ...u.alternatieven].some((k) => k.taakId === 't-ruud')).toBe(false)
  })

  it('besteUur en plafondStand', () => {
    expect(besteUur([{ contactId: 'x', op: '2026-10-01T08:00:00Z', opgenomen: true }], 'x')).toBeNull()
    expect(plafondStand([dagen(-1), dagen(-6)], { werkdagen: 3, maxBerichten: 2 }, NU)).toMatchObject({ aantal: 1, vol: false })
  })
})
