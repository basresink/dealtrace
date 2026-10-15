import { describe, expect, it } from 'vitest'
import { FUNCTIES, aanVoorNiveau, beschikbaar, startindeling } from '../../shared/functies'
import { telItems, zijbalkVoor } from '../../shared/zijbalk'
import type { FunctieRegel, GebruikerContext, OrganisatieContext } from '../../shared/types'

const org: OrganisatieContext = { id: 'org-a', pakket: 'starter', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))

function gebruiker(overig: Partial<GebruikerContext> = {}): GebruikerContext {
  return { id: 'u1', rol: 'accountmanager', niveau: 'beginner', werkplek: 'binnendienst', teamId: null, verborgen: [], ...overig }
}

describe('zijbalk per niveau (6.1)', () => {
  it('Beginner 11, Gevorderd 14, Expert 15 items', () => {
    expect(telItems(zijbalkVoor(gebruiker(), org, stand))).toBe(11)
    expect(telItems(zijbalkVoor(gebruiker({ niveau: 'gevorderd' }), org, stand))).toBe(14)
    expect(telItems(zijbalkVoor(gebruiker({ niveau: 'expert' }), org, stand))).toBe(15)
  })

  it('wat uit staat komt in "Nog niet aangezet" met het niveau waarvoor het aanstaat', () => {
    const z = zijbalkVoor(gebruiker(), org, stand)
    expect(z.nietAangezet.map((i) => i.sleutel)).toEqual(['nav.leadgenerator', 'nav.inzichten', 'nav.planning', 'nav.reizen'])
    expect(z.nietAangezet.find((i) => i.sleutel === 'nav.leadgenerator')?.aanVanaf).toBe('gevorderd')
    expect(z.nietAangezet.find((i) => i.sleutel === 'nav.reizen')?.aanVanaf).toBe('expert')
  })

  it('volgorde in Werk volgt het werkplekprofiel', () => {
    const werk = (w: GebruikerContext['werkplek']) =>
      zijbalkVoor(gebruiker({ werkplek: w }), org, stand).groepen.find((g) => g.naam === 'Werk')!.items.map((i) => i.naam)
    expect(werk('binnendienst').indexOf('Belblokken')).toBeLessThan(werk('binnendienst').indexOf('Bezoeken'))
    expect(werk('buitendienst').indexOf('Bezoeken')).toBeLessThan(werk('buitendienst').indexOf('Belblokken'))
  })

  it('Beginner ziet de labels meedoen en lezen', () => {
    const items = zijbalkVoor(gebruiker(), org, stand).groepen.flatMap((g) => g.items)
    expect(items.find((i) => i.sleutel === 'nav.campagnes')?.label).toBe('meedoen')
    expect(items.find((i) => i.sleutel === 'nav.richting')?.label).toBe('lezen')
  })

  it('Toon minder haalt weg, nooit erbij', () => {
    const z = zijbalkVoor(gebruiker({ verborgen: ['nav.campagnes', 'nav.leadgenerator'] }), org, stand)
    expect(telItems(z)).toBe(10)
    expect(z.groepen.flatMap((g) => g.items).some((i) => i.sleutel === 'nav.leadgenerator')).toBe(false)
  })

  it('Manager-groep alleen voor salesmanager en beheerder; Instellingen niet voor accountmanager', () => {
    const am = zijbalkVoor(gebruiker({ niveau: 'expert' }), org, stand)
    expect(am.groepen.some((g) => g.naam === 'Manager')).toBe(false)
    const sm = zijbalkVoor(gebruiker({ rol: 'salesmanager', niveau: 'expert' }), org, stand)
    expect(sm.groepen.find((g) => g.naam === 'Manager')?.items).toHaveLength(4)
  })

  it('Iedereen ziet alles: geen groep Nog niet aangezet', () => {
    const z = zijbalkVoor(gebruiker(), { ...org, iedereenAlles: true }, stand)
    expect(z.nietAangezet).toHaveLength(0)
    expect(telItems(z)).toBe(15)
  })
})

describe('beschikbaar (4.2)', () => {
  it('geeft de reden niveau, pakket en rol', () => {
    expect(beschikbaar('nav.leadgenerator', gebruiker(), org, stand)).toEqual({ ok: false, reden: 'niveau' })
    expect(beschikbaar('nav.team', gebruiker({ niveau: 'expert' }), org, stand)).toEqual({ ok: false, reden: 'rol' })
    expect(beschikbaar('bestaat.niet', gebruiker(), org, stand)).toEqual({ ok: false, reden: 'rol' })
    const uitPakket = { ...org, features: { uit: ['nav.agenda'] } }
    expect(beschikbaar('nav.agenda', gebruiker(), uitPakket, stand)).toEqual({ ok: false, reden: 'pakket' })
  })

  it('Iedereen ziet alles gaat nooit boven pakket of rol', () => {
    const alles = { ...org, iedereenAlles: true, features: { uit: ['nav.agenda'] } }
    expect(beschikbaar('nav.leadgenerator', gebruiker(), alles, stand).ok).toBe(true)
    expect(beschikbaar('nav.agenda', gebruiker(), alles, stand).ok).toBe(false)
    expect(beschikbaar('nav.team', gebruiker(), alles, stand).ok).toBe(false)
  })

  it('een regel voor de organisatie gaat voor de regel voor alle organisaties', () => {
    const eigen: FunctieRegel[] = [...stand, { functie: 'nav.leadgenerator', niveau: 'beginner', aan: true, organisationId: 'org-a' }]
    expect(aanVoorNiveau('nav.leadgenerator', 'beginner', org, eigen)).toBe(true)
    expect(aanVoorNiveau('nav.leadgenerator', 'beginner', { id: 'org-b' }, eigen)).toBe(false)
  })

  it('een functie zonder regel staat uit', () => {
    expect(aanVoorNiveau('nav.vandaag', 'beginner', org, [])).toBe(false)
  })

  it('elke functie heeft een helpartikel en een startregel per niveau', () => {
    for (const f of FUNCTIES) expect(f.helpartikel).toBeTruthy()
    expect(startindeling()).toHaveLength(FUNCTIES.length * 3)
  })
})
