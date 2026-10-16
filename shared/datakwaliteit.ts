// Datakwaliteit: de gaten in de gegevens van accounts, contacten, taken en afspraken die je mag zien.
// Eén definitie voor de API, het scherm en de tests. De score is het deel van alle controles dat klopt.

export type KwaliteitGroep = 'Prospects' | 'Contacten' | 'Taken en afspraken'

export type KwaliteitSleutel =
  | 'zonderBeslisser' | 'zonderTelefoon' | 'zonderEmail' | 'zonderWebsite' | 'zonderBranche' | 'zonderKlasse'
  | 'zonderEigenaar' | 'dubbel' | 'zonderReis' | 'geenContact90'
  | 'contactZonderFunctie' | 'contactZonderConsent'
  | 'takenZonderDatum' | 'afsprakenZonderVerslag'

/** Een categorie uit een eigen veld met "Meenemen in Datakwaliteit": `cf.account.<sleutel>` of `cf.contact.<sleutel>`. */
export type EigenVeldSleutel = `cf.${'account' | 'contact'}.${string}`

/** Waar de noemer van een categorie op rust. */
export type Basis = 'prospects' | 'accounts' | 'onbeheerd' | 'contacten' | 'contactenMetMail' | 'taken' | 'afspraken'

export interface KwaliteitCategorie {
  sleutel: KwaliteitSleutel
  groep: KwaliteitGroep
  titel: string
  uitleg: string
  icoon: string
  basis: Basis
  /** Wat er ontbreekt, kort, als standaard voor elke regel in de flyout. */
  ontbreekt: string
  /** Filter op /prospects/alle; de flyout toont dan ook "Toon in lijst". */
  filter?: Record<string, string>
  /** Het filter vraagt "Alle filters" (prospects.filtersAlle). */
  filterVraagtAlles?: boolean
  /** Alleen voor salesmanager en beheerder. */
  alleenManager?: boolean
}

export const KWALITEIT_CATEGORIEEN: readonly KwaliteitCategorie[] = [
  { sleutel: 'zonderBeslisser', ontbreekt: 'Beslisser', groep: 'Prospects', titel: 'Prospects zonder beslisser', icoon: 'UserX', basis: 'prospects', filter: { bereikbaarheid: 'zonderBeslisser' }, filterVraagtAlles: true,
    uitleg: 'Zonder beslisser praat je met mensen die geen ja kunnen zeggen. Zoek wie tekent en leg hem vast.' },
  { sleutel: 'zonderTelefoon', ontbreekt: 'Telefoonnummer', groep: 'Prospects', titel: 'Prospects zonder telefoonnummer', icoon: 'PhoneOff', basis: 'prospects', filter: { bereikbaarheid: 'zonderTelefoon' }, filterVraagtAlles: true,
    uitleg: 'Wie je niet kunt bellen, valt uit je belblok en uit het hercontactritme.' },
  { sleutel: 'zonderEmail', ontbreekt: 'E-mailadres', groep: 'Prospects', titel: 'Prospects zonder e-mailadres', icoon: 'Mail', basis: 'prospects', filter: { bereikbaarheid: 'zonderEmail' }, filterVraagtAlles: true,
    uitleg: 'Zonder e-mailadres stuur je geen bevestiging, geen briefing en geen opvolging na een gesprek.' },
  { sleutel: 'zonderWebsite', ontbreekt: 'Website', groep: 'Prospects', titel: 'Prospects zonder website', icoon: 'Globe', basis: 'prospects',
    uitleg: 'Agents lezen de website voor het dossier en de aanleidingen. Zonder website blijft het dossier leeg.' },
  { sleutel: 'zonderBranche', ontbreekt: 'Branche', groep: 'Prospects', titel: 'Prospects zonder branche', icoon: 'Briefcase', basis: 'prospects',
    uitleg: 'De branche bepaalt welk verhaal, welk script en welke doelgroep past. Zonder branche krijg je algemene adviezen.' },
  { sleutel: 'zonderKlasse', ontbreekt: 'Klasse', groep: 'Prospects', titel: 'Prospects zonder klasse', icoon: 'Star', basis: 'prospects', filter: { klasse: 'geen' },
    uitleg: 'De klasse bepaalt het ritme en de volgorde in je bellijst. Zonder klasse krijgt een goede prospect te weinig aandacht.' },
  { sleutel: 'zonderEigenaar', ontbreekt: 'Eigenaar', groep: 'Prospects', titel: 'Prospects zonder eigenaar', icoon: 'Users', basis: 'onbeheerd', alleenManager: true,
    uitleg: 'Een prospect zonder eigenaar belt niemand. Wijs hem toe of parkeer hem bewust.' },
  { sleutel: 'dubbel', ontbreekt: 'Mogelijk dubbel', groep: 'Prospects', titel: 'Mogelijk dubbele accounts', icoon: 'Copy', basis: 'accounts',
    uitleg: 'Twee accounts met hetzelfde domein of KvK-nummer splitsen je geschiedenis en laten collega\'s dubbel bellen. Voeg ze samen.' },
  { sleutel: 'zonderReis', ontbreekt: 'Reis of fase', groep: 'Prospects', titel: 'Prospects zonder reis of fase', icoon: 'Route', basis: 'prospects',
    uitleg: 'Zonder reis en fase zet de motor geen volgende stap klaar en telt het account niet mee in de funnel.' },
  { sleutel: 'geenContact90', ontbreekt: 'Recent contact', groep: 'Prospects', titel: 'Langer dan 90 dagen geen contact', icoon: 'Clock', basis: 'prospects', filter: { laatsteContact: '90' }, filterVraagtAlles: true,
    uitleg: 'Na drie maanden stilte ben je vergeten. Bel opnieuw, of parkeer het account met een terugkomdatum.' },
  { sleutel: 'contactZonderFunctie', ontbreekt: 'Functie of rol', groep: 'Contacten', titel: 'Contacten zonder functie of rol', icoon: 'Users', basis: 'contacten',
    uitleg: 'Zonder functie en rol in het buying committee weet je niet wie beslist, wie beïnvloedt en wie de deur dichthoudt.' },
  { sleutel: 'contactZonderConsent', ontbreekt: 'Toestemming voor mail', groep: 'Contacten', titel: 'Contacten zonder toestemming voor mail', icoon: 'ShieldCheck', basis: 'contactenMetMail',
    uitleg: 'Een e-mailadres zonder vastgelegde toestemming mag niet in een mailcampagne. Leg vast of je mag mailen en waar dat vandaan komt.' },
  { sleutel: 'takenZonderDatum', ontbreekt: 'Vervaldatum', groep: 'Taken en afspraken', titel: 'Open taken zonder vervaldatum', icoon: 'ListTodo', basis: 'taken',
    uitleg: 'Een taak zonder datum komt nooit op Vandaag en blijft liggen. Geef hem een dag of rond hem af.' },
  { sleutel: 'afsprakenZonderVerslag', ontbreekt: 'Verslag', groep: 'Taken en afspraken', titel: 'Afgelopen afspraken zonder verslag', icoon: 'FileText', basis: 'afspraken',
    uitleg: 'Zonder verslag weet je collega of DealDrive niet wat er besproken is, en de overdracht mist zijn onderbouwing.' },
]

/** Eén regel in de flyout: naam, het account (bij een contact, taak of afspraak) of de plaats (bij een prospect), wat er ontbreekt en de link. */
export interface KwaliteitRij { id: string; naam: string; account: string | null; plaats: string | null; ontbreekt: string; link: string }

/** Het maximum aantal regels dat de flyout in één keer laadt. */
export const FLYOUT_MAX = 500

/** Een eigen veld dat meetelt in Datakwaliteit. */
export interface KwaliteitVeld { sleutel: string; naam: string; object: string; data?: { hulp?: string; datakwaliteit?: boolean } | null }

export const eigenVeldSleutel = (v: Pick<KwaliteitVeld, 'object' | 'sleutel'>): EigenVeldSleutel => `cf.${v.object === 'contact' ? 'contact' : 'account'}.${v.sleutel}`

/** De categorie "Zonder <veldnaam>" voor een eigen veld van een account (prospects) of een contact. */
export function eigenVeldCategorie(v: KwaliteitVeld): Omit<KwaliteitCategorie, 'sleutel'> & { sleutel: EigenVeldSleutel; eigenVeld: string } {
  const contact = v.object === 'contact'
  return {
    sleutel: eigenVeldSleutel(v), eigenVeld: v.sleutel, groep: contact ? 'Contacten' : 'Prospects', titel: `Zonder ${v.naam}`, icoon: 'SlidersHorizontal',
    basis: contact ? 'contacten' : 'prospects', ontbreekt: v.naam,
    uitleg: v.data?.hulp?.trim() || `Het eigen veld ${v.naam} is leeg bij deze ${contact ? 'contacten' : 'prospects'}. Jullie beheerder liet dit veld meetellen in Datakwaliteit.`,
  }
}

/** Telt een eigen veld mee? Alleen account- en contactvelden die niet gearchiveerd zijn. */
export const teltMee = (v: KwaliteitVeld & { gearchiveerd?: boolean | null }) => !!v.data?.datakwaliteit && !v.gearchiveerd && (v.object === 'account' || v.object === 'contact')

export const KWALITEIT_GROEPEN: readonly KwaliteitGroep[] = ['Prospects', 'Contacten', 'Taken en afspraken']

/** Score: het deel van alle controles dat klopt, in hele procenten. Zonder controles is de score 100. */
export function kwaliteitScore(rijen: { aantal: number; noemer: number }[]): number {
  const noemer = rijen.reduce((s, r) => s + Math.max(0, r.noemer), 0)
  if (!noemer) return 100
  const gaten = rijen.reduce((s, r) => s + Math.min(Math.max(0, r.aantal), Math.max(0, r.noemer)), 0)
  return Math.round((1 - gaten / noemer) * 100)
}

/** Het eigenaarsfilter op /prospects/alle dat past bij wat je op Datakwaliteit ziet. */
export function eigenaarFilter(rol: string): 'mij' | 'team' | 'iedereen' {
  if (rol === 'salesmanager') return 'team'
  if (rol === 'beheerder' || rol === 'founder') return 'iedereen'
  return 'mij'
}

/** De link naar de gefilterde prospectlijst, of null als er geen passend filter is. */
export function filterLink(c: Pick<KwaliteitCategorie, 'filter' | 'filterVraagtAlles'>, rol: string, alleFilters: boolean): string | null {
  if (!c.filter || (c.filterVraagtAlles && !alleFilters)) return null
  const e = eigenaarFilter(rol)
  const q = new URLSearchParams({ ...(e === 'mij' ? {} : { eigenaar: e }), ...c.filter })
  return `/prospects/alle?${q.toString()}`
}
