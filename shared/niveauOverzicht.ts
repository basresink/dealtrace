// Leesoverzicht voor de beheerder (Instellingen, Niveaus): welke functie bij Beginner, Gevorderd en Expert
// hoort en wat in deze organisatie aanstaat, en "Wie mag wat" per rol. Alleen lezen: de indeling per niveau
// zet de founder (B18), de rechtenmatrix staat vast in shared/permissions.ts.
import { FUNCTIES, aanVoorNiveau, featureGroep, pakketBevat } from './functies'
import { MATRIX, ONDERDELEN, type Actie, type Onderdeel, type Scope } from './permissions'
import { NIVEAUS, type FunctieRegel, type Niveau, type OrganisatieContext, type Pakket, type Rol } from './types'

export interface NiveauCel { aan: boolean; afwijking: boolean }
export interface NiveauFunctie {
  sleutel: string
  naam: string
  groep: string
  pakket: Pakket
  inPakket: boolean
  /** null: voor iedereen op niveau; anders de rollen die hem los van het niveau hebben. */
  alleenVoor: Rol[] | null
  cellen: Record<Niveau, NiveauCel>
}

/** Groepnaam zonder het featurenummer ("F14 Agents en mandaten" wordt "Agents en mandaten"). */
export const groepNaam = (g: string) => g.replace(/^F\d+\s+/, '')

export function niveauOverzicht(organisatie: OrganisatieContext, stand: FunctieRegel[]) {
  const functies: NiveauFunctie[] = []
  for (const f of FUNCTIES) {
    if (f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')) continue
    const alleenVoor = f.rollen === 'iedereen' ? null : f.rollen.filter((r) => r !== 'founder')
    const cellen = Object.fromEntries(NIVEAUS.map((n) => [n, {
      aan: aanVoorNiveau(f.sleutel, n, organisatie, stand),
      afwijking: stand.some((r) => r.functie === f.sleutel && r.niveau === n && r.organisationId === organisatie.id),
    }])) as Record<Niveau, NiveauCel>
    functies.push({ sleutel: f.sleutel, naam: f.naam, groep: groepNaam(featureGroep(f.sleutel)), pakket: f.pakket, inPakket: pakketBevat(organisatie, f), alleenVoor, cellen })
  }
  // Wat een accountmanager op elk niveau heeft: functies voor iedereen, in het pakket, aan op dat niveau.
  const opNiveau = functies.filter((f) => !f.alleenVoor && f.inPakket)
  const tellingen = Object.fromEntries(NIVEAUS.map((n) => [n, organisatie.iedereenAlles ? opNiveau.length : opNiveau.filter((f) => f.cellen[n].aan).length])) as Record<Niveau, number>
  const groepen = [...new Set(functies.map((f) => f.groep))].sort((a, b) => a.localeCompare(b, 'nl'))
    .map((groep) => ({ groep, functies: functies.filter((f) => f.groep === groep) }))
  return {
    iedereenAlles: organisatie.iedereenAlles,
    totaal: opNiveau.length,
    tellingen,
    afwijkingen: functies.reduce((n, f) => n + NIVEAUS.filter((v) => f.cellen[v].afwijking).length, 0),
    groepen,
  }
}

export const ONDERDEEL_LABEL: Record<Onderdeel, string> = {
  prospects: 'Prospects en klanten', leads: 'Leads', reizen: 'Prospectreizen', campagnes: 'Campagnes', taken: 'Taken', afspraken: 'Afspraken',
  activiteiten: 'Activiteiten (toevoegen)', belscripts: 'Belscripts', eigenVelden: 'Eigen velden', regels: 'Regels', coaching: 'Coaching',
  mandaten: 'Agents en mandaten', gebruikers: 'Gebruikers', abonnement: 'Abonnement', platform: 'Platformbeheer', instellingen: 'Instellingen',
  notificaties: 'Meldingen', persoonlijk: 'Persoonlijke instellingen',
}
export const ROLLEN_KLANT = ['accountmanager', 'salesmanager', 'beheerder'] as const
export const ROL_LABEL_KLANT: Record<(typeof ROLLEN_KLANT)[number], string> = { accountmanager: 'Accountmanager', salesmanager: 'Salesmanager', beheerder: 'Beheerder' }
const ACTIE_LABEL: Record<Actie, string> = { lezen: 'lezen', schrijven: 'wijzigen', verwijderen: 'verwijderen', beheren: 'beheren' }
const SCOPE_LABEL: Record<Exclude<Scope, 'geen'>, string> = { alles: 'alles', team: 'eigen teams', eigen: 'alleen eigen' }

/** Eén zin per rol en onderdeel, bijvoorbeeld "Lezen: alles. Wijzigen: alleen eigen." */
export function rechtTekst(rij: Partial<Record<Actie, Scope>>): string {
  const delen: string[] = []
  for (const scope of ['alles', 'team', 'eigen'] as const) {
    const acties = (Object.keys(ACTIE_LABEL) as Actie[]).filter((a) => rij[a] === scope).map((a) => ACTIE_LABEL[a])
    if (!acties.length) continue
    const wat = acties.length > 1 ? `${acties.slice(0, -1).join(', ')} en ${acties[acties.length - 1]}` : acties[0]!
    delen.push(`${wat.charAt(0).toUpperCase()}${wat.slice(1)}: ${SCOPE_LABEL[scope]}.`)
  }
  return delen.length ? delen.join(' ') : 'Geen toegang.'
}

export function wieMagWat() {
  return ONDERDELEN.filter((o) => o !== 'platform').map((o) => ({
    onderdeel: o,
    label: ONDERDEEL_LABEL[o],
    perRol: Object.fromEntries(ROLLEN_KLANT.map((r) => [r, rechtTekst(MATRIX[o][r])])) as Record<(typeof ROLLEN_KLANT)[number], string>,
  }))
}
