// Accountplannen: weergavestatus (verlopen wordt afgeleid), voortgang, geldigheidslabel, groepering,
// sortering, de controle van de invoer en de functie in de zijbalk (alleen Expert, groep Planning).
import { describe, expect, it } from 'vitest'
import { ACCOUNTPLAN_SECTIES, controleerPlan, dagKort, geldigheidLabel, groepeer, isLeegPlan, sorteerPlannen, voortgang, weergaveStatus } from '../../shared/accountplannen'
import { beschikbaar, functie, startindeling } from '../../shared/functies'
import { zijbalkVoor } from '../../shared/zijbalk'
import type { FunctieRegel, GebruikerContext, OrganisatieContext } from '../../shared/types'

const org: OrganisatieContext = { id: 'org-a', pakket: 'starter', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))
const gebruiker = (niveau: GebruikerContext['niveau']): GebruikerContext => ({ id: 'u1', rol: 'accountmanager', niveau, werkplek: 'binnendienst', teamId: null, verborgen: [] })

describe('weergavestatus', () => {
  it('actueel tot en met de einddatum, daarna verlopen; afgerond blijft afgerond', () => {
    expect(weergaveStatus({ status: 'actueel', geldigTot: '2026-12-31' }, '2026-12-31')).toBe('actueel')
    expect(weergaveStatus({ status: 'actueel', geldigTot: '2026-12-31' }, '2027-01-01')).toBe('verlopen')
    expect(weergaveStatus({ status: 'actueel', geldigTot: null }, '2030-01-01')).toBe('actueel')
    expect(weergaveStatus({ status: 'afgerond', geldigTot: '2020-01-01' }, '2026-10-16')).toBe('afgerond')
  })
  it('groepeert in Actueel en Verlopen en afgerond', () => {
    const g = groepeer([{ id: 'a', status: 'actueel', geldigTot: '2026-12-31' }, { id: 'b', status: 'actueel', geldigTot: '2026-01-31' }, { id: 'c', status: 'afgerond', geldigTot: null }], '2026-10-16')
    expect(g.actueel.map((p) => p.id)).toEqual(['a'])
    expect(g.historie.map((p) => p.id)).toEqual(['b', 'c'])
  })
})

describe('voortgang en labels', () => {
  it('telt geannuleerde taken niet mee; leeg is 0 procent', () => {
    expect(voortgang([])).toEqual({ totaal: 0, klaar: 0, percentage: 0 })
    expect(voortgang([{ status: 'klaar' }, { status: 'open' }, { status: 'bezig' }, { status: 'geannuleerd' }])).toEqual({ totaal: 3, klaar: 1, percentage: 33 })
  })
  it('geldigheid in gewone woorden', () => {
    expect(dagKort('2026-01-01')).toBe('1 jan 2026')
    expect(geldigheidLabel({ geldigVan: '2026-01-01', geldigTot: '2026-12-31' })).toBe('1 jan 2026 t/m 31 dec 2026')
    expect(geldigheidLabel({ geldigVan: '2026-03-05' })).toBe('vanaf 5 mrt 2026')
    expect(geldigheidLabel({ geldigTot: '2026-03-05' })).toBe('tot 5 mrt 2026')
    expect(geldigheidLabel({})).toBe('geen periode vastgelegd')
  })
  it('sorteert op de meest recente geldigheid', () => {
    expect(sorteerPlannen([{ id: 1, geldigVan: '2025-01-01' }, { id: 2, geldigVan: '2027-01-01' }, { id: 3, createdAt: '2026-05-01' }]).map((p) => p.id)).toEqual([2, 3, 1])
  })
  it('zes blokken zonder gedachtestreepjes; leeg plan', () => {
    expect(ACCOUNTPLAN_SECTIES.map((s) => s.sleutel)).toEqual(['klantinformatie', 'doelstellingen', 'kansen', 'bedreigingen', 'strategieen', 'evaluatie'])
    for (const s of ACCOUNTPLAN_SECTIES) expect(/[–—]/.test(`${s.titel} ${s.uitleg}`)).toBe(false)
    expect(isLeegPlan({}, 0)).toBe(true)
    expect(isLeegPlan({ kansen: ' ' }, 0)).toBe(true)
    expect(isLeegPlan({ kansen: 'x' }, 0)).toBe(false)
    expect(isLeegPlan({}, 1)).toBe(false)
  })
})

describe('controleerPlan', () => {
  it('titel verplicht bij aanmaken, niet bij wijzigen', () => {
    expect(controleerPlan({}, true).fouten).toContain('Geef het plan een titel van minstens 3 tekens')
    expect(controleerPlan({ secties: { kansen: 'Groei' } }, false)).toEqual({ patch: { secties: { kansen: 'Groei' } }, fouten: [] })
  })
  it('datums, volgorde, status, onbekende blokken en contactpersonen', () => {
    expect(controleerPlan({ titel: 'Plan 2027', geldigVan: '2027-01-01', geldigTot: '2026-12-31' }, true).fouten).toEqual(['Geldig tot ligt voor Geldig van'])
    expect(controleerPlan({ titel: 'Plan 2027', geldigVan: '1-1-2027' }, true).fouten).toEqual(['Geldig van is geen geldige datum'])
    expect(controleerPlan({ geldigTot: '' }, false).patch).toEqual({ geldigTot: null })
    expect(controleerPlan({ status: 'weg' }, false).fouten).toEqual(['Onbekende status'])
    expect(controleerPlan({ secties: { swot: 'x' } }, false).fouten).toEqual(['Onbekend blok: swot'])
    expect(controleerPlan({ contactIds: ['a', 'a', 'b'] }, false).patch.contactIds).toEqual(['a', 'b'])
    expect(controleerPlan({ titel: '  Accountplan 2027  ', secties: { evaluatie: null } }, true).patch).toEqual({ titel: 'Accountplan 2027', secties: { evaluatie: '' } })
  })
})

describe('functie nav.accountplannen', () => {
  it('alleen voor Expert, in Planning na Campagnes, met helpartikel', () => {
    expect(functie('nav.accountplannen')).toMatchObject({ startNiveau: 'expert', helpartikel: 'accountplannen', zijbalk: { groep: 'Planning', route: '/accountplannen' } })
    expect(beschikbaar('nav.accountplannen', gebruiker('beginner'), org, stand)).toEqual({ ok: false, reden: 'niveau' })
    expect(beschikbaar('nav.accountplannen', gebruiker('gevorderd'), org, stand)).toEqual({ ok: false, reden: 'niveau' })
    expect(beschikbaar('nav.accountplannen', gebruiker('expert'), org, stand).ok).toBe(true)
    const planning = zijbalkVoor(gebruiker('expert'), org, stand).groepen.find((g) => g.naam === 'Planning')!.items.map((i) => i.sleutel)
    expect(planning.indexOf('nav.accountplannen')).toBe(planning.indexOf('nav.campagnes') + 1)
  })
})
