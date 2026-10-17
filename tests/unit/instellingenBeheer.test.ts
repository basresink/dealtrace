// Pakket D (Instellingen): de stand per kaart in woorden, het leesoverzicht functies per niveau en wie mag
// wat, de audit (soorten, teksten, CSV en cursor) en de Zoeker die al draait.
import { describe, expect, it } from 'vitest'
import { AUDIT_SOORTEN, actieTekst, auditCsv, auditCursor, csvVeld, leesCursor, type AuditRegel } from '../../shared/audit'
import { startindeling } from '../../shared/functies'
import { NIET_INGERICHT, aantal, koppelingenTekst, vanTotaal, zin } from '../../shared/instellingenStand'
import { agentDef } from '../../shared/mandaat'
import { groepNaam, niveauOverzicht, rechtTekst, wieMagWat } from '../../shared/niveauOverzicht'
import type { FunctieRegel, OrganisatieContext } from '../../shared/types'

const org: OrganisatieContext = { id: 'org-a', pakket: 'starter', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))

describe('stand in woorden', () => {
  it('telt met enkelvoud en meervoud, en zegt Nog niet ingericht zonder iets', () => {
    expect(aantal(1, 'regel', 'regels')).toBe('1 regel')
    expect(aantal(23, 'regel', 'regels')).toBe('23 regels')
    expect(aantal(0, 'regel', 'regels', 'Nog geen regels')).toBe('Nog geen regels')
    expect(vanTotaal(3, 5, 'koppelingen', 'actief')).toBe('3 van 5 koppelingen actief')
    expect(vanTotaal(0, 0, 'sjablonen', 'aan')).toBe(NIET_INGERICHT)
    expect(zin('23 regels', null, '20 door de motor')).toBe('23 regels, 20 door de motor')
    expect(aantal(10500, 'credit', 'credits')).toBe('10.500 credits')
  })
  it('koppelingen: actief geteld over wat de kijker ziet', () => {
    expect(koppelingenTekst([{ sleutel: 'a', naam: 'A', actief: true }, { sleutel: 'b', naam: 'B', actief: false }, { sleutel: 'c', naam: 'C', actief: true }])).toBe('2 van 3 koppelingen actief')
    expect(koppelingenTekst([])).toBe(NIET_INGERICHT)
  })
})

describe('functies per niveau', () => {
  it('telt per niveau wat een accountmanager heeft; Expert heeft het meest', () => {
    const o = niveauOverzicht(org, stand)
    expect(o.tellingen.beginner).toBeLessThan(o.tellingen.gevorderd)
    expect(o.tellingen.gevorderd).toBeLessThanOrEqual(o.tellingen.expert)
    expect(o.tellingen.expert).toBeLessThanOrEqual(o.totaal)
    expect(o.afwijkingen).toBe(0)
  })
  it('founderfuncties staan er niet in; rolfuncties staan als Altijd aan voor die rol', () => {
    const alle = niveauOverzicht(org, stand).groepen.flatMap((g) => g.functies)
    expect(alle.some((f) => f.sleutel.startsWith('platform.'))).toBe(false)
    const audit = alle.find((f) => f.sleutel === 'instellingen.audit')!
    expect(audit.alleenVoor).toEqual(['beheerder'])
  })
  it('een afwijking voor deze organisatie gaat voor de standaard en is gemarkeerd', () => {
    const eigen: FunctieRegel[] = [...stand, { functie: 'nav.inzichten', niveau: 'beginner', aan: true, organisationId: 'org-a' }]
    const f = niveauOverzicht(org, eigen).groepen.flatMap((g) => g.functies).find((x) => x.sleutel === 'nav.inzichten')!
    expect(f.cellen.beginner).toEqual({ aan: true, afwijking: true })
    expect(f.cellen.gevorderd.afwijking).toBe(false)
    expect(niveauOverzicht(org, eigen).afwijkingen).toBe(1)
    // Een afwijking voor een andere organisatie telt niet.
    const ander: FunctieRegel[] = [...stand, { functie: 'nav.inzichten', niveau: 'beginner', aan: true, organisationId: 'org-b' }]
    expect(niveauOverzicht(org, ander).groepen.flatMap((g) => g.functies).find((x) => x.sleutel === 'nav.inzichten')!.cellen.beginner.aan).toBe(false)
  })
  it('Iedereen ziet alles: elk niveau heeft alles uit het pakket', () => {
    const o = niveauOverzicht({ ...org, iedereenAlles: true }, stand)
    expect(o.tellingen.beginner).toBe(o.totaal)
  })
  it('buiten het pakket is herkenbaar', () => {
    const f = niveauOverzicht(org, stand).groepen.flatMap((g) => g.functies).find((x) => x.pakket === 'compleet')
    if (f) expect(f.inPakket).toBe(false)
    expect(groepNaam('F14 Agents en mandaten')).toBe('Agents en mandaten')
  })
})

describe('wie mag wat', () => {
  it('één zin per rol, zonder platformbeheer', () => {
    expect(rechtTekst({ lezen: 'alles', schrijven: 'eigen' })).toBe('Lezen: alles. Wijzigen: alleen eigen.')
    expect(rechtTekst({ lezen: 'alles', schrijven: 'alles', verwijderen: 'alles', beheren: 'alles' })).toBe('Lezen, wijzigen, verwijderen en beheren: alles.')
    expect(rechtTekst({})).toBe('Geen toegang.')
    const r = wieMagWat()
    expect(r.some((x) => x.onderdeel === 'platform')).toBe(false)
    expect(r.find((x) => x.onderdeel === 'abonnement')!.perRol.accountmanager).toBe('Geen toegang.')
    expect(r.find((x) => x.onderdeel === 'gebruikers')!.perRol.salesmanager).toBe('Lezen en wijzigen: eigen teams.')
  })
})

describe('audit', () => {
  const regel: AuditRegel = { id: 'a1', op: '2026-10-17T08:00:00.000Z', actie: 'mailsjabloon.uit', object: 'mailsjablonen', objectId: 'sj-1', door: 'Eva; "Test"', doorId: 'u-1', leverancier: false, reden: '=SUM(A1)' }
  it('leesbare teksten, ook samengesteld; onbekend blijft technisch', () => {
    expect(actieTekst('leverancier.werkin.start')).toBe('Dealtrace begon te werken in je organisatie')
    expect(actieTekst('account.deactiveren')).toBe('Prospect gedeactiveerd')
    expect(actieTekst('iets.vreemds')).toBe('iets.vreemds')
    expect(AUDIT_SOORTEN.leverancier).toEqual(['leverancier.%'])
  })
  it('CSV met BOM, puntkomma, aanhalingstekens en geen formules', () => {
    const csv = auditCsv([regel])
    expect(csv.startsWith('﻿Wanneer;Wie;')).toBe(true)
    expect(csv).toContain('"Eva; ""Test"""')
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain('Mailsjabloon uitgezet')
    expect(csv.trim().split('\r\n')).toHaveLength(2)
    expect(csvVeld('-1')).toBe("'-1")
  })
  it('cursor heen en terug; onzin geeft null', () => {
    const c = auditCursor(regel)
    expect(leesCursor(c)).toEqual({ op: regel.op, id: 'a1' })
    expect(leesCursor('geen')).toBeNull()
    expect(leesCursor('gisteren|x')).toBeNull()
  })
})

describe('agents', () => {
  it('de Zoeker draait al (automatische rondes); Gids en LinkedIn-assistent komen later', () => {
    expect(agentDef('zoeker')!.gebouwd).toBe(true)
    expect(agentDef('gids')!.gebouwd).toBe(false)
    expect(agentDef('linkedin')!.gebouwd).toBe(false)
  })
})
