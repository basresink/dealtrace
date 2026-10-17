// Accountplannen: weergavestatus (verlopen wordt afgeleid), voortgang, geldigheidslabel, groepering,
// sortering, de controle van de invoer en de functie in de zijbalk (alleen Expert, groep Planning).
import { describe, expect, it } from 'vitest'
import { ACCOUNTPLAN_SECTIES, INHOUD_BLOKKEN, PLAN_FILTERS, SECTIE_SLEUTELS, VOORZET_DOELEN, afrondVraag, bestaandPlanWaarschuwing, controleerActie, controleerNotitie, controleerPlan, dagKort, filterPlannen, geldigheidLabel, groepeer, isLeegPlan, metHoofdletter, schoonVoorzet, sorteerPlannen, voortgang, weergaveStatus } from '../../shared/accountplannen'
import { VELD_OBJECTEN } from '../../shared/eigenVelden'
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

describe('aanmaken in één keer (opzet DealDrive)', () => {
  it('zes stappen dekken elk blok precies één keer; stap 5 is het actieplan', () => {
    expect(INHOUD_BLOKKEN.map((b) => b.nr)).toEqual([1, 2, 3, 4, 5, 6])
    expect(INHOUD_BLOKKEN.flatMap((b) => b.velden).sort()).toEqual([...SECTIE_SLEUTELS].sort())
    expect(INHOUD_BLOKKEN.find((b) => b.nr === 5)!.velden).toEqual([])
    expect(INHOUD_BLOKKEN.find((b) => b.nr === 3)!.velden).toEqual(['kansen', 'bedreigingen'])
    expect(ACCOUNTPLAN_SECTIES.map((s) => s.titel).slice(0, 2)).toEqual(['Klantinformatie', 'Doelstellingen (SMART)'])
    for (const b of INHOUD_BLOKKEN) expect(/[\u2013\u2014]/.test(`${b.titel} ${b.toelichting}`)).toBe(false)
  })
  it('acties, eigenaar en eigen velden in de invoer; acties alleen bij aanmaken', () => {
    expect(controleerActie({ titel: '  Bel de directeur  ', datum: '2027-01-12', contactId: 'c1' })).toEqual({ actie: { titel: 'Bel de directeur', datum: '2027-01-12', contactId: 'c1' }, fout: null })
    expect(controleerActie({ titel: 'Bel', datum: '' }).actie).toEqual({ titel: 'Bel', datum: null, contactId: null })
    expect(controleerActie({ titel: 'x' }).fout).toBe('Geef elke actie een titel van minstens 3 tekens')
    expect(controleerActie({ titel: 'Bellen', datum: '12-01-2027' }).fout).toContain('ongeldig')
    const c = controleerPlan({ titel: 'Plan 2027', eigenaarId: 'u-07', velden: { budget: 10 }, acties: [{ titel: 'Eerste gesprek' }] }, true)
    expect(c.fouten).toEqual([])
    expect(c.patch).toMatchObject({ eigenaarId: 'u-07', velden: { budget: 10 }, acties: [{ titel: 'Eerste gesprek', datum: null, contactId: null }] })
    expect(controleerPlan({ acties: [] }, false).fouten).toEqual(['Acties voeg je los toe aan een bestaand plan'])
    expect(controleerPlan({ velden: [] }, false).fouten).toEqual(['Eigen velden zijn ongeldig'])
    expect(controleerPlan({ eigenaarId: '' }, false).patch).toEqual({})
  })
  it('notities, afronden zonder evaluatie, een tweede actueel plan en het label met hoofdletter', () => {
    expect(controleerNotitie('  Let op de budgetronde  ')).toEqual({ tekst: 'Let op de budgetronde', fout: null })
    expect(controleerNotitie('  ').fout).toBe('Schrijf eerst een notitie')
    expect(afrondVraag({ status: 'actueel', secties: {} })).toContain('evaluatie is nog leeg')
    expect(afrondVraag({ status: 'actueel', secties: { evaluatie: 'Doel gehaald' } })).toBeNull()
    expect(afrondVraag({ status: 'afgerond', secties: {} })).toBeNull()
    expect(bestaandPlanWaarschuwing('Testvloer Houten', 0)).toBeNull()
    expect(bestaandPlanWaarschuwing('Testvloer Houten', 1)).toContain('Testvloer Houten heeft al een actueel accountplan')
    expect(metHoofdletter(geldigheidLabel({}))).toBe('Geen periode vastgelegd')
  })
  it('statusfilter op het overzicht', () => {
    const lijst = [{ id: 'a', weergave: 'actueel' }, { id: 'b', weergave: 'verlopen' }, { id: 'c', weergave: 'afgerond' }]
    expect(PLAN_FILTERS.map((f) => f.id)).toEqual(['alle', 'actueel', 'verlopen', 'afgerond'])
    expect(filterPlannen(lijst, 'alle')).toHaveLength(3)
    expect(filterPlannen(lijst, 'verlopen').map((p) => p.id)).toEqual(['b'])
  })
  it('AI-voorzet: geen gedachtestreepjes, acties alleen voor het actieplan, begrensd', () => {
    expect(VOORZET_DOELEN).toContain('actieplan')
    expect(schoonVoorzet({ tekst: 'Groei \u2014 nieuwbouw', acties: [{ titel: 'Bel', dagen: 3 }], vragen: [] }, 'kansen')).toEqual({ tekst: 'Groei: nieuwbouw', acties: [], vragen: [] })
    const a = schoonVoorzet({ tekst: 'x', acties: [{ titel: 'Plan het gesprek', dagen: 0 }, { titel: 'ab', dagen: 4 }, { titel: 'Stuur samenvatting', dagen: 900 }], vragen: ['Wie beslist?', '', 'a', 'b', 'c'] }, 'actieplan')
    expect(a.tekst).toBe('')
    expect(a.acties).toEqual([{ titel: 'Plan het gesprek', dagen: 1 }, { titel: 'Stuur samenvatting', dagen: 365 }])
    expect(a.vragen).toHaveLength(3)
  })
  it('eigen velden kennen het object accountplan', () => {
    expect(VELD_OBJECTEN).toContain('accountplan')
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
