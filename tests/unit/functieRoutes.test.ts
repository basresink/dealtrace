// Wens opdrachtgever: staat een functie uit, dan laat de app de functie, de knop en elke link
// ernaar niet zien. Eén register (shared/functieRoutes.ts) voor menu, onderbalk, zoeken en links.
import { describe, expect, it } from 'vitest'
import { FUNCTIES, beschikbaar, functie, startindeling } from '../../shared/functies'
import { ROUTE_FUNCTIES, functiesVoorPad, kaalPad, magNaarPad, uitgezetVoorPad } from '../../shared/functieRoutes'
import { tabsVoor } from '../../shared/onderbalk'
import { zijbalkVoor } from '../../shared/zijbalk'
import type { FunctieRegel, GebruikerContext, OrganisatieContext } from '../../shared/types'

const org: OrganisatieContext = { id: 'org-a', pakket: 'starter', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))
const gebruiker = (overig: Partial<GebruikerContext> = {}): GebruikerContext => ({ id: 'u1', rol: 'accountmanager', niveau: 'beginner', werkplek: 'binnendienst', teamId: null, verborgen: [], ...overig })
const aanVoor = (g: GebruikerContext, s: FunctieRegel[] = stand) => (sleutel: string) => beschikbaar(sleutel, g, org, s).ok

describe('register scherm naar functie', () => {
  it('noemt alleen bestaande functies', () => {
    for (const r of ROUTE_FUNCTIES) for (const s of r.eenVan) expect(functie(s), `${r.pad}: ${s}`).toBeTruthy()
  })

  it('kaalPad laat query, hash en slotslash weg; externe links tellen niet', () => {
    expect(kaalPad('/inzichten?inzicht=1#x')).toBe('/inzichten')
    expect(kaalPad('/belblokken/')).toBe('/belblokken')
    expect(kaalPad('/')).toBe('/')
    expect(kaalPad('https://voorbeeld.test/inzichten')).toBeNull()
    expect(kaalPad('//voorbeeld.test')).toBeNull()
    expect(kaalPad(null)).toBeNull()
  })

  it('een subpad hoort bij zijn scherm; Vandaag en de hub van Instellingen alleen exact', () => {
    expect(functiesVoorPad('/accountplannen/ap-1').flatMap((r) => r.eenVan)).toContain('nav.accountplannen')
    expect(functiesVoorPad('/campagnes/nieuw').flatMap((r) => r.eenVan)).toEqual(expect.arrayContaining(['nav.campagnes', 'campagnes.meedoen', 'campagnes.maken']))
    expect(functiesVoorPad('/accounts/a-1')).toEqual([])
    expect(functiesVoorPad('/instellingen/mijn-scripts').flatMap((r) => r.eenVan)).toEqual(['belscript.variant'])
    expect(functiesVoorPad('/mij')).toEqual([])
  })

  it('Beginner: geen link naar Inzichten, Accountplannen, Leadgenerator of Bezoekanalyse; wel naar Taken, Agenda en Dagstart', () => {
    const aan = aanVoor(gebruiker())
    for (const pad of ['/inzichten', '/inzichten?inzicht=s-1', '/accountplannen/ap-1', '/leadgenerator', '/bezoek-analyse', '/signaalradar', '/briefings', '/reizen/r-1'])
      expect(magNaarPad(pad, aan), pad).toBe(false)
    for (const pad of ['/taken', '/agenda?weergave=dag', '/dagstart', '/weekstart', '/prospects/alle', '/contacten/c-1', '/accounts/a-1', '/helpcenter/vandaag'])
      expect(magNaarPad(pad, aan), pad).toBe(true)
    expect(uitgezetVoorPad('/inzichten', aan)).toBe('nav.inzichten')
    expect(uitgezetVoorPad('/taken', aan)).toBeNull()
  })

  it('Gevorderd: Inzichten, Leadgenerator en Bezoekanalyse aan; Accountplannen en Prospectreizen nog niet', () => {
    const aan = aanVoor(gebruiker({ niveau: 'gevorderd' }))
    for (const pad of ['/inzichten', '/leadgenerator', '/bezoek-analyse', '/meeting-analyse', '/briefings']) expect(magNaarPad(pad, aan), pad).toBe(true)
    for (const pad of ['/accountplannen', '/reizen']) expect(magNaarPad(pad, aan), pad).toBe(false)
  })

  it('"een van": de pagina Terugkomen staat open zodra een van zijn functies aanstaat', () => {
    expect(magNaarPad('/instellingen/terugkomen', (s) => s === 'ritme.beheer')).toBe(true)
    expect(magNaarPad('/instellingen/terugkomen', () => false)).toBe(false)
  })
})

describe('de founder zet een functie uit voor een organisatie', () => {
  const uit = (sleutel: string): FunctieRegel[] => [...stand, ...(['beginner', 'gevorderd', 'expert'] as const).map((niveau) => ({ functie: sleutel, niveau, aan: false, organisationId: org.id }))]

  it('Dagstart uit: geen link, niet in het menu en niet in de zoekregels', () => {
    const g = gebruiker({ niveau: 'gevorderd' })
    expect(magNaarPad('/dagstart', aanVoor(g, uit('dagritme.dagstart')))).toBe(false)
    expect(magNaarPad('/dagstart', aanVoor(g))).toBe(true)
  })

  it('Belmodus uit: Belblokken verdwijnt uit het menu en uit de onderbalk, ook al staat het menu-item zelf aan', () => {
    const g = gebruiker()
    const s = uit('belblok.uitvoeren')
    const routes = zijbalkVoor(g, org, s).groepen.flatMap((x) => x.items.map((i) => i.route))
    expect(routes).not.toContain('/belblokken')
    expect(zijbalkVoor(g, org, stand).groepen.flatMap((x) => x.items.map((i) => i.route))).toContain('/belblokken')
    const tabs = tabsVoor('binnendienst', 'accountmanager', true, (r) => magNaarPad(r, aanVoor(g, s)))
    expect(tabs.map((t) => t.sleutel)).toEqual(['vandaag', 'taken', 'prospects', 'meer'])
    expect(tabsVoor('binnendienst', 'accountmanager').map((t) => t.sleutel)).toEqual(['vandaag', 'belblok', 'taken', 'prospects', 'meer'])
  })

  it('elk zijbalkitem dat overblijft, leidt naar een scherm dat aanstaat', () => {
    for (const niveau of ['beginner', 'gevorderd', 'expert'] as const) {
      const g = gebruiker({ niveau })
      const aan = aanVoor(g)
      for (const i of zijbalkVoor(g, org, stand).groepen.flatMap((x) => x.items)) expect(magNaarPad(i.route, aan), `${niveau} ${i.route}`).toBe(true)
    }
  })
})

it('elke zijbalkroute (behalve Platformbeheer) staat in het register', () => {
  for (const f of FUNCTIES.filter((x) => x.zijbalk && x.sleutel !== 'nav.platform'))
    expect(functiesVoorPad(f.zijbalk!.route).length, f.zijbalk!.route).toBeGreaterThan(0)
})
