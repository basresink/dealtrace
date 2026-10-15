// De rechtenmatrix van Dealtrace (bouwplan 3.3). Server en client gebruiken
// dezelfde matrix. Een onderdeel dat hier niet staat, valt op 'geen'.

import type { Rol } from './types'

export type Scope = 'geen' | 'eigen' | 'team' | 'alles'
export type Actie = 'lezen' | 'schrijven' | 'verwijderen' | 'beheren'

export const ONDERDELEN = [
  'prospects', 'leads', 'reizen', 'campagnes', 'taken', 'afspraken', 'activiteiten',
  'belscripts', 'eigenVelden', 'regels', 'coaching', 'mandaten', 'gebruikers',
  'abonnement', 'platform', 'instellingen', 'notificaties', 'persoonlijk',
] as const
export type Onderdeel = typeof ONDERDELEN[number]

type Rij = Partial<Record<Actie, Scope>>
type Matrix = Record<Onderdeel, Record<Exclude<Rol, 'founder'>, Rij>>

const ALLES: Rij = { lezen: 'alles', schrijven: 'alles', verwijderen: 'alles', beheren: 'alles' }
const TEAM: Rij = { lezen: 'team', schrijven: 'team', verwijderen: 'team' }

/**
 * Matrix uit 3.3. "alles in team" is team; "eigen profiel" is eigen.
 * De salesmanager ziet alleen zijn teams; dat is vanaf sprint 1 server-side.
 */
export const MATRIX: Matrix = {
  prospects: {
    accountmanager: { lezen: 'alles', schrijven: 'alles' },
    salesmanager: { lezen: 'alles', schrijven: 'alles', verwijderen: 'team' },
    beheerder: ALLES,
  },
  leads: {
    accountmanager: { lezen: 'alles', schrijven: 'eigen' },
    salesmanager: { lezen: 'alles', schrijven: 'alles', verwijderen: 'alles' },
    beheerder: ALLES,
  },
  reizen: {
    accountmanager: { lezen: 'alles', schrijven: 'eigen' },
    salesmanager: { lezen: 'alles', schrijven: 'alles', beheren: 'alles' },
    beheerder: ALLES,
  },
  campagnes: {
    accountmanager: { lezen: 'alles', schrijven: 'eigen', verwijderen: 'eigen' },
    salesmanager: TEAM,
    beheerder: ALLES,
  },
  taken: {
    accountmanager: { lezen: 'alles', schrijven: 'alles', verwijderen: 'eigen' },
    salesmanager: TEAM,
    beheerder: ALLES,
  },
  afspraken: {
    accountmanager: { lezen: 'alles', schrijven: 'alles', verwijderen: 'eigen' },
    salesmanager: TEAM,
    beheerder: ALLES,
  },
  activiteiten: {
    // Alleen toevoegen: 'schrijven' betekent hier toevoegen, nooit wijzigen.
    accountmanager: { lezen: 'alles', schrijven: 'alles' },
    salesmanager: { lezen: 'alles' },
    beheerder: { lezen: 'alles' },
  },
  belscripts: {
    accountmanager: { lezen: 'alles', schrijven: 'eigen' },
    salesmanager: { lezen: 'alles', schrijven: 'team', beheren: 'team' },
    beheerder: ALLES,
  },
  eigenVelden: {
    accountmanager: { lezen: 'alles', schrijven: 'alles' },
    salesmanager: { lezen: 'alles', schrijven: 'alles' },
    beheerder: ALLES,
  },
  regels: {
    accountmanager: { lezen: 'alles', schrijven: 'eigen' },
    salesmanager: { lezen: 'alles', schrijven: 'team' },
    beheerder: ALLES,
  },
  coaching: {
    accountmanager: { lezen: 'eigen' },
    salesmanager: { lezen: 'team', schrijven: 'team' },
    beheerder: { lezen: 'alles' },
  },
  mandaten: {
    accountmanager: { lezen: 'alles' },
    salesmanager: { lezen: 'alles' },
    beheerder: { lezen: 'alles', schrijven: 'alles' },
  },
  gebruikers: {
    accountmanager: { lezen: 'eigen', schrijven: 'eigen' },
    salesmanager: { lezen: 'team', schrijven: 'team' },
    beheerder: ALLES,
  },
  abonnement: {
    accountmanager: {},
    salesmanager: { lezen: 'team' },
    beheerder: { lezen: 'alles', schrijven: 'alles' },
  },
  platform: { accountmanager: {}, salesmanager: {}, beheerder: {} },
  instellingen: {
    accountmanager: { lezen: 'alles' },
    salesmanager: { lezen: 'alles' },
    beheerder: ALLES,
  },
  notificaties: {
    accountmanager: { lezen: 'eigen', schrijven: 'eigen' },
    salesmanager: { lezen: 'eigen', schrijven: 'eigen' },
    beheerder: { lezen: 'eigen', schrijven: 'eigen' },
  },
  persoonlijk: {
    accountmanager: { lezen: 'eigen', schrijven: 'eigen' },
    salesmanager: { lezen: 'eigen', schrijven: 'eigen' },
    beheerder: { lezen: 'eigen', schrijven: 'eigen' },
  },
}

export function isOnderdeel(v: unknown): v is Onderdeel {
  return typeof v === 'string' && (ONDERDELEN as readonly string[]).includes(v)
}

/** De scope van een rol voor een onderdeel en actie. Founder: platform alles, de rest alleen na instappen (P02). */
export function scopeVoor(rol: Rol, onderdeel: string, actie: Actie, opties: { ingestapt?: boolean } = {}): Scope {
  if (!isOnderdeel(onderdeel)) return 'geen'
  if (rol === 'founder') {
    if (onderdeel === 'platform' || onderdeel === 'gebruikers') return 'alles'
    // Eigen meldingen en persoonlijke instellingen heeft iedereen, ook de founder.
    if (onderdeel === 'notificaties' || onderdeel === 'persoonlijk') return MATRIX[onderdeel].beheerder[actie] ?? 'geen'
    return opties.ingestapt && actie === 'lezen' ? 'alles' : 'geen'
  }
  return MATRIX[onderdeel][rol][actie] ?? 'geen'
}

/**
 * Mag deze rol deze actie op dit onderdeel? `eigen`: het record is van de
 * gebruiker; `team`: het record hoort bij een van zijn teams.
 */
export function rolMag(
  rol: Rol,
  onderdeel: string,
  actie: Actie,
  context: { eigen?: boolean; team?: boolean; ingestapt?: boolean } = {},
): boolean {
  const s = scopeVoor(rol, onderdeel, actie, context)
  if (s === 'alles') return true
  if (s === 'team') return !!(context.team || context.eigen)
  if (s === 'eigen') return !!context.eigen
  return false
}
