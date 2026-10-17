// Deactiveren in plaats van verwijderen (0064): de motor slaat een gedeactiveerd account over, niemand benadert
// het nog, de lijst toont het standaard niet en alleen eigenaar, salesmanager (eigen team) en beheerder mogen het.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { actiefTellers, filtersNaarQuery, filtersUitQuery, pasFiltersToe, type AccountRij } from '../../shared/accountFilters'
import { overslagen } from '../../shared/campagnes'
import { controleerDeactivering, deactiveerTekst, leesActiefFilter, magDeactiveren } from '../../shared/deactiveren'
import { beschikbaar, functie, startindeling } from '../../shared/functies'
import { motorRun, type MotorGebruiker, type MotorInvoer } from '../../shared/motor'
import { magBenaderen } from '../../shared/nbStatus'
import { droogloop, type MotorAccount, type Regel } from '../../shared/regelPatronen'
import type { GebruikerContext, OrganisatieContext } from '../../shared/types'

const NU = new Date('2026-10-14T08:00:00Z')
const dagen = (n: number) => new Date(NU.getTime() - n * 864e5).toISOString()
const STARTERSET = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/regels-starterset.json'), 'utf8')) as any[]
const set: Regel[] = STARTERSET.map((r, i) => ({ ...r, id: `r${i + 1}`, actief: true, scope: 'organisatie' }))
const sr04 = set.find((r) => r.code === 'SR04')!
const gebruikers: MotorGebruiker[] = [{ id: 'u1', naam: 'Jan Binnen', rol: 'accountmanager', werkplek: 'binnendienst', niveau: 'gevorderd', teamId: 't1' }]
const acc = (p: Partial<MotorAccount> = {}): MotorAccount => ({ id: 'a1', naam: 'Testprospect Deactief 01', type: 'prospect', nbStatus: 'in reis', aangemaaktOp: dagen(20), klasseCode: 'C', laatsteContactOp: dagen(10), ownerId: 'u1', ownerWerkplek: 'binnendienst', ...p })
const invoer = (p: Partial<MotorInvoer>): MotorInvoer => ({ nu: NU, regels: [], accounts: [], gebruikers, laatst: new Map(), open: new Set(), bezetting: new Map(), ritmeVan: new Map(), ...p })

describe('motor en gedeactiveerde accounts', () => {
  it('de motor slaat een gedeactiveerd account over; het actieve account krijgt wel een taak', () => {
    const actief = acc({ id: 'a-actief' })
    const uit = acc({ id: 'a-uit', gedeactiveerd: true })
    const r = motorRun(invoer({ regels: [sr04], accounts: [actief, uit] }))
    expect(r.taken.map((t) => t.accountId)).toEqual(['a-actief'])
    expect(r.inzichten.some((i) => i.accountId === 'a-uit')).toBe(false)
  })
  it('ook de droogloop telt een gedeactiveerd account niet mee', () => {
    const d = droogloop(sr04, [acc({ id: 'a1' }), acc({ id: 'a2', gedeactiveerd: true })], NU)
    expect(d.geraakt).toBe(1)
  })
  it('geen startactiviteiten bij een fasewissel van een gedeactiveerd account', () => {
    const ev = [{ id: 'g1', gebeurtenis: 'handmatig', naarFaseId: 'f2', op: dagen(0.1) }]
    const start = new Map([['reis1|f2', [{ faseId: 'f2', naam: 'Bel kennismaking', rol: 'alle' as const, actiesoort: 'mail', termijnWerkdagen: 1 }]]])
    expect(motorRun(invoer({ accounts: [acc({ reisId: 'reis1', gebeurtenissen: ev })], startactiviteiten: start })).taken).toHaveLength(1)
    expect(motorRun(invoer({ accounts: [acc({ reisId: 'reis1', gebeurtenissen: ev, gedeactiveerd: true })], startactiviteiten: start })).taken).toHaveLength(0)
  })
  it('niemand benadert een gedeactiveerd account, via geen enkel kanaal', () => {
    const a = { nbStatus: 'in reis', data: { gedeactivering: { op: dagen(1) } } }
    for (const k of ['bellen', 'mail', 'linkedin', 'bezoek', 'whatsapp'] as const) expect(magBenaderen(a, k, NU)).toEqual({ mag: false, reden: 'Gedeactiveerd' })
    expect(magBenaderen({ nbStatus: 'in reis', data: {} }, 'bellen', NU).mag).toBe(true)
  })
  it('een campagne slaat een gedeactiveerd account over met een reden', () => {
    const o = overslagen([{ id: 'a1', naam: 'Een', gedeactiveerd: true }, { id: 'a2', naam: 'Twee' }], 'direct', NU)
    expect(o.mee.map((a) => a.id)).toEqual(['a2'])
    expect(o.over[0]).toMatchObject({ reden: 'is gedeactiveerd' })
  })
})

describe('deactiveren: reden en rechten', () => {
  it('een reden uit de vaste lijst is verplicht; bij Overig ook een toelichting', () => {
    expect(controleerDeactivering({})).toBe('Kies een reden om te deactiveren')
    expect(controleerDeactivering({ reden: 'weg' })).toBe('Kies een reden om te deactiveren')
    expect(controleerDeactivering({ reden: 'overig', toelichting: '  ' })).toBe('Geef een toelichting bij Overig')
    expect(controleerDeactivering({ reden: 'dubbel' })).toEqual({ reden: 'dubbel' })
    expect(controleerDeactivering({ reden: 'overig', toelichting: ' Verhuisd naar het buitenland ' })).toEqual({ reden: 'overig', toelichting: 'Verhuisd naar het buitenland' })
  })
  it('eigenaar, salesmanager van het team en beheerder mogen het; een collega niet', () => {
    const a = { ownerId: 'u1', ownerTeamId: 't1' }
    expect(magDeactiveren({ id: 'u1', rol: 'accountmanager' }, a)).toBe(true)
    expect(magDeactiveren({ id: 'u2', rol: 'accountmanager' }, a)).toBe(false)
    expect(magDeactiveren({ id: 'sm', rol: 'salesmanager' }, a, ['t1'])).toBe(true)
    expect(magDeactiveren({ id: 'sm', rol: 'salesmanager' }, a, ['t2'])).toBe(false)
    expect(magDeactiveren({ id: 'b', rol: 'beheerder' }, a)).toBe(true)
  })
  it('de balk noemt datum, wie en de reden', () => {
    expect(deactiveerTekst({ op: '2026-10-03T10:00:00Z', reden: 'dubbel' }, 'Eva Ervaren')).toBe('Gedeactiveerd op 3 oktober 2026 door Eva Ervaren, reden Dubbel account')
    expect(deactiveerTekst({ op: '2026-10-03T10:00:00Z', reden: 'overig', toelichting: 'Verhuisd' }, null)).toBe('Gedeactiveerd op 3 oktober 2026, reden Overig: Verhuisd')
  })
  it('Deactiveren staat voor elk niveau aan; verwijderen bestaat niet meer', () => {
    expect(functie('prospects.verwijderen')).toBeUndefined()
    const org: OrganisatieContext = { id: 'o', pakket: 'starter', features: {}, iedereenAlles: false }
    const stand = startindeling().map((r) => ({ ...r, organisationId: null }))
    const g = (niveau: GebruikerContext['niveau']): GebruikerContext => ({ id: 'u1', rol: 'accountmanager', niveau, werkplek: 'binnendienst', teamId: null, verborgen: [] })
    for (const n of ['beginner', 'gevorderd', 'expert'] as const) {
      expect(beschikbaar('prospects.deactiveren', g(n), org, stand).ok).toBe(true)
      // De motor voor iedereen: regels met droogloop, matrix, ritme, terugkomregels en de prospectplanning.
      for (const s of ['regels.lezen', 'regels.persoonlijk', 'ritme.lezen', 'matrix.klasseZetten', 'matrix.voorstellen', 'terugkomen.lezen', 'nav.planning', 'planning.jaar']) expect(beschikbaar(s, g(n), org, stand).ok, `${s} ${n}`).toBe(true)
      // Organisatiebreed wijzigen blijft bij de beheerder.
      expect(beschikbaar('matrix.beheer', g(n), org, stand).ok).toBe(false)
      expect(beschikbaar('regels.beheer', g(n), org, stand).ok).toBe(false)
    }
  })
})

describe('lijst: filter Status', () => {
  const rij = (id: string, gedeactiveerd = false): AccountRij => ({ id, name: `Testprospect ${id}`, klasse: null, ownerId: 'u1', nbStatus: 'in reis', score: 50, laatsteContactOp: null, contacten: [], cf: {}, gedeactiveerd })
  const rijen = [rij('a'), rij('b'), rij('c', true)]
  const ctx = { gebruikerId: 'u1', teamIds: [], nu: NU }
  it('standaard alleen actieve accounts; gedeactiveerd en alle op verzoek', () => {
    expect(pasFiltersToe(rijen, filtersUitQuery({}), ctx).map((r) => r.id)).toEqual(['a', 'b'])
    expect(pasFiltersToe(rijen, filtersUitQuery({ actief: 'gedeactiveerd' }), ctx).map((r) => r.id)).toEqual(['c'])
    expect(pasFiltersToe(rijen, filtersUitQuery({ actief: 'alle' }), ctx)).toHaveLength(3)
    expect(actiefTellers(rijen, filtersUitQuery({}), ctx)).toEqual({ actief: 2, gedeactiveerd: 1, alle: 3 })
    expect(leesActiefFilter('onzin')).toBe('actief')
    expect(filtersNaarQuery(filtersUitQuery({ actief: 'alle' }))).toMatchObject({ actief: 'alle' })
    expect(filtersNaarQuery(filtersUitQuery({}))).not.toHaveProperty('actief')
  })
})
