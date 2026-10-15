// De mobiele schil (P27, 8.3, 8.4, 8.16): onderbalk per werkplekprofiel, de actieve tab per
// route, de inhoud van "Meer" en de schermklasse. Eén definitie voor schil en tests (gat 16).
import type { Rol, Werkplek } from './types'
import type { Zijbalk, ZijbalkItem } from './zijbalk'

export interface Tab { sleutel: string; label: string; icoon: string; route: string | null }
const t = (sleutel: string, label: string, icoon: string, route: string | null): Tab => ({ sleutel, label, icoon, route })
const MEER = t('meer', 'Meer', 'Ellipsis', null)

const PROFIELEN: Record<'buitendienst' | 'binnendienst' | 'hybride' | 'manager', Tab[]> = {
  buitendienst: [t('vandaag', 'Vandaag', 'House', '/'), t('route', 'Route', 'Navigation', '/onderweg'), t('bellen', 'Bellen', 'Phone', '/bellen'), t('prospects', 'Prospects', 'Building2', '/prospects'), MEER],
  binnendienst: [t('vandaag', 'Vandaag', 'House', '/'), t('belblok', 'Belblok', 'Phone', '/belblokken'), t('acties', 'Acties', 'SquareCheck', '/acties'), t('prospects', 'Prospects', 'Building2', '/prospects'), MEER],
  hybride: [t('vandaag', 'Vandaag', 'House', '/'), t('route', 'Route', 'Navigation', '/onderweg'), t('belblok', 'Belblok', 'Phone', '/belblokken'), t('prospects', 'Prospects', 'Building2', '/prospects'), MEER],
  manager: [t('team', 'Team', 'UsersRound', '/team'), t('coaching', 'Coaching', 'MessagesSquare', '/coaching'), t('acties', 'Acties', 'SquareCheck', '/acties'), t('prospects', 'Prospects', 'Building2', '/prospects'), MEER],
}

/** Vijf tabs; een onbekend profiel valt terug op binnendienst. Op elk niveau gelijk. */
export function tabsVoor(werkplek: Werkplek | string | null | undefined, rol: Rol | string, eigenPortefeuille = true): Tab[] {
  if (rol === 'salesmanager' && !eigenPortefeuille) return PROFIELEN.manager
  if (werkplek === 'buitendienst' || werkplek === 'hybride') return PROFIELEN[werkplek]
  return PROFIELEN.binnendienst
}

/** Subpagina's die bij een tab horen; al het andere hoort bij "Meer". */
const ONDER: Record<string, string[]> = { '/prospects': ['/accounts'], '/belblokken': [], '/bellen': [], '/onderweg': ['/bezoeken'] }
const valtOnder = (pad: string, route: string) => (route === '/' ? pad === '/' : pad === route || pad.startsWith(`${route}/`))

/** Index van de actieve tab: elke pagina hoort bij precies één tab (8.16). */
export function tabVoorRoute(pad: string, tabs: Tab[]): number {
  const p = pad.split('?')[0]!.replace(/\/+$/, '') || '/'
  const i = tabs.findIndex((x) => x.route && (valtOnder(p, x.route) || (ONDER[x.route] ?? []).some((o) => valtOnder(p, o))))
  return i >= 0 ? i : tabs.findIndex((x) => x.sleutel === 'meer')
}

export interface MeerGroep { naam: string; items: (ZijbalkItem & { grootScherm?: boolean })[] }
const GROOT_SCHERM = ['/instellingen', '/platform', '/leadgenerator']

/** "Meer": de rest van de zijbalk van je niveau in dezelfde groepen en volgorde, niets dubbel met de onderbalk; wat uit staat apart. */
export function meerItems(zijbalk: Zijbalk, tabs: Tab[]): { groepen: MeerGroep[]; nietAangezet: ZijbalkItem[] } {
  const inBalk = new Set(tabs.map((x) => x.route).filter(Boolean) as string[])
  const groepen = zijbalk.groepen.map((g) => ({
    naam: g.naam, items: g.items.filter((i) => !inBalk.has(i.route)).map((i) => ({ ...i, ...(GROOT_SCHERM.some((r) => i.route.startsWith(r)) ? { grootScherm: true } : {}) })),
  })).filter((g) => g.items.length)
  return { groepen, nietAangezet: zijbalk.nietAangezet.filter((i) => !inBalk.has(i.route)) }
}

export type Schermklasse = 'telefoon' | 'tablet' | 'laptop'
/** Kleiner dan 768 telefoon, 768 tot en met 1023 tablet, vanaf 1024 laptop; een grote aanraakpagina blijft tablet. */
export function schermklasse(breedte: number, grofAanwijzer = false): Schermklasse {
  if (breedte < 768) return 'telefoon'
  if (breedte < 1024) return 'tablet'
  return grofAanwijzer && breedte < 1200 ? 'tablet' : 'laptop'
}
