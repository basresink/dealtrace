// Wens opdrachtgever: op Instellingen, Niveaus zet de beheerder functies per niveau aan en uit, met de
// startindeling als standaard. De berekening van "beschikbaar" neemt die keuze mee; pakket, rol en een
// uitzetting door Dealtrace blijven gelden. Alles fictief.
import { describe, expect, it } from 'vitest'
import { aanVanaf, beschikbaar, founderUit, functie, niveauAan, startindeling } from '../../shared/functies'
import { magNaarPad } from '../../shared/functieRoutes'
import { aantalKeuzes, keuzeFout, niveauOverzicht, schoneKeuzes, zetKeuze } from '../../shared/niveauOverzicht'
import { zijbalkVoor } from '../../shared/zijbalk'
import type { FunctieRegel, GebruikerContext, OrganisatieContext } from '../../shared/types'

const org: OrganisatieContext = { id: 'org-a', pakket: 'starter', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))
const am = (niveau: GebruikerContext['niveau']): GebruikerContext => ({ id: 'u1', rol: 'accountmanager', niveau, werkplek: 'binnendienst', teamId: null, verborgen: [] })
const cel = (o: OrganisatieContext, s: FunctieRegel[], sleutel: string) => niveauOverzicht(o, s).groepen.flatMap((g) => g.functies).find((f) => f.sleutel === sleutel)!

describe('standaard', () => {
  it('zonder keuzes geldt de startindeling', () => {
    const f = functie('nav.signaalradar')!
    expect(f.startNiveau).toBe('gevorderd')
    expect(niveauAan('nav.signaalradar', 'beginner', org, stand)).toBe(false)
    expect(niveauAan('nav.signaalradar', 'expert', org, stand)).toBe(true)
    expect(beschikbaar('nav.signaalradar', am('expert'), org, stand)).toEqual({ ok: true })
    const o = niveauOverzicht(org, stand)
    expect(o.keuzes).toBe(0)
    expect(cel(org, stand, 'nav.signaalradar').cellen.expert).toMatchObject({ aan: true, standaard: true, keuze: null, founderUit: false })
  })
})

describe('afwijking van de organisatie', () => {
  it('uit voor Expert: weg uit menu en pad, de andere niveaus blijven', () => {
    const keuzes = zetKeuze({}, 'nav.signaalradar', 'expert', false, org, stand)
    expect(keuzes).toEqual({ 'nav.signaalradar': { expert: false } })
    const o = { ...org, keuzes }
    expect(beschikbaar('nav.signaalradar', am('expert'), o, stand)).toEqual({ ok: false, reden: 'niveau' })
    expect(beschikbaar('nav.signaalradar', am('gevorderd'), o, stand)).toEqual({ ok: true })
    const z = zijbalkVoor(am('expert'), o, stand)
    expect(z.groepen.flatMap((g) => g.items).map((i) => i.sleutel)).not.toContain('nav.signaalradar')
    expect(magNaarPad('/signaalradar', (s) => beschikbaar(s, am('expert'), o, stand).ok)).toBe(false)
    // Hij gaat nog steeds aan vanaf Gevorderd.
    expect(aanVanaf('nav.signaalradar', o, stand)).toBe('gevorderd')
    const f = cel(o, stand, 'nav.signaalradar')
    expect(f.cellen.expert).toMatchObject({ aan: false, standaard: true, keuze: false })
    expect(f.aangepast).toBe(true)
    expect(niveauOverzicht(o, stand).keuzes).toBe(1)
  })

  it('aan voor Beginner vóór de startindeling, en terugzetten naar de standaard haalt de keuze weg', () => {
    const k1 = zetKeuze({}, 'nav.signaalradar', 'beginner', true, org, stand)
    expect(beschikbaar('nav.signaalradar', am('beginner'), { ...org, keuzes: k1 }, stand)).toEqual({ ok: true })
    expect(aanVanaf('nav.signaalradar', { ...org, keuzes: k1 }, stand)).toBe('beginner')
    const k2 = zetKeuze(k1, 'nav.signaalradar', 'beginner', false, org, stand)
    expect(k2).toEqual({})
    expect(aantalKeuzes(k1)).toBe(1)
    expect(aantalKeuzes(k2)).toBe(0)
  })

  it('schoneKeuzes laat onbekende functies, niveaus, rolfuncties en geen boolean weg', () => {
    expect(schoneKeuzes({ 'nav.signaalradar': { expert: false, meester: true, beginner: 'ja' }, 'bestaat.niet': { expert: true }, 'nav.team': { beginner: true } }))
      .toEqual({ 'nav.signaalradar': { expert: false } })
    expect(schoneKeuzes(null)).toEqual({})
    expect(schoneKeuzes([1, 2])).toEqual({})
  })
})

describe('grenzen', () => {
  it('pakket: buiten het pakket kan niet aan en een keuze maakt hem niet beschikbaar', () => {
    const buiten = [...new Set(stand.map((r) => r.functie))].map((s) => functie(s)!).find((f) => f.rollen === 'iedereen' && f.pakket !== 'starter')!
    expect(buiten).toBeTruthy()
    expect(keuzeFout(buiten.sleutel, 'expert', true, org, stand)).toMatchObject({ status: 422 })
    expect(keuzeFout(buiten.sleutel, 'expert', false, org, stand)).toBeNull()
    const o = { ...org, keuzes: { [buiten.sleutel]: { beginner: true } } }
    expect(beschikbaar(buiten.sleutel, am('beginner'), o, stand)).toEqual({ ok: false, reden: 'pakket' })
    expect(cel(o, stand, buiten.sleutel).schakelbaar).toBe(false)
  })

  it('rol: een managerfunctie gaat niet aan voor een accountmanager', () => {
    expect(functie('nav.team')!.rollen).not.toBe('iedereen')
    expect(keuzeFout('nav.team', 'beginner', true, org, stand)).toMatchObject({ status: 422 })
    // Ook als er toch een keuze zou staan, wint de rol.
    const o = { ...org, keuzes: { 'nav.team': { beginner: true, gevorderd: true, expert: true } } }
    expect(beschikbaar('nav.team', am('expert'), o, stand)).toEqual({ ok: false, reden: 'rol' })
    expect(cel(o, stand, 'nav.team').schakelbaar).toBe(false)
  })

  it('founder-uit wint: voor deze organisatie, of algemeen uit waar de startindeling aan is', () => {
    const eigen: FunctieRegel[] = [...stand, { functie: 'nav.signaalradar', niveau: 'expert', aan: false, organisationId: 'org-a' }]
    const o = { ...org, keuzes: { 'nav.signaalradar': { expert: true } } }
    expect(founderUit('nav.signaalradar', 'expert', org, eigen)).toBe(true)
    expect(beschikbaar('nav.signaalradar', am('expert'), o, eigen)).toEqual({ ok: false, reden: 'niveau' })
    expect(keuzeFout('nav.signaalradar', 'expert', true, org, eigen)).toMatchObject({ status: 409 })
    expect(cel(o, eigen, 'nav.signaalradar').cellen.expert).toMatchObject({ aan: false, founderUit: true })
    const algemeen = stand.map((r) => (r.functie === 'nav.signaalradar' && r.niveau === 'gevorderd' ? { ...r, aan: false } : r))
    expect(founderUit('nav.signaalradar', 'gevorderd', org, algemeen)).toBe(true)
    expect(niveauAan('nav.signaalradar', 'gevorderd', { ...org, keuzes: { 'nav.signaalradar': { gevorderd: true } } }, algemeen)).toBe(false)
    // Uit in de startindeling is geen uitzetting door Dealtrace: de organisatie mag hem aanzetten.
    expect(founderUit('nav.signaalradar', 'beginner', org, stand)).toBe(false)
    // Een founderuitzetting op het pakket gaat ook voor.
    expect(beschikbaar('nav.signaalradar', am('expert'), { ...o, features: { uit: ['nav.signaalradar'] } }, stand)).toEqual({ ok: false, reden: 'pakket' })
  })

  it('onbekende functie of niveau, of aan zonder boolean: 422', () => {
    expect(keuzeFout('bestaat.niet', 'expert', true, org, stand)).toMatchObject({ status: 422 })
    expect(keuzeFout('nav.signaalradar', 'meester', true, org, stand)).toMatchObject({ status: 422 })
    expect(keuzeFout('nav.signaalradar', 'expert', 'ja', org, stand)).toMatchObject({ status: 422 })
  })
})
