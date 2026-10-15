import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { valideerSchema, voerAiKern, type AiProvider, type JsonSchema } from '../../shared/aiStap'
import { AI_SOORTEN, CREDITS_OP_TEKST, agentMagAi, creditsStand, creditsVoor, magVragen } from '../../shared/credits'
import { nlMoment } from '../../shared/datum'
import { AGENTS, EXECUTOR_STATUSSEN, effectiefMandaat, gaatNaarMens, magHandelen, mandaatFout, mandaatOpties, maskeerPrive, organisatieMaximum } from '../../shared/mandaat'
import { motorRun, verdeelCapaciteit, type MotorGebruiker, type MotorInvoer } from '../../shared/motor'
import { bewaakTaken, planPoging } from '../../shared/planner'
import type { MotorAccount } from '../../shared/regelPatronen'
import { controleerBron } from '../../tools/checks/agents'

const NU = new Date('2026-10-14T08:00:00Z') // woensdag 10:00 in Nederland
const ZATERDAG = new Date('2026-10-17T10:00:00Z')
const dagen = (n: number) => new Date(NU.getTime() - n * 864e5).toISOString()
const nee = (reden: string, opDagenGeleden: number, afkoeling: Record<string, number>) => ({ reden, op: dagen(opDagenGeleden), afkoeling })

describe('effectiefMandaat (11.3)', () => {
  it('Beginner met de Verzender krijgt C, ook als de organisatie B toestaat', () => {
    expect(effectiefMandaat('verzender', { organisatie: 'B', niveau: 'beginner' })).toBe('C')
    expect(effectiefMandaat('verzender', { organisatie: 'B', niveau: 'gevorderd' })).toBe('B')
  })
  it('gepauzeerd zet B naar C; A naar buiten ook; A binnen blijft A', () => {
    expect(effectiefMandaat('verzender', { niveau: 'expert', gepauzeerd: true })).toBe('C')
    expect(effectiefMandaat('schrijver', { niveau: 'expert', gepauzeerd: true, naarBuiten: true })).toBe('C')
    expect(effectiefMandaat('planner', { niveau: 'expert', gepauzeerd: true })).toBe('A')
  })
  it('D blijft D; een eigen mandaat boven de organisatie wordt afgekapt', () => {
    expect(effectiefMandaat('verzender', { organisatie: 'D', niveau: 'expert', eigen: 'B' })).toBe('D')
    expect(effectiefMandaat('verzender', { organisatie: 'C', niveau: 'expert', eigen: 'A' })).toBe('C')
    // Een eigen mandaat telt alleen voor een Expert.
    expect(effectiefMandaat('verzender', { organisatie: 'B', niveau: 'gevorderd', eigen: 'C' })).toBe('B')
    expect(effectiefMandaat('verzender', { organisatie: 'B', niveau: 'expert', eigen: 'C' })).toBe('C')
  })
  it('platformmaximum gaat boven alles', () => {
    expect(effectiefMandaat('zoeker', { platform: 'C', niveau: 'expert' })).toBe('C')
    expect(organisatieMaximum('verzender', 'D')).toBe('D')
    expect(mandaatOpties('B')).toEqual(['B', 'C', 'D'])
  })
  it('mandaatFout: boven het maximum, de Bewaker en onzin', () => {
    expect(mandaatFout('verzender', 'A', 'B')).toContain('Hoger dan het maximum')
    expect(mandaatFout('verzender', 'C', 'B')).toBeNull()
    expect(mandaatFout('bewaker', 'C', 'A')).toContain('altijd aan')
    expect(mandaatFout('verzender', 'X', 'B')).toBe('Kies A, B, C of D')
  })
  it('mandaatniveaus en agents staan één keer in shared (gat 16)', () => {
    expect(AGENTS.map((a) => a.sleutel)).toHaveLength(new Set(AGENTS.map((a) => a.sleutel)).size)
    expect(AGENTS.filter((a) => a.gebouwd).map((a) => a.sleutel).sort()).toEqual(['bewaker', 'planner'])
  })
})

describe('magHandelen: de Bewaker', () => {
  const afkoeling = { nbStatus: 'nee', data: { nee: nee('Geen behoefte', 10, { mail: 60, bellen: 90 }) as any } }
  it('afkoelperiode mail: geblokkeerd met datum; precies op de grens mag het weer', () => {
    const r = magHandelen('verzender', 'mail.versturen', NU, { mandaat: 'B', kanaal: 'mail', account: afkoeling, binnenKader: true, naarBuiten: true })
    expect(r).toMatchObject({ mag: false, uitvoering: 'geblokkeerd' })
    expect(r.reden).toMatch(/^Afkoelperiode mail tot \d+ december$/)
    const grens = new Date(Date.parse(dagen(10).slice(0, 10)) + 60 * 864e5 + 9 * 3600e3)
    expect(magHandelen('planner', 'x', new Date(grens.getTime() - 864e5), { mandaat: 'A', kanaal: 'mail', account: afkoeling }).mag).toBe(false)
    expect(magHandelen('planner', 'x', grens, { mandaat: 'A', kanaal: 'mail', account: afkoeling }).mag).toBe(true)
  })
  it('geen consent voor WhatsApp', () => {
    const r = magHandelen('berichtgever', 'bericht', NU, { mandaat: 'C', kanaal: 'whatsapp', account: { nbStatus: 'in reis' }, contact: { consent: { whatsapp: { status: 'onbekend' } } } })
    expect(r.reden).toBe('Geen consent voor WhatsApp')
  })
  it('buiten het ritme, capaciteit vol, credits en dagplafond', () => {
    expect(magHandelen('planner', 'x', NU, { mandaat: 'A', anderRitme: true }).reden).toBe('Het account zit al in een ander ritme')
    expect(magHandelen('planner', 'x', NU, { mandaat: 'A', capaciteitVol: true }).reden).toBe('Capaciteit van vandaag is vol')
    expect(magHandelen('verrijker', 'x', NU, { mandaat: 'A', ai: { mag: false, reden: 'Minder dan 10 procent AI-credits over' } }).reden).toBe('Minder dan 10 procent AI-credits over')
    expect(magHandelen('verzender', 'x', NU, { mandaat: 'B', dagplafondBereikt: true }).reden).toBe('Dagplafond bereikt')
  })
  it('buiten werkuren (zaterdag) voor een handeling naar buiten; plannen mag wel', () => {
    expect(magHandelen('verzender', 'x', ZATERDAG, { mandaat: 'B', kanaal: 'mail', account: { nbStatus: 'in reis' }, binnenKader: true, naarBuiten: true }).reden).toBe('Buiten werkuren')
    expect(magHandelen('planner', 'x', ZATERDAG, { mandaat: 'A', kanaal: 'bellen', account: { nbStatus: 'in reis' } }).mag).toBe(true)
  })
  it('mandaat D: altijd mens; C: concept; B alleen binnen een kader en nooit de eerste mail of een beslisser', () => {
    const basis = { kanaal: 'mail' as const, account: { nbStatus: 'in reis' }, naarBuiten: true }
    expect(magHandelen('verzender', 'x', NU, { ...basis, mandaat: 'D' }).uitvoering).toBe('als_taak_mens')
    expect(magHandelen('verzender', 'x', NU, { ...basis, mandaat: 'C' }).uitvoering).toBe('als_taak_concept')
    expect(magHandelen('verzender', 'x', NU, { ...basis, mandaat: 'B' }).uitvoering).toBe('als_taak_concept')
    expect(magHandelen('verzender', 'x', NU, { ...basis, mandaat: 'B', binnenKader: true }).uitvoering).toBe('direct')
    expect(magHandelen('verzender', 'x', NU, { ...basis, mandaat: 'B', binnenKader: true, eersteBericht: true }).uitvoering).toBe('als_taak_concept')
    expect(magHandelen('verzender', 'x', NU, { ...basis, mandaat: 'B', binnenKader: true, contact: { rol: 'beslisser' } }).uitvoering).toBe('als_taak_concept')
  })
  it('credits en dagplafond gaan als taak naar de mens; afkoeling niet', () => {
    expect(gaatNaarMens('Minder dan 10 procent AI-credits over')).toBe(true)
    expect(gaatNaarMens('Dagplafond bereikt')).toBe(true)
    expect(gaatNaarMens('Afkoelperiode mail tot 3 december')).toBe(false)
  })
})

describe('AI-credits (11.4)', () => {
  const stand = (verbruikt: number, pot = 1000) => creditsStand({ pakket: 'plus', gebruikers: 1, vastePot: pot, verbruikt })
  it('creditsVoor: de tabel, lange vragen 2 tot 5, transcriptie per begonnen minuut', () => {
    expect(creditsVoor('belscript')).toBe(1)
    expect(creditsVoor('zoekronde')).toBe(20)
    expect(creditsVoor('assistentUitgebreid', { tekens: 9000 })).toBe(5)
    expect(creditsVoor('transcriptie', { seconden: 61 })).toBe(2)
    expect(AI_SOORTEN.every((s) => creditsVoor(s) > 0)).toBe(true)
  })
  it('pot: gebruikers maal pakketbedrag plus extra; let op vanaf 80 procent', () => {
    const s = creditsStand({ pakket: 'starter', gebruikers: 3, extra: 50, verbruikt: 520 })
    expect(s).toMatchObject({ pot: 650, over: 130, letOp: true, op: false })
  })
  it('pot op 0 geeft 402 met de vaste melding; Starter heeft geen belscript-invulling', () => {
    expect(magVragen(stand(0, 0), 'assistent', 'plus')).toEqual({ mag: false, status: 402, reden: CREDITS_OP_TEKST })
    expect(magVragen(stand(0), 'belscript', 'starter')).toMatchObject({ mag: false, status: 403 })
    expect(magVragen(stand(0), 'belscript', 'plus').mag).toBe(true)
  })
  it('agents stoppen bij 10 procent van de pot', () => {
    expect(agentMagAi(stand(890), 'inzichtBeoordeling', 'plus', null, 0).mag).toBe(true) // 11 procent over
    expect(agentMagAi(stand(900), 'inzichtBeoordeling', 'plus', null, 0)).toEqual({ mag: false, reden: 'Minder dan 10 procent AI-credits over' }) // precies 10
    expect(agentMagAi(stand(901), 'inzichtBeoordeling', 'plus', null, 0).mag).toBe(false) // 9,9
    expect(agentMagAi(stand(1000), 'inzichtBeoordeling', 'plus', null, 0).reden).toContain('AI-credits')
  })
  it('dagplafond per AI-soort en soort niet in het pakket', () => {
    expect(agentMagAi(stand(0), 'concept', 'plus', 10, 9).reden).toBe('Dagplafond voor concept (pitstop, boodschap) bereikt')
    expect(agentMagAi(stand(0), 'concept', 'plus', 10, 8).mag).toBe(true)
    expect(agentMagAi(stand(0), 'dossier', 'plus', null, 0).reden).toBe('Dossier zit niet in je pakket')
  })
})

describe('de Planner', () => {
  const ritme = { stappen: [{ volgnummer: 1, dagOffset: 0, kanaal: 'bellen' as const }, { volgnummer: 2, dagOffset: 3, kanaal: 'mail' as const }] }
  const stand = (stap: number, extra = {}) => ({ ritmeId: 'r1', stap, gestartOp: dagen(5), volgendeOp: dagen(0.1), kanaal: null, actief: true, geschiedenis: [], ...extra })
  it('planPoging: volgende stap, laatste stap gedaan, nog niet aan de beurt', () => {
    expect(planPoging(stand(2), ritme, NU).voorstel).toMatchObject({ n: 2, van: 2, kanaal: 'mail', actionType: 'mailen' })
    expect(planPoging(stand(3), ritme, NU).reden).toBe('Laatste stap gedaan')
    expect(planPoging(stand(1, { volgendeOp: new Date(NU.getTime() + 864e5).toISOString() }), ritme, NU).reden).toBe('Nog niet aan de beurt')
  })
  it('planPoging: account in afkoeling krijgt geen poging', () => {
    const r = planPoging(stand(1), ritme, NU, { nbStatus: 'nee', nee: nee('Geen behoefte', 10, { bellen: 90 }), belMeNiet: false })
    expect(r.voorstel).toBeNull()
    expect(r.reden).toMatch(/^Afkoelperiode bellen tot/)
  })
  it('bewaakTaken: een belpoging voor een account in afkoeling wordt tegengehouden; landen na de afkoeling mag', () => {
    const accounts = new Map([['a1', { nbStatus: 'nee', nee: nee('Geen behoefte', 10, { bellen: 90 }), belMeNiet: false }], ['a2', { nbStatus: 'in reis', belMeNiet: false }]])
    const taken = [
      { accountId: 'a1', ownerId: 'u1', actionType: 'bellen', regelId: 'r1', due: NU.toISOString() },
      { accountId: 'a1', ownerId: 'u1', actionType: 'taak', due: NU.toISOString() },
      { accountId: 'a2', ownerId: 'u1', actionType: 'bellen', due: NU.toISOString() },
      { accountId: 'a1', ownerId: 'u1', actionType: 'bellen', due: new Date(NU.getTime() + 100 * 864e5).toISOString() },
    ]
    const r = bewaakTaken(taken, accounts as any, NU)
    expect(r.toegestaan).toHaveLength(3)
    expect(r.tegengehouden).toEqual([expect.objectContaining({ agent: 'planner', accountId: 'a1', mandaat: 'A', reden: expect.stringMatching(/^Afkoelperiode bellen tot/) })])
  })
  it('dagplafond van 40: 45 beltaken geven 40 vandaag en 5 op de volgende werkdag', () => {
    const g: MotorGebruiker[] = [{ id: 'u1', naam: 'Jan', rol: 'accountmanager', werkplek: 'binnendienst', niveau: 'gevorderd', teamId: null }]
    const taken = Array.from({ length: 45 }, () => ({ ownerId: 'u1', due: NU.toISOString(), actionType: 'bellen' }))
    const r = verdeelCapaciteit(taken, g)
    const per = new Map<string, number>()
    for (const t of r.geland) { const d = nlMoment(new Date(t.due)).datum; per.set(d, (per.get(d) ?? 0) + 1) }
    expect([...per.values()]).toEqual([40, 5])
    expect([...per.keys()][1]).toBe('2026-10-15')
  })
  it('motorRun: de Bewaker houdt een belpoging tegen die de regels niet afvingen en het staat in het verslag', () => {
    // Een startactiviteit "bellen" bij het betreden van een fase, voor een contact op bel-me-niet.
    const acc: MotorAccount = { id: 'a1', naam: 'Installatiebedrijf Rietkraag BV', type: 'prospect', nbStatus: 'in reis', reisId: 'reis1', aangemaaktOp: dagen(20), ownerId: 'u1', ownerWerkplek: 'binnendienst',
      gebeurtenissen: [{ id: 'g1', gebeurtenis: 'gekwalificeerd', naarFaseId: 'gekwalificeerd', op: dagen(0.1) }] } as any
    const inv: MotorInvoer = { nu: NU, regels: [], accounts: [acc], gebruikers: [{ id: 'u1', naam: 'Jan', rol: 'accountmanager', werkplek: 'binnendienst', niveau: 'gevorderd', teamId: null }], laatst: new Map(), open: new Set(), bezetting: new Map(), ritmeVan: new Map(),
      startactiviteiten: new Map([['reis1|gekwalificeerd', [{ faseId: 'gekwalificeerd', naam: 'Eerste belpoging', rol: 'alle', actiesoort: 'bellen', termijnWerkdagen: 0 }]]]) }
    expect(motorRun(inv).taken).toHaveLength(1)
    const uit = motorRun({ ...inv, accounts: [{ ...acc, belMeNiet: true }] })
    expect(uit.taken).toHaveLength(0)
    expect(uit.tegengehouden).toEqual([expect.objectContaining({ agent: 'planner', accountId: 'a1', reden: 'Staat op bel-me-niet' })])
    expect(uit.stappen.find((s) => s.stap === 'bewaker')?.toelichting).toBe('1 tegengehouden')
  })
})

describe('privégegevens en de AI-schil (golden master)', () => {
  const schema: JsonSchema = { type: 'object', required: ['samenvatting', 'punten'], additionalProperties: false, properties: { samenvatting: { type: 'string' }, punten: { type: 'array', items: { type: 'string' } } } }
  const materiaal = { naam: 'Testprospect Woningbouw 01', priveMobiel: '06 12345678', telefoon: '038 123 45 67', notitie: 'Bel privé 06-98765432 of mail jan@gmail.com; zakelijk jan@voltvast.test', contact: { priveEmail: 'x@hotmail.com', email: 'inkoop@woningbouw.test' } }
  it('maskeerPrive: privémobiel en privémail weg, zakelijk blijft', () => {
    const m = maskeerPrive(materiaal) as any
    expect(m.priveMobiel).toBeUndefined()
    expect(m.contact.priveEmail).toBeUndefined()
    expect(m.telefoon).toBe('038 123 45 67')
    expect(m.notitie).toBe('Bel privé [privémobiel] of mail [privémail]; zakelijk jan@voltvast.test')
    expect(m.contact.email).toBe('inkoop@woningbouw.test')
  })
  it('valideerSchema: verplicht, extra velden, soorten', () => {
    expect(valideerSchema(schema, { samenvatting: 'x', punten: ['a'] })).toEqual([])
    expect(valideerSchema(schema, { samenvatting: 'x' })).toEqual(['antwoord.punten ontbreekt'])
    expect(valideerSchema(schema, { samenvatting: 1, punten: [2], extra: true })).toEqual(['antwoord.samenvatting is geen tekst', 'antwoord.punten[0] is geen tekst', 'antwoord.extra is niet toegestaan'])
  })
  it('één keer opnieuw bij een ongeldig antwoord; de provider kreeg alleen gemaskeerd materiaal', async () => {
    const gezien: unknown[] = []
    const antwoorden = [{ samenvatting: 'x' }, { samenvatting: 'Kort', punten: ['Een'] }]
    const provider: AiProvider = async ({ materiaal: m }) => { gezien.push(m); return antwoorden.shift() }
    const r = await voerAiKern(provider, { soort: 'brief', prompt: 'Vat samen', schema, materiaal })
    expect(r).toMatchObject({ ok: true, pogingen: 2, antwoord: { samenvatting: 'Kort', punten: ['Een'] }, fouten: ['Poging 1: antwoord.punten ontbreekt'] })
    expect(JSON.stringify(gezien)).not.toMatch(/12345678|98765432|gmail|hotmail/)
  })
  it('twee keer ongeldig of een fout: geen antwoord', async () => {
    const r = await voerAiKern(async () => ({ onzin: true }), { soort: 'brief', prompt: '', schema, materiaal: {} })
    expect(r.ok).toBe(false)
    expect(r.antwoord).toBeUndefined()
    expect(r.fouten).toHaveLength(2)
    const f = await voerAiKern(async () => { throw new Error('time-out') }, { soort: 'brief', prompt: '', schema, materiaal: {} })
    expect(f).toMatchObject({ ok: false, pogingen: 2, fouten: ['Poging 1: time-out', 'Poging 2: time-out'] })
  })
})

describe('bouwchecks (gat 22, Bewaker)', () => {
  it('elke executor_status heeft precies één schrijver in de servercode', () => {
    for (const s of EXECUTOR_STATUSSEN) {
      const treffers = execSync(`grep -rlE "executorStatus: '${s}'|'${s}' : null|, '${s}', " server || true`, { cwd: join(import.meta.dirname, '../..') }).toString().trim().split('\n').filter(Boolean)
      expect(treffers.length, `schrijver voor ${s}`).toBeGreaterThanOrEqual(1)
    }
  })
  it('check:agents vindt een schrijfactie zonder toets', () => {
    const goed = `export async function doe(tx) {\n  const b = await toets(tx)\n  await tx.insert(schema.tasks).values({})\n}\n`
    const fout = `export async function doe(tx) {\n  await tx.insert(schema.tasks).values({})\n}\n`
    const hulp = `async function schrijf(tx) {\n  await tx.update(schema.accounts).set({})\n}\nexport async function a(tx) {\n  await schrijf(tx)\n}\n`
    const log = `export async function log(tx) {\n  await tx.insert(schema.agentRuns).values({})\n}\n`
    expect(controleerBron('goed.ts', goed)).toEqual([])
    expect(controleerBron('fout.ts', fout)).toEqual(['fout.ts: doe schrijft zonder voorafgaande toets van de Bewaker'])
    expect(controleerBron('hulp.ts', hulp)).toEqual(['hulp.ts: a roept schrijf aan zonder voorafgaande toets van de Bewaker'])
    expect(controleerBron('log.ts', log)).toEqual([])
  })
})
