// P27: onderbalk, actieve tab, Meer, schermklasse en de codelimiet.
import { describe, expect, it } from 'vitest'
import { FUNCTIES } from '../../shared/functies'
import { magCodeAanvragen, toestelLabel } from '../../shared/inloggen'
import { meerItems, schermklasse, tabsVoor, tabVoorRoute } from '../../shared/onderbalk'
import { zijbalkVoor } from '../../shared/zijbalk'

describe('onderbalk', () => {
  it('vijf tabs per profiel; onbekend valt terug op binnendienst; salesmanager zonder portefeuille', () => {
    expect(tabsVoor('buitendienst', 'accountmanager').map((t) => t.label)).toEqual(['Vandaag', 'Route', 'Bellen', 'Prospects', 'Meer'])
    expect(tabsVoor('binnendienst', 'accountmanager').map((t) => t.label)).toEqual(['Vandaag', 'Belblok', 'Taken', 'Prospects', 'Meer'])
    expect(tabsVoor('hybride', 'accountmanager').map((t) => t.label)).toEqual(['Vandaag', 'Route', 'Belblok', 'Prospects', 'Meer'])
    expect(tabsVoor('raar', 'accountmanager').map((t) => t.label)).toEqual(['Vandaag', 'Belblok', 'Taken', 'Prospects', 'Meer'])
    expect(tabsVoor('binnendienst', 'salesmanager', false).map((t) => t.label)).toEqual(['Team', 'Coaching', 'Taken', 'Prospects', 'Meer'])
  })
  it('elke route uit de zijbalk geeft precies één tab; subpagina\'s van accounts horen bij Prospects', () => {
    const tabs = tabsVoor('binnendienst', 'accountmanager')
    for (const f of FUNCTIES.filter((x) => x.zijbalk)) {
      const i = tabVoorRoute(f.zijbalk!.route, tabs)
      expect(i, f.zijbalk!.route).toBeGreaterThanOrEqual(0)
    }
    expect(tabVoorRoute('/', tabs)).toBe(0)
    expect(tabVoorRoute('/belblokken/abc', tabs)).toBe(1)
    expect(tabVoorRoute('/accounts/pr-01', tabs)).toBe(3)
    expect(tabVoorRoute('/agenda', tabs)).toBe(4)
    expect(tabVoorRoute('/prospects/alle?x=1', tabs)).toBe(3)
  })
  it('Meer bevat niets van de onderbalk; wat uit staat apart; instellingen met "Beter op een groot scherm"', () => {
    const org = { id: 'org-a', pakket: 'compleet', features: {}, iedereenAlles: false } as any
    for (const niveau of ['beginner', 'gevorderd', 'expert'] as const) {
      const z = zijbalkVoor({ rol: 'accountmanager', niveau, werkplek: 'binnendienst', verborgen: [] } as any, org, [])
      const tabs = tabsVoor('binnendienst', 'accountmanager')
      const m = meerItems(z, tabs)
      const routes = m.groepen.flatMap((g) => g.items.map((i) => i.route))
      for (const t of tabs) if (t.route) expect(routes).not.toContain(t.route)
    }
    const beheer = meerItems(zijbalkVoor({ rol: 'beheerder', niveau: 'expert', werkplek: 'binnendienst', verborgen: [] } as any, org, []), tabsVoor('binnendienst', 'beheerder'))
    expect(beheer.groepen.flatMap((g) => g.items).find((i) => i.route.startsWith('/instellingen'))?.grootScherm).toBe(true)
  })
  it('schermklasse: 767 telefoon, 768 tablet, 1023 tablet, 1024 laptop', () => {
    expect([767, 768, 1023, 1024].map((b) => schermklasse(b))).toEqual(['telefoon', 'tablet', 'tablet', 'laptop'])
    expect(schermklasse(1100, true)).toBe('tablet')
  })
})

describe('inloggen', () => {
  const nu = new Date('2026-10-15T10:00:00Z')
  const min = (m: number) => new Date(nu.getTime() - m * 60_000)
  it('precies 5 binnen 60 minuten mag, de zesde niet; oude aanvragen tellen niet', () => {
    expect(magCodeAanvragen([min(1), min(2), min(3), min(4)], nu)).toBe(true)
    expect(magCodeAanvragen([min(1), min(2), min(3), min(4), min(5)], nu)).toBe(false)
    expect(magCodeAanvragen([min(61), min(70), min(80), min(90), min(100)], nu)).toBe(true)
  })
  it('toestellabel', () => {
    expect(toestelLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('iPhone · Safari')
    expect(toestelLabel('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36')).toBe('Android · Chrome')
    expect(toestelLabel(null)).toBe('Onbekend toestel · browser')
  })
})
