// Testronde (okt 2026): bevindingen B01 tot B08, B12 en B16 over klasse, matrix, ritme en motor.
// Elke test liet de fout eerst zien en is na de fix groen.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nlMoment } from '../../shared/datum'
import { RITMES_STARTSET, startRitme, verwerkUitkomst, type Ritme } from '../../shared/hercontact'
import { motorRun, verdeelCapaciteit, type MotorGebruiker, type MotorInvoer } from '../../shared/motor'
import { zoekDuplicaat } from '../../shared/ontdubbelen'
import { droogloop, evaluateTrigger, waaromTekst, type MotorAccount, type Regel } from '../../shared/regelPatronen'
import { STANDAARD_ACTIVITEITEN } from '../../shared/reis'
import {
  AFSPRAAKMATRIX_STANDAARD, BELMATRIX_STANDAARD, STARTPLAFOND_STANDAARD, klasseGrensFouten, klasseNaOmvangWijziging, klasseVoorOmvang,
  omvangVan, verwachtingVoorMij, type Klasse,
} from '../../shared/ritmematrix'

const NU = new Date('2026-10-14T08:00:00Z') // woensdag 10:00 in Nederland
const STARTERSET = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/regels-starterset.json'), 'utf8')) as any[]
const set: Regel[] = STARTERSET.map((r, i) => ({ ...r, id: `r${i + 1}`, actief: true, scope: 'organisatie' }))
const regel = (code: string): Regel => set.find((r) => r.code === code)!
const dagen = (n: number) => new Date(NU.getTime() - n * 864e5).toISOString()
const acc = (p: Partial<MotorAccount> = {}): MotorAccount => ({ id: p.id ?? 'a1', naam: 'Testprospect Omvang 01', type: 'prospect', nbStatus: 'in reis', aangemaaktOp: dagen(20), klasseCode: 'A', ownerId: 'u1', ownerWerkplek: 'binnendienst', ...p })
const gebruikers: MotorGebruiker[] = [
  { id: 'u1', naam: 'Jan Binnen', rol: 'accountmanager', werkplek: 'binnendienst', niveau: 'gevorderd', teamId: 't1' },
  { id: 'u2', naam: 'Bo Buiten', rol: 'accountmanager', werkplek: 'buitendienst', niveau: 'gevorderd', teamId: 't1' },
]
const invoer = (p: Partial<MotorInvoer>): MotorInvoer => ({ nu: NU, regels: [], accounts: [], gebruikers, laatst: new Map(), open: new Set(), bezetting: new Map(), ritmeVan: new Map(), ...p })

// Klassen zoals een organisatie ze had: zonder grenzen en zonder klasse D.
const ZONDER_GRENZEN: Klasse[] = [
  { id: 'kl-a', naam: 'A · Groot', tabblad: 'Prospects' },
  { id: 'kl-b', naam: 'B · Middel', tabblad: 'Prospects' },
  { id: 'kl-c', naam: 'C · Klein', tabblad: 'Prospects' },
]
const MET_GRENZEN: Klasse[] = [
  { id: 'kl-a', naam: 'A · Groot', minMedewerkers: 100, maxMedewerkers: null },
  { id: 'kl-b', naam: 'B · Middel', minMedewerkers: 20, maxMedewerkers: 99 },
  { id: 'kl-c', naam: 'C · Klein', minMedewerkers: 0, maxMedewerkers: 19 },
]

describe('B01 klasse schuift mee met het aantal medewerkers', () => {
  it('een afgeleide klasse volgt de nieuwe omvang', () => {
    expect(klasseNaOmvangWijziging({ klasse: 'kl-c', bron: 'voorstel uit medewerkers', oudeOmvang: 12 }, 300, MET_GRENZEN)).toEqual({ klasse: 'kl-a' })
  })
  it('een met de hand gekozen klasse blijft staan', () => {
    expect(klasseNaOmvangWijziging({ klasse: 'kl-c', bron: 'hand', oudeOmvang: 12 }, 300, MET_GRENZEN)).toBeNull()
  })
  it('zonder herkomst: afleiden als de klasse leeg is of paste bij de oude omvang, anders laten staan', () => {
    expect(klasseNaOmvangWijziging({ klasse: null, bron: null, oudeOmvang: null }, 300, MET_GRENZEN)).toEqual({ klasse: 'kl-a' })
    expect(klasseNaOmvangWijziging({ klasse: 'kl-c', bron: null, oudeOmvang: 12 }, 300, MET_GRENZEN)).toEqual({ klasse: 'kl-a' })
    expect(klasseNaOmvangWijziging({ klasse: 'kl-b', bron: null, oudeOmvang: 12 }, 300, MET_GRENZEN)).toBeNull()
  })
  it('geen wijziging als de klasse gelijk blijft', () => {
    expect(klasseNaOmvangWijziging({ klasse: 'kl-c', bron: 'voorstel uit medewerkers', oudeOmvang: 12 }, 15, MET_GRENZEN)).toBeNull()
  })
  it('de omvang komt uit medewerkers, anders uit het oude veld Aantal monteurs', () => {
    expect(omvangVan({ medewerkers: 40, customFields: { aantal_monteurs: 9 } })).toBe(40)
    expect(omvangVan({ customFields: { aantal_monteurs: 9 } })).toBe(9)
    expect(omvangVan({})).toBeNull()
  })
})

describe('B02 klassegrenzen en een laagste klasse', () => {
  it('elke omvang krijgt een klasse, ook onder de laagste grens', () => {
    expect(klasseVoorOmvang(5, ZONDER_GRENZEN)).toBe('kl-c')
    expect(klasseVoorOmvang(0, ZONDER_GRENZEN)).toBe('kl-c')
    expect(klasseVoorOmvang(60, ZONDER_GRENZEN)).toBe('kl-b')
  })
  it('eigen grenzen gaan voor de standaard', () => {
    expect([0, 19, 20, 99, 100, 5000].map((m) => klasseVoorOmvang(m, MET_GRENZEN))).toEqual(['kl-c', 'kl-c', 'kl-b', 'kl-b', 'kl-a', 'kl-a'])
  })
  it('een gat tussen de grenzen valt in de klasse eronder', () => {
    const gat: Klasse[] = [{ id: 'kl-a', naam: 'A · Groot', minMedewerkers: 100 }, { id: 'kl-b', naam: 'B · Klein', minMedewerkers: 0, maxMedewerkers: 49 }]
    expect(klasseVoorOmvang(70, gat)).toBe('kl-b')
  })
  it('grenzen controleren bij opslaan', () => {
    expect(klasseGrensFouten(MET_GRENZEN)).toEqual([])
    expect(klasseGrensFouten([{ id: 'x', naam: 'X · Fout', minMedewerkers: 50, maxMedewerkers: 10 }])).toHaveLength(1)
    expect(klasseGrensFouten([{ id: 'x', naam: 'X · Fout', minMedewerkers: -1 }])).toHaveLength(1)
  })
})

describe('B03 hercontactritme: poging 2 niet op het moment van poging 1', () => {
  const koud: Ritme = { ...RITMES_STARTSET[0]!, id: 'koud' }
  it('start vrijdag na 18:00, poging 1 maandag zonder reactie: poging 2 minstens drie dagen later', () => {
    const start = startRitme(koud, new Date('2026-10-16T16:06:00Z')) // vrijdag 18:06
    const r = verwerkUitkomst(start, koud, 'geen_reactie', new Date('2026-10-19T07:30:00Z')) // maandag 09:30
    expect(r.actie).toBe('volgende')
    expect(nlMoment(new Date(r.volgende!.op)).datum).toBe('2026-10-22')
  })
  it('op tijd afgehandeld blijft het schema van de dagen gelijk', () => {
    const start = startRitme(koud, new Date('2026-10-13T08:00:00Z')) // dinsdag 10:00
    const r = verwerkUitkomst(start, koud, 'geen_reactie', new Date('2026-10-13T09:00:00Z'))
    expect(nlMoment(new Date(r.volgende!.op)).datum).toBe('2026-10-16')
  })
})

describe('B04 terugkomtaak bij Geparkeerd', () => {
  const geparkeerd = acc({ nbStatus: 'wachtend', faseId: 'geparkeerd', reisId: 'r1', terugOp: '2027-04-14', wachtendTot: '2027-04-14', gebeurtenissen: [{ id: 'g1', gebeurtenis: 'geparkeerd', naarFaseId: 'geparkeerd', op: dagen(0.1) }] })
  const terugkom = STANDAARD_ACTIVITEITEN.filter((a) => a.faseId === 'geparkeerd')
  const start = new Map([['r1|geparkeerd', terugkom]])
  it('landt op de terugkomdatum, niet meteen', () => {
    const r = motorRun(invoer({ accounts: [geparkeerd], startactiviteiten: start }))
    expect(r.taken).toHaveLength(1)
    expect(nlMoment(new Date(r.taken[0]!.due)).datum).toBe('2027-04-14')
  })
  it('geen eigen taak als de regel Geparkeerd terug op die dag zelf opvolgt', () => {
    expect(motorRun(invoer({ accounts: [geparkeerd], startactiviteiten: start, regels: [regel('SR18')] })).taken).toHaveLength(0)
  })
})

describe('B05 droogloop rekent als de motor', () => {
  const sr04 = regel('SR04')
  const accounts = [
    acc({ id: 'met-ritme', ritme: { actief: true, volgendePogingOp: dagen(-2), poging: 2, van: 5 } }),
    acc({ id: 'zonder-klasse', klasseCode: null }),
    acc({ id: 'gewoon', klasseCode: 'C' }),
    acc({ id: 'ander-ritme', klasseCode: 'B' }),
  ]
  const ritmeVan = new Map([['ander-ritme', 'hercontact']])
  it('lopend ritme, geen klasse en een ander ritme tellen niet mee', () => {
    const motor = motorRun(invoer({ regels: [sr04], accounts, ritmeVan })).taken.length
    const d = droogloop(sr04, accounts, NU, { laatst: new Map(), open: new Set() }, undefined, { ritmeVan })
    expect(motor).toBe(1)
    expect(d.taken).toBe(motor)
    expect(d.geraakt).toBe(1)
  })
  it('de cadans volgt de matrix: klasse C (per kwartaal) 40 dagen na de vorige keer nog niet', () => {
    const laatst = new Map([[`${sr04.id}|gewoon`, dagen(40)]])
    expect(motorRun(invoer({ regels: [sr04], accounts: [accounts[2]!], laatst })).taken).toHaveLength(0)
    expect(droogloop(sr04, [accounts[2]!], NU, { laatst, open: new Set() }).taken).toBe(0)
  })
})

describe('B06 bezoekritme volgt de afspraakmatrix', () => {
  const sr05 = regel('SR05')
  const buiten = (p: Partial<MotorAccount>) => acc({ ownerId: 'u2', ownerWerkplek: 'buitendienst', ...p })
  it('de starterset zet SR05 op de matrix', () => {
    expect(sr05.data.trigger.parameters.matrix).not.toBe(false)
  })
  it('0 in de afspraakmatrix is bewust uit; de standaard geeft een bezoek', () => {
    const a = buiten({ klasseCode: 'C' })
    expect(motorRun(invoer({ regels: [sr05], accounts: [a] })).taken).toHaveLength(1)
    expect(motorRun(invoer({ regels: [sr05], accounts: [a], afspraakmatrix: { bezoek: { C: { aantal: 0, periode: 'jaar' } } } })).taken).toHaveLength(0)
  })
  it('het interval komt uit de rij Bezoek: B per halfjaar, dus na 100 dagen nog niet', () => {
    const a = buiten({ klasseCode: 'B' })
    const laatst = new Map([[`${sr05.id}|a1`, dagen(100)]])
    expect(motorRun(invoer({ regels: [sr05], accounts: [a], laatst })).taken).toHaveLength(0)
    expect(motorRun(invoer({ regels: [sr05], accounts: [a], laatst, afspraakmatrix: { bezoek: { B: { aantal: 1, periode: 'kwartaal' } } } })).taken).toHaveLength(1)
  })
})

describe('B07 Wat betekent dit voor mij: alleen prospects in reis', () => {
  it('nee, overgedragen en klanten tellen niet mee', () => {
    const accounts = [
      { type: 'prospect' as const, nbStatus: 'in reis', klasseCode: 'A' },
      { type: 'prospect' as const, nbStatus: 'nee', klasseCode: 'A' },
      { type: 'prospect' as const, nbStatus: 'overgedragen', klasseCode: 'A' },
      { type: 'klant' as const, nbStatus: 'klant', klasseCode: 'A' },
    ]
    const v = verwachtingVoorMij(accounts, BELMATRIX_STANDAARD, AFSPRAAKMATRIX_STANDAARD)
    expect(v.accounts).toBe(1)
    expect(v.bellen).toBeCloseTo(12 / 52, 5)
    expect(v.bezoeken).toBeCloseTo(4 / 52, 5)
  })
})

describe('B08 dagplafond voor startactiviteiten', () => {
  it('50 startactiviteiten uit een import worden over werkdagen gespreid', () => {
    const t = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, ownerId: 'u1', due: '2026-10-14T08:00:00.000Z', actionType: 'taak', herkomst: 'startactiviteit' as const }))
    const r = verdeelCapaciteit(t, gebruikers)
    const perDag = new Map<string, number>()
    for (const x of r.geland) { const d = nlMoment(new Date(x.due)).datum; perDag.set(d, (perDag.get(d) ?? 0) + 1) }
    expect(Math.max(...perDag.values())).toBe(STARTPLAFOND_STANDAARD)
    expect(perDag.get('2026-10-14')).toBe(STARTPLAFOND_STANDAARD)
    expect([...perDag.keys()].every((d) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()))).toBe(true)
  })
  it('in de motor: een import van 50 prospects geeft hooguit het plafond per dag', () => {
    const accounts = Array.from({ length: 50 }, (_, i) => acc({ id: `imp${i}`, reisId: 'r1', faseId: 'gevonden', nbStatus: 'nieuw', gebeurtenissen: [{ id: `g${i}`, gebeurtenis: 'import', naarFaseId: 'gevonden', op: dagen(0.1) }] }))
    const start = new Map([['r1|gevonden', STANDAARD_ACTIVITEITEN.filter((a) => a.faseId === 'gevonden')]])
    const r = motorRun(invoer({ accounts, startactiviteiten: start }))
    expect(r.taken).toHaveLength(50)
    const vandaag = r.taken.filter((x) => nlMoment(new Date(x.due)).datum === nlMoment(NU).datum).length
    expect(vandaag).toBeLessThanOrEqual(STARTPLAFOND_STANDAARD)
  })
  it('bestaande open startactiviteiten tellen mee', () => {
    const t = [{ id: 's', ownerId: 'u1', due: '2026-10-14T08:00:00.000Z', actionType: 'taak', herkomst: 'startactiviteit' as const }]
    const r = verdeelCapaciteit(t, gebruikers, undefined, new Map(), {}, new Map([['u1|2026-10-14', STARTPLAFOND_STANDAARD]]))
    expect(nlMoment(new Date(r.geland[0]!.due)).datum).toBe('2026-10-15')
  })
})

describe('B12 dubbelcheck: ander getal of andere plaats is hooguit mogelijk dubbel', () => {
  const bestand = [{ id: 'x', name: 'Proefbedrijf Omvang12 Testronde', city: 'Utrecht' }]
  it('ander getal en andere plaats: mogelijk', () => {
    expect(zoekDuplicaat({ name: 'Proefbedrijf Omvang60 Testronde', city: 'Amersfoort' }, bestand).soort).toBe('mogelijk')
  })
  it('ander getal in dezelfde plaats: mogelijk', () => {
    expect(zoekDuplicaat({ name: 'Proefbedrijf Omvang60 Testronde', city: 'Utrecht' }, bestand).soort).toBe('mogelijk')
  })
  it('zelfde naam in een andere plaats: mogelijk', () => {
    expect(zoekDuplicaat({ name: 'Proefbedrijf Omvang12 Testronde', city: 'Amersfoort' }, bestand).soort).toBe('mogelijk')
  })
  it('zelfde naam, zelfde of onbekende plaats: zeker', () => {
    expect(zoekDuplicaat({ name: 'Proefbedrijf Omvang12 Testronde BV', city: 'Utrecht' }, bestand).soort).toBe('zeker')
    expect(zoekDuplicaat({ name: 'Proefbedrijf Omvang12 Testronde' }, bestand).soort).toBe('zeker')
  })
})

describe('B16 waarom zonder dubbele reden', () => {
  it('belritme: één zin over het ritme, met de klasse', () => {
    const sr04 = regel('SR04')
    const w = waaromTekst(sr04, evaluateTrigger(sr04, acc({ klasseCode: 'B' }), NU))
    expect(w.match(/aan de beurt/g)).toHaveLength(1)
    expect(w).toContain('klasse B')
  })
  it('een reden die de omschrijving herhaalt valt weg', () => {
    expect(waaromTekst({ naam: 'X', data: { omschrijving: 'Het ritme is aan de beurt.' } } as any, { reden: 'Het ritme is aan de beurt' })).toBe('Het ritme is aan de beurt.')
  })
})
