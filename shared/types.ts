// Gedeelde typen voor server en client (bouwplan hoofdstuk 3 en 4).

export type Rol = 'accountmanager' | 'salesmanager' | 'beheerder' | 'founder'
export type Niveau = 'beginner' | 'gevorderd' | 'expert'
export type Werkplek = 'binnendienst' | 'buitendienst' | 'hybride'
export type Pakket = 'starter' | 'plus' | 'compleet'

export const ROLLEN: readonly Rol[] = ['accountmanager', 'salesmanager', 'beheerder', 'founder']
export const NIVEAUS: readonly Niveau[] = ['beginner', 'gevorderd', 'expert']
export const WERKPLEKKEN: readonly Werkplek[] = ['binnendienst', 'buitendienst', 'hybride']
export const PAKKETTEN: readonly Pakket[] = ['starter', 'plus', 'compleet']

export const NIVEAU_LABEL: Record<Niveau, string> = {
  beginner: 'Beginner',
  gevorderd: 'Gevorderd',
  expert: 'Expert',
}

export const ROL_LABEL: Record<Rol, string> = {
  accountmanager: 'Accountmanager',
  salesmanager: 'Salesmanager',
  beheerder: 'Beheerder',
  founder: 'Founder',
}

export const WERKPLEK_LABEL: Record<Werkplek, string> = {
  binnendienst: 'Binnendienst',
  buitendienst: 'Buitendienst',
  hybride: 'Hybride',
}

export const PAKKET_LABEL: Record<Pakket, string> = {
  starter: 'Starter',
  plus: 'Plus',
  compleet: 'Compleet',
}

/** De gebruiker zoals de rekenregels hem nodig hebben. */
export interface GebruikerContext {
  id: string
  rol: Rol
  niveau: Niveau
  werkplek: Werkplek
  teamId: string | null
  /** Functies die de gebruiker zelf verbergt met "Toon minder". */
  verborgen: string[]
}

/** De organisatie zoals de rekenregels hem nodig hebben. */
export interface OrganisatieContext {
  id: string
  pakket: Pakket
  /** Afwijkingen op het pakket die de founder zet (bouwplan F23). */
  features: { aan?: string[]; uit?: string[] }
  /** "Iedereen ziet alles" (4.2). */
  iedereenAlles: boolean
  /** Keuzes van de beheerder op Instellingen, Niveaus: per functie en niveau aan of uit, alleen wat afwijkt van de standaard. */
  keuzes?: Record<string, Partial<Record<Niveau, boolean>>>
}

/** Eén regel uit de tabel functies_per_niveau. */
export interface FunctieRegel {
  functie: string
  niveau: Niveau
  aan: boolean
  /** null betekent: voor alle organisaties. */
  organisationId: string | null
}
