// Datakwaliteit: de gaten in de gegevens van accounts, contacten, taken en afspraken die je mag zien.
// Eén definitie voor de API, het scherm en de tests. De score is het deel van alle controles dat klopt.

export type KwaliteitGroep = 'Prospects' | 'Contacten' | 'Taken en afspraken'

export type KwaliteitSleutel =
  | 'zonderBeslisser' | 'zonderTelefoon' | 'zonderEmail' | 'zonderWebsite' | 'zonderBranche' | 'zonderKlasse'
  | 'zonderEigenaar' | 'dubbel' | 'zonderReis' | 'geenContact90'
  | 'contactZonderFunctie' | 'contactZonderConsent'
  | 'takenZonderDatum' | 'afsprakenZonderVerslag'

/** Waar de noemer van een categorie op rust. */
export type Basis = 'prospects' | 'accounts' | 'onbeheerd' | 'contacten' | 'contactenMetMail' | 'taken' | 'afspraken'

export interface KwaliteitCategorie {
  sleutel: KwaliteitSleutel
  groep: KwaliteitGroep
  titel: string
  uitleg: string
  icoon: string
  basis: Basis
  /** Filter op /prospects/alle; zonder filter klapt de kaart een lijst uit. */
  filter?: Record<string, string>
  /** Het filter vraagt "Alle filters" (prospects.filtersAlle). */
  filterVraagtAlles?: boolean
  /** Alleen voor salesmanager en beheerder. */
  alleenManager?: boolean
}

export const KWALITEIT_CATEGORIEEN: readonly KwaliteitCategorie[] = [
  { sleutel: 'zonderBeslisser', groep: 'Prospects', titel: 'Prospects zonder beslisser', icoon: 'UserX', basis: 'prospects', filter: { bereikbaarheid: 'zonderBeslisser' }, filterVraagtAlles: true,
    uitleg: 'Zonder beslisser praat je met mensen die geen ja kunnen zeggen. Zoek wie tekent en leg hem vast.' },
  { sleutel: 'zonderTelefoon', groep: 'Prospects', titel: 'Prospects zonder telefoonnummer', icoon: 'PhoneOff', basis: 'prospects', filter: { bereikbaarheid: 'zonderTelefoon' }, filterVraagtAlles: true,
    uitleg: 'Wie je niet kunt bellen, valt uit je belblok en uit het hercontactritme.' },
  { sleutel: 'zonderEmail', groep: 'Prospects', titel: 'Prospects zonder e-mailadres', icoon: 'Mail', basis: 'prospects', filter: { bereikbaarheid: 'zonderEmail' }, filterVraagtAlles: true,
    uitleg: 'Zonder e-mailadres stuur je geen bevestiging, geen briefing en geen opvolging na een gesprek.' },
  { sleutel: 'zonderWebsite', groep: 'Prospects', titel: 'Prospects zonder website', icoon: 'Globe', basis: 'prospects',
    uitleg: 'Agents lezen de website voor het dossier en de aanleidingen. Zonder website blijft het dossier leeg.' },
  { sleutel: 'zonderBranche', groep: 'Prospects', titel: 'Prospects zonder branche', icoon: 'Briefcase', basis: 'prospects',
    uitleg: 'De branche bepaalt welk verhaal, welk script en welke doelgroep past. Zonder branche krijg je algemene adviezen.' },
  { sleutel: 'zonderKlasse', groep: 'Prospects', titel: 'Prospects zonder klasse', icoon: 'Star', basis: 'prospects', filter: { klasse: 'geen' },
    uitleg: 'De klasse bepaalt het ritme en de volgorde in je bellijst. Zonder klasse krijgt een goede prospect te weinig aandacht.' },
  { sleutel: 'zonderEigenaar', groep: 'Prospects', titel: 'Prospects zonder eigenaar', icoon: 'Users', basis: 'onbeheerd', alleenManager: true,
    uitleg: 'Een prospect zonder eigenaar belt niemand. Wijs hem toe of parkeer hem bewust.' },
  { sleutel: 'dubbel', groep: 'Prospects', titel: 'Mogelijk dubbele accounts', icoon: 'Copy', basis: 'accounts',
    uitleg: 'Twee accounts met hetzelfde domein of KvK-nummer splitsen je geschiedenis en laten collega\'s dubbel bellen. Voeg ze samen.' },
  { sleutel: 'zonderReis', groep: 'Prospects', titel: 'Prospects zonder reis of fase', icoon: 'Route', basis: 'prospects',
    uitleg: 'Zonder reis en fase zet de motor geen volgende stap klaar en telt het account niet mee in de funnel.' },
  { sleutel: 'geenContact90', groep: 'Prospects', titel: 'Langer dan 90 dagen geen contact', icoon: 'Clock', basis: 'prospects', filter: { laatsteContact: '90' }, filterVraagtAlles: true,
    uitleg: 'Na drie maanden stilte ben je vergeten. Bel opnieuw, of parkeer het account met een terugkomdatum.' },
  { sleutel: 'contactZonderFunctie', groep: 'Contacten', titel: 'Contacten zonder functie of rol', icoon: 'Users', basis: 'contacten',
    uitleg: 'Zonder functie en rol in het buying committee weet je niet wie beslist, wie beïnvloedt en wie de deur dichthoudt.' },
  { sleutel: 'contactZonderConsent', groep: 'Contacten', titel: 'Contacten zonder toestemming voor mail', icoon: 'ShieldCheck', basis: 'contactenMetMail',
    uitleg: 'Een e-mailadres zonder vastgelegde toestemming mag niet in een mailcampagne. Leg vast of je mag mailen en waar dat vandaan komt.' },
  { sleutel: 'takenZonderDatum', groep: 'Taken en afspraken', titel: 'Open taken zonder vervaldatum', icoon: 'ListTodo', basis: 'taken',
    uitleg: 'Een taak zonder datum komt nooit op Vandaag en blijft liggen. Geef hem een dag of rond hem af.' },
  { sleutel: 'afsprakenZonderVerslag', groep: 'Taken en afspraken', titel: 'Afgelopen afspraken zonder verslag', icoon: 'FileText', basis: 'afspraken',
    uitleg: 'Zonder verslag weet je collega of DealDrive niet wat er besproken is, en de overdracht mist zijn onderbouwing.' },
]

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

/** De link naar de gefilterde prospectlijst, of null als de kaart een eigen lijst toont. */
export function filterLink(c: KwaliteitCategorie, rol: string, alleFilters: boolean): string | null {
  if (!c.filter || (c.filterVraagtAlles && !alleFilters)) return null
  const e = eigenaarFilter(rol)
  const q = new URLSearchParams({ ...(e === 'mij' ? {} : { eigenaar: e }), ...c.filter })
  return `/prospects/alle?${q.toString()}`
}
