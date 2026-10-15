import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { nlMoment, volgendWerkmoment, voegWerkdagenToe } from '../../shared/datum'
import { landingsmoment, motorRun, verdeelCapaciteit, type MotorGebruiker, type MotorInvoer } from '../../shared/motor'
import { REGEL_KOLOMMEN, regelUitRij } from '../../shared/regelExcel'
import {
  PATROON_SLEUTELS, PATRONEN, cadansVerstreken, droogloop, evaluateTrigger, regelLevertRuis, ruleTargetsAccount, sjabloonFouten,
  valideerRegel, vulSjabloon, waaromTekst, type MotorAccount, type Patroon, type Regel,
} from '../../shared/regelPatronen'
import {
  BELMATRIX_STANDAARD, intervalDagen, jaartotaal, klasseVoorOmvang, leesMatrix, ritmeAfrekening, ritmeLabel, type Matrix,
} from '../../shared/ritmematrix'

const NU = new Date('2026-10-14T08:00:00Z') // woensdag, 10:00 in Nederland
const STARTERSET = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/regels-starterset.json'), 'utf8')) as any[]
const set: Regel[] = STARTERSET.map((r, i) => ({ ...r, id: `r${i + 1}`, actief: true, scope: 'organisatie' }))
const regel = (code: string): Regel => set.find((r) => r.code === code)!
const dagen = (n: number) => new Date(NU.getTime() - n * 864e5).toISOString()

function acc(p: Partial<MotorAccount> = {}): MotorAccount {
  return { id: p.id ?? 'a1', naam: 'Testprospect Woningbouw 01', type: 'prospect', nbStatus: 'in reis', aangemaaktOp: dagen(20), klasseCode: 'A', ownerId: 'u1', ownerWerkplek: 'binnendienst', ...p }
}
const gebruikers: MotorGebruiker[] = [
  { id: 'u1', naam: 'Jan Binnen', rol: 'accountmanager', werkplek: 'binnendienst', niveau: 'gevorderd', teamId: 't1' },
  { id: 'u2', naam: 'Bo Buiten', rol: 'accountmanager', werkplek: 'buitendienst', niveau: 'gevorderd', teamId: 't1' },
  { id: 'u3', naam: 'Sam Manager', rol: 'salesmanager', werkplek: 'binnendienst', niveau: 'expert', teamId: 't1' },
]
function invoer(p: Partial<MotorInvoer>): MotorInvoer {
  return { nu: NU, regels: [], accounts: [], gebruikers, laatst: new Map(), open: new Set(), bezetting: new Map(), ritmeVan: new Map(), ...p }
}

/** Fixture per patroon waarop de regel vuurt. */
const FIXTURE: Record<Patroon, Partial<MotorAccount>> = {
  'datum-drempel': { terugOp: '2026-11-01' },
  inactiviteit: { laatsteContactOp: dagen(60) },
  ritme: {},
  gebeurtenis: { gebeurtenissen: [{ id: 'g1', gebeurtenis: 'eerste-afspraak-gepland', naarFaseId: 'afspraak-gepland', op: dagen(0.1) }] },
  'te-lang-in-fase': { faseSinds: dagen(15), verwachtVerblijfDagen: 10, faseId: 'gekwalificeerd' },
  'lead-verlopen': { dossierOp: dagen(40) },
  'jaarplanning-venster': { jaarplanning: { vensterEind: '2026-09-30', benaderdDitJaar: false } },
  'afspraak-niet-overgedragen': { afspraken: [{ id: 'af1', eerste: true, status: 'gehouden', op: dagen(2) }] },
  'afspraak-onvoldoende-gekwalificeerd': { bandScore: 1, afspraken: [{ id: 'af2', eerste: true, status: 'gepland', op: new Date(NU.getTime() + 864e5).toISOString() }] },
  'campagne-achterstand': { campagnes: [{ id: 'c1', achterstand: 15 }] },
  'hercontact-vervolg': { ritme: { actief: true, volgendePogingOp: dagen(0.5), poging: 3, van: 5 } },
  'geparkeerd-terug': { nbStatus: 'wachtend', terugOp: '2026-10-14' },
  'trigger-heractivatie': { nbStatus: 'wachtend', signalen: [{ id: 's1', soort: 'vacature', op: dagen(2), extern: true }, { id: 's2', soort: 'nieuws', op: dagen(2), extern: true }, { id: 's3', soort: 'kvk-mutatie', op: dagen(2), extern: true }, { id: 's4', soort: 'jubileum', op: dagen(2), extern: true }] },
  'tussendoel-gehaald': { tussendoelen: [{ id: 'td1', gehaaldOp: dagen(1) }] },
  'partner-te-laat': { partnerLeads: [{ id: 'pl1', deadline: dagen(1), bevestigd: false }] },
}

describe('triggerpatronen', () => {
  it('de catalogus heeft vijftien patronen', () => {
    expect(PATROON_SLEUTELS).toHaveLength(15)
  })
  for (const p of PATROON_SLEUTELS) {
    it(`${p}: vuurt op de fixture en niet zonder`, () => {
      const r = { data: { trigger: { patroon: p, parameters: p === 'gebeurtenis' ? { gebeurtenis: 'eerste-afspraak-gepland' } : p === 'trigger-heractivatie' ? {} : {} } } } as any
      expect(evaluateTrigger(r, acc(FIXTURE[p]), NU).vuurt).toBe(true)
      if (p !== 'ritme') expect(evaluateTrigger(r, acc(), NU).vuurt).toBe(false)
    })
  }
  it('inactiviteit met ookZonderDatum gebruikt de aanmaakdatum als anker (gat 20)', () => {
    const r = regel('SR03')
    const a = acc({ faseId: 'gekwalificeerd', laatsteContactOp: null, aangemaaktOp: dagen(8) })
    const u = evaluateTrigger(r, a, NU)
    expect(u.vuurt).toBe(true)
    expect(u.bewijs[0]).toContain('aangemaakt')
    expect(evaluateTrigger(r, acc({ laatsteContactOp: null, aangemaaktOp: dagen(6) }), NU).vuurt).toBe(false)
  })
  it('datum precies op de grens vuurt', () => {
    const r = { data: { trigger: { patroon: 'inactiviteit', parameters: { dagen: 30 } } } } as any
    expect(evaluateTrigger(r, acc({ laatsteContactOp: dagen(30) }), NU).vuurt).toBe(true)
    expect(evaluateTrigger(r, acc({ laatsteContactOp: dagen(29.5) }), NU).vuurt).toBe(false)
  })
})

describe('afbakening (gat 6)', () => {
  const basis = (af: any, extra: Partial<Regel> = {}): Regel => ({ ...regel('SR06'), data: { ...regel('SR06').data, afbakening: af }, ...extra })
  const passend = acc({ laatsteContactOp: dagen(50), reisId: 'r1', faseId: 'benaderd', doelgroepId: 'd1', campagneIds: ['c1'], klasse: 'kl-a', klasseCode: 'A' })
  const gevallen: [string, any, Partial<MotorAccount>][] = [
    ['accounttype', { accounttypes: ['prospect'] }, { type: 'klant' }],
    ['status', { statussen: ['in reis'] }, { nbStatus: 'nieuw' }],
    ['reis', { reisIds: ['r1'] }, { reisId: 'r2' }],
    ['fase', { faseIds: ['benaderd'] }, { faseId: 'in-gesprek' }],
    ['doelgroep', { doelgroepIds: ['d1'] }, { doelgroepId: 'd2' }],
    ['campagne', { campagneIds: ['c1'] }, { campagneIds: ['c9'] }],
    ['klasse', { klassen: ['A'] }, { klasseCode: 'C', klasse: 'kl-c' }],
  ]
  for (const [naam, af, anders] of gevallen) {
    it(`${naam} filtert echt`, () => {
      expect(ruleTargetsAccount(basis(af), passend, NU)).toBe(true)
      expect(ruleTargetsAccount(basis(af), { ...passend, ...anders }, NU)).toBe(false)
    })
  }
  it('alle afbakeningen gecombineerd', () => {
    const alles = Object.assign({}, ...gevallen.map((g) => g[1]))
    expect(ruleTargetsAccount(basis(alles), passend, NU)).toBe(true)
    expect(ruleTargetsAccount(basis(alles), { ...passend, type: 'klant' }, NU)).toBe(false)
  })
  it('persoonlijke regel raakt alleen de eigen accounts; teamregel alleen het team', () => {
    expect(ruleTargetsAccount(basis({}, { scope: 'persoonlijk', eigenaarId: 'u1' }), passend, NU)).toBe(true)
    expect(ruleTargetsAccount(basis({}, { scope: 'persoonlijk', eigenaarId: 'u2' }), passend, NU)).toBe(false)
    expect(ruleTargetsAccount(basis({}, { scope: 'team', teamId: 't1' }), { ...passend, ownerTeamId: 't1' }, NU)).toBe(true)
    expect(ruleTargetsAccount(basis({}, { scope: 'team', teamId: 't1' }), { ...passend, ownerTeamId: 't2' }, NU)).toBe(false)
  })
  it('geen contacttaak in afkoeling op dat kanaal', () => {
    const inAfkoeling = { ...passend, nbStatus: 'in reis', nee: { reden: 'Geen budget', op: dagen(10), afkoeling: { bellen: 90, mail: 60 } } }
    // status in reis met een oude nee telt niet; alleen status nee in afkoeling
    expect(ruleTargetsAccount(basis({}), inAfkoeling, NU)).toBe(true)
    expect(ruleTargetsAccount(basis({}), { ...inAfkoeling, nbStatus: 'nee' }, NU)).toBe(false)
    expect(ruleTargetsAccount(basis({}), { ...passend, belMeNiet: true }, NU)).toBe(false)
  })
  it('elk veld in de regel stuurt iets: geen dood veld (gat 6 en 7)', () => {
    const r = regel('SR06')
    const velden = [...Object.keys(r.data), ...Object.keys(r.data.gevolg), ...Object.keys(r.data.afbakening ?? {})]
    const gestuurd = new Set(['subcategorie', 'omschrijving', 'activiteit', 'bron', 'specifiekeBron', 'trigger', 'afbakening', 'gevolg', 'herkomst',
      'actiesoort', 'uitvoerderrol', 'termijnWerkdagen', 'taaksjabloon', 'belscriptId', 'automatischVoorbereiden', 'signaaltype', 'verwachtResultaat',
      'accounttypes', 'statussen', 'reisIds', 'faseIds', 'doelgroepIds', 'campagneIds', 'klassen'])
    for (const v of velden) expect(gestuurd.has(v), v).toBe(true)
    // Elke kolom in Excel komt uit dezelfde structuur.
    expect(REGEL_KOLOMMEN.length).toBeGreaterThanOrEqual(30)
  })
})

describe('cadans, sjabloon en waarom', () => {
  it('cadans: Continu, eerste run, precies op de grens', () => {
    expect(cadansVerstreken(0, dagen(0), NU)).toBe(true)
    expect(cadansVerstreken(7, null, NU)).toBe(true)
    expect(cadansVerstreken(7, dagen(7), NU)).toBe(true)
    expect(cadansVerstreken(7, dagen(6.9), NU)).toBe(false)
  })
  it('sjabloon: ontbrekende waarde en onbekende variabele', () => {
    expect(vulSjabloon('Bel {contact} van {account}', { account: 'Teeuwen Bouw' })).toBe('Bel de contactpersoon van Teeuwen Bouw')
    expect(sjabloonFouten('Bel {klant}')).toEqual(['Onbekende variabele {klant}'])
    expect(valideerRegel({ ...regel('SR06'), data: { ...regel('SR06').data, gevolg: { ...regel('SR06').data.gevolg, taaksjabloon: 'Bel {klant}' } } })).toContain('Onbekende variabele {klant}')
  })
  it('waarom in gewone taal', () => {
    const u = evaluateTrigger(regel('SR06'), acc({ laatsteContactOp: dagen(50) }), NU)
    expect(waaromTekst(regel('SR06'), u)).toBe('Al lang geen contact met dit account. Al 50 dagen geen contact.')
  })
})

describe('landing en capaciteit', () => {
  it('volgend werkmoment: geen weekend of feestdag, 9 tot 18', () => {
    expect(nlMoment(volgendWerkmoment(new Date('2026-10-17T10:00:00Z'))).datum).toBe('2026-10-19') // zaterdag naar maandag
    expect(nlMoment(volgendWerkmoment(new Date('2026-12-24T17:30:00Z'))).datum).toBe('2026-12-28') // na 18 uur, kerst
    expect(nlMoment(volgendWerkmoment(new Date('2026-10-14T06:00:00Z'))).uur).toBe(9)
    expect(voegWerkdagenToe('2026-10-16', 1)).toBe('2026-10-19')
  })
  it('landing: belblok, regiodag, anders volgend werkmoment; regiodag vandaag al voorbij', () => {
    expect(landingsmoment({ termijnWerkdagen: 1 }, { werkplek: 'binnendienst' }, [{ start: '2026-10-15T07:00:00Z' }], [], NU).toISOString()).toBe('2026-10-15T07:00:00.000Z')
    expect(nlMoment(landingsmoment({ termijnWerkdagen: 1, gebiedId: 'g1' }, { werkplek: 'buitendienst' }, [], [{ gebiedId: 'g1', datum: '2026-10-14' }, { gebiedId: 'g1', datum: '2026-10-21' }], NU)).datum).toBe('2026-10-21')
    expect(nlMoment(landingsmoment({ termijnWerkdagen: 1 }, { werkplek: 'binnendienst' }, [], [], NU)).uur).toBe(10)
  })
  it('capaciteit: precies 40 past; 41 schuift één taak naar de volgende werkdag; meerdere uitvoerders', () => {
    const t = (n: number, owner = 'u1') => Array.from({ length: n }, (_, i) => ({ id: `${owner}-${i}`, ownerId: owner, due: '2026-10-14T08:00:00.000Z', actionType: 'bellen' }))
    expect(verdeelCapaciteit(t(40), gebruikers).geschoven).toHaveLength(0)
    const r = verdeelCapaciteit([...t(41), ...t(41, 'u3')], gebruikers)
    expect(r.geschoven).toHaveLength(2)
    expect(nlMoment(new Date(r.geschoven[0]!.due)).datum).toBe('2026-10-15')
    expect(verdeelCapaciteit(t(7, 'u2').map((x) => ({ ...x, actionType: 'bezoek' })), gebruikers).geschoven).toHaveLength(1)
  })
})

describe('accountmatrix (F16)', () => {
  it('null en 0 zijn verschillend (gat 43)', () => {
    expect(jaartotaal({ aantal: null, periode: 'maand' })).toBeNull()
    expect(jaartotaal({ aantal: 0, periode: 'maand' })).toBe(0)
    expect(ritmeLabel({ aantal: null, periode: 'maand' })).toBe('niet ingesteld')
    expect(ritmeLabel({ aantal: 0, periode: 'maand' })).toBe('bewust uit (0)')
    expect(ritmeLabel({ aantal: 1, periode: 'maand' })).toBe('12×/jaar = elke 4 weken')
    expect(intervalDagen({ aantal: 1, periode: 'maand' })).toBe(30)
    expect(intervalDagen({ aantal: 100, periode: 'maand' })).toBe(1)
  })
  it('klasseVoorOmvang: grenzen 10, 50, 250 en eigen klassen', () => {
    expect([9, 10, 49, 50, 249, 250].map((m) => klasseVoorOmvang(m))).toEqual(['D', 'C', 'C', 'B', 'B', 'A'])
    expect(klasseVoorOmvang(30, [{ id: 'kl-x', naam: 'X · Groot', minMedewerkers: 25 }, { id: 'kl-y', naam: 'Y · Klein', minMedewerkers: 0, maxMedewerkers: 24 }])).toBe('kl-x')
    expect(klasseVoorOmvang(null)).toBeNull()
  })
  it('afrekening per account: één stil A-account in een volle klasse staat achter (gat 44)', () => {
    const accounts = ['a1', 'a2', 'a3'].map((id) => ({ id, type: 'prospect' as const, klasseCode: 'A' }))
    const act = [{ accountId: 'a1', kanaal: 'bellen', op: '2026-10-02' }, { accountId: 'a2', kanaal: 'bellen', op: '2026-10-05' }, { accountId: 'a2', kanaal: 'bellen', op: '2026-10-09' }, { accountId: 'a3', kanaal: 'mail', op: '2026-10-05' }]
    const r = ritmeAfrekening(accounts, act, { van: '2026-10-01', tot: '2026-10-30' })
    expect(r.map((x) => x.stand)).toEqual(['op schema', 'vooruit', 'achter'])
  })
  it('een kapotte matrix geeft de standaard met een waarschuwing', () => {
    const { matrix, waarschuwingen } = leesMatrix({ prospect: { A: { aantal: -3, periode: 'eeuw' } } }, BELMATRIX_STANDAARD)
    expect(waarschuwingen.length).toBeGreaterThan(0)
    expect(matrix.prospect?.A).toBeUndefined()
    expect(leesMatrix('kapot', BELMATRIX_STANDAARD).matrix).toBe(BELMATRIX_STANDAARD)
  })
})

describe('starterset (gat 8, 41)', () => {
  it('23 regels, elk met een geldige trigger en zonder validatiefout', () => {
    expect(set).toHaveLength(23)
    expect(set.map((r) => r.code)).toEqual(Array.from({ length: 23 }, (_, i) => `SR${String(i + 1).padStart(2, '0')}`))
    for (const r of set) {
      expect(PATRONEN[r.data.trigger.patroon], r.code!).toBeTruthy()
      expect(valideerRegel(r), r.code!).toEqual([])
    }
  })
  it('elke regel vuurt op zijn fixture', () => {
    for (const r of set) {
      const extra: Partial<MotorAccount> = r.code === 'SR01' ? { nbStatus: 'nieuw', aangemaaktOp: dagen(3) } : r.code === 'SR02' ? { nbStatus: 'nieuw', dossierOp: dagen(40) }
        : r.code === 'SR03' ? { faseId: 'gekwalificeerd', laatsteContactOp: null } : r.code === 'SR08' ? { gebeurtenissen: [{ id: 'g', gebeurtenis: 'geen-vervolg', naarFaseId: 'verloren', op: dagen(0.1) }] }
        : r.code === 'SR13' ? { gebeurtenissen: [{ id: 'g', gebeurtenis: 'afspraak-niet-verschenen', naarFaseId: 'in-gesprek', op: dagen(0.1) }] }
        : r.code === 'SR19' ? { nbStatus: 'wachtend' } : r.code === 'SR23' ? { nbStatus: 'in reis' } : r.code === 'SR22' ? { nbStatus: 'nieuw' } : {}
      const a = acc({ ...FIXTURE[r.data.trigger.patroon as Patroon], ...extra, ownerWerkplek: r.data.gevolg.uitvoerderrol === 'buitendienst' ? 'buitendienst' : 'binnendienst' })
      expect(ruleTargetsAccount(r, a, NU) && evaluateTrigger(r, a, NU).vuurt, r.code!).toBe(true)
    }
  })
  it('een ingevulde belmatrix levert zonder losse ritmeregel taken; 0 is bewust uit', () => {
    const sr04 = regel('SR04')
    const a = acc({ klasseCode: 'C', laatsteContactOp: dagen(10) })
    expect(motorRun(invoer({ regels: [sr04], accounts: [a] })).taken).toHaveLength(1)
    const uit: Matrix = { prospect: { C: { aantal: 0, periode: 'kwartaal' } } }
    expect(motorRun(invoer({ regels: [sr04], accounts: [a], belmatrix: uit })).taken).toHaveLength(0)
    // Niet ingesteld (null) valt terug op de standaard.
    expect(motorRun(invoer({ regels: [sr04], accounts: [a], belmatrix: { prospect: { C: null } } })).taken).toHaveLength(1)
  })
})

describe('motorRun (F15)', () => {
  // 40 prospects in vier klassen, tien per klasse, alle "in reis" bij de binnendienst.
  const veertig = Array.from({ length: 40 }, (_, i) => acc({
    id: `p${i}`, naam: `Testprospect Woningbouw ${String(i + 1).padStart(2, '0')}`, klasseCode: ['A', 'B', 'C', 'D'][i % 4]!,
    laatsteContactOp: i % 2 ? dagen(50) : dagen(5), faseId: 'benaderd',
  }))
  it('levert precies de verwachte taken; een tweede run direct erna levert niets', () => {
    const regels = [regel('SR04'), regel('SR06')]
    const eerste = motorRun(invoer({ regels, accounts: veertig }))
    // SR04: één belritme per account (alle klassen hebben een standaardritme); SR06: de 20 stille accounts.
    expect(eerste.taken.filter((t) => t.regelId === regel('SR04').id)).toHaveLength(40)
    expect(eerste.taken.filter((t) => t.regelId === regel('SR06').id)).toHaveLength(20)
    const laatst = new Map(eerste.taken.map((t) => [`${t.regelId}|${t.onderwerp}`, NU.toISOString()]))
    const open = new Set(laatst.keys())
    const tweede = motorRun(invoer({ regels, accounts: veertig, laatst, open }))
    expect(tweede.taken).toHaveLength(0)
  })
  it('capaciteit: overschot schuift door en wordt gemeld', () => {
    const veel = Array.from({ length: 41 }, (_, i) => acc({ id: `q${i}`, laatsteContactOp: dagen(50) }))
    const r = motorRun(invoer({ regels: [regel('SR06')], accounts: veel }))
    expect(r.taken).toHaveLength(41)
    expect(r.geschoven).toEqual([{ ownerId: 'u1', aantal: 1, naar: expect.any(String) }])
  })
  it('nooit een tweede ritme op één account', () => {
    const tweedeRitme = { ...regel('SR04'), id: 'extra', code: 'X1', cadansDagen: 0 }
    const r = motorRun(invoer({ regels: [regel('SR04'), tweedeRitme], accounts: [acc({ klasseCode: 'A' })] }))
    expect(r.taken).toHaveLength(1)
    expect(motorRun(invoer({ regels: [regel('SR04')], accounts: [acc({ klasseCode: 'A' })], ritmeVan: new Map([['a1', 'hercontact']]) })).taken).toHaveLength(0)
  })
  it('een Beginner krijgt een motorvoorstel als inzicht, behalve een ritmepoging', () => {
    const beginner = gebruikers.map((g) => (g.id === 'u1' ? { ...g, niveau: 'beginner' } : g))
    const r = motorRun(invoer({ regels: [regel('SR06'), regel('SR04')], accounts: [acc({ laatsteContactOp: dagen(50) })], gebruikers: beginner }))
    expect(r.inzichten.map((i) => i.regelId)).toEqual([regel('SR06').id])
    expect(r.taken.map((t) => t.regelId)).toEqual([regel('SR04').id])
  })
  it('een open inzicht wordt bijgewerkt, niet verdubbeld', () => {
    const sr22 = regel('SR22')
    const a = acc({ faseSinds: dagen(30), verwachtVerblijfDagen: 10, faseId: 'benaderd' })
    const r = motorRun(invoer({ regels: [sr22], accounts: [a], open: new Set([`${sr22.id}|a1:benaderd`]) }))
    expect(r.inzichten).toHaveLength(0)
    expect(r.updates).toHaveLength(1)
  })
  it('startactiviteit bij fase betreden, één keer', () => {
    const a = acc({ reisId: 'r1', gebeurtenissen: [{ id: 'g1', gebeurtenis: 'import', naarFaseId: 'gevonden', op: dagen(0.1) }] })
    const start = new Map([['r1|gevonden', [{ faseId: 'gevonden', naam: 'Dossier controleren', rol: 'alle' as const, actiesoort: 'taak', termijnWerkdagen: 2 }]]])
    const r = motorRun(invoer({ accounts: [a], startactiviteiten: start }))
    expect(r.taken.map((t) => t.title)).toEqual(['Dossier controleren: Testprospect Woningbouw 01'])
    expect(motorRun(invoer({ accounts: [a], startactiviteiten: start, laatst: new Map([[`start|${r.taken[0]!.onderwerp}`, NU.toISOString()]]) })).taken).toHaveLength(0)
  })
  it('leerlus: onder 20 procent acceptatie krijgt de eigenaar "Regel levert vooral ruis"', () => {
    const log = [...Array.from({ length: 9 }, () => ({ status: 'afgewezen', op: dagen(3) })), { status: 'omgezet', op: dagen(3) }, { status: 'genegeerd', op: dagen(2) }]
    expect(regelLevertRuis(log, NU).ruis).toBe(true)
    expect(regelLevertRuis(log.slice(0, 5), NU).ruis).toBe(false)
    const r = motorRun(invoer({ regels: [regel('SR22')], beheerderId: 'u3', regelLog: new Map([[regel('SR22').id, log]]) }))
    expect(r.inzichten.map((i) => i.title)).toEqual(['Regel levert vooral ruis: Te lang in fase'])
  })
  it('droogloop: meer dan 50 taken per persoon vraagt bevestiging', () => {
    const veel = Array.from({ length: 60 }, (_, i) => acc({ id: `d${i}`, laatsteContactOp: dagen(50) }))
    const d = droogloop(regel('SR06'), veel, NU)
    expect(d).toMatchObject({ geraakt: 60, taken: 60, vraagtBevestiging: true })
    expect(droogloop(regel('SR06'), veel.slice(0, 10), NU).vraagtBevestiging).toBe(false)
    expect(droogloop(regel('SR06'), [], NU)).toMatchObject({ geraakt: 0, taken: 0 })
  })
  it('600 accounts en 25 regels in ruim onder 20 seconden', () => {
    const accounts = Array.from({ length: 600 }, (_, i) => acc({ id: `x${i}`, klasseCode: ['A', 'B', 'C', 'D'][i % 4]!, laatsteContactOp: dagen(i % 90), faseSinds: dagen(i % 30), verwachtVerblijfDagen: 10 }))
    const regels = [...set, { ...regel('SR06'), id: 'extra1' }, { ...regel('SR22'), id: 'extra2' }]
    const t = performance.now()
    motorRun(invoer({ regels, accounts }))
    expect(performance.now() - t).toBeLessThan(20_000)
  })
})

describe('Excel (gat 7)', () => {
  it('export gevolgd door import geeft dezelfde regels terug', async () => {
    const wb = new ExcelJS.Workbook()
    const blad = wb.addWorksheet('Regels')
    blad.addRow(REGEL_KOLOMMEN.map((k) => k.kop))
    for (const r of set) blad.addRow(REGEL_KOLOMMEN.map((k) => String(k.uit(r))))
    const buffer = await wb.xlsx.writeBuffer()
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buffer as any)
    const rijen: string[][] = []
    wb2.getWorksheet('Regels')!.eachRow((row) => { rijen.push((row.values as any[]).slice(1).map((v) => (v == null ? '' : String(v)))) })
    const terug = rijen.slice(1).map((c) => regelUitRij(rijen[0]!, c))
    expect(terug.every((t) => t.fouten.length === 0)).toBe(true)
    for (const [i, t] of terug.entries()) {
      const r = set[i]!
      expect(t.regel.naam).toBe(r.naam)
      expect(t.regel.data.trigger).toEqual(r.data.trigger)
      expect(t.regel.data.gevolg).toEqual(r.data.gevolg)
      expect(t.regel.cadansDagen).toBe(r.cadansDagen)
      for (const k of ['accounttypes', 'statussen', 'faseIds', 'klassen'] as const) expect(t.regel.data.afbakening[k] ?? []).toEqual(r.data.afbakening[k] ?? [])
    }
  })
  it('een onbekende waarde geeft een fout op die rij', () => {
    const koppen = REGEL_KOLOMMEN.map((k) => k.kop)
    const cellen = REGEL_KOLOMMEN.map((k) => String(k.uit(set[0]!)))
    cellen[koppen.indexOf('actiesoort')] = 'faxen'
    expect(regelUitRij(koppen, cellen).fouten).toContain('"faxen" is geen geldige waarde voor actiesoort')
  })
})
