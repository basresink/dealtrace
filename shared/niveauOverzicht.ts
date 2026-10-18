// Instellingen, Niveaus: per functie en niveau of hij aanstaat in deze organisatie, en "Wie mag wat" per rol.
// De beheerder zet per functie en niveau aan of uit (keuzes in org_settings 'functieKeuzes'); de standaard is
// de stand van Dealtrace (functies_per_niveau, beginstand startNiveau). Grenzen die blijven: het pakket, de rol
// (een rolfunctie hangt niet af van het niveau) en een uitzetting door Dealtrace. De rechtenmatrix staat vast
// in shared/permissions.ts.
import { FUNCTIES, aanVoorNiveau, featureGroep, founderUit, functie, niveauAan, pakketBevat } from './functies'
import { MATRIX, ONDERDELEN, type Actie, type Onderdeel, type Scope } from './permissions'
import { NIVEAUS, type FunctieRegel, type Niveau, type OrganisatieContext, type Pakket, type Rol } from './types'

export type FunctieKeuzes = NonNullable<OrganisatieContext['keuzes']>

export interface NiveauCel {
  /** Staat aan voor dit niveau in deze organisatie (standaard, keuze en uitzetting door Dealtrace samen). */
  aan: boolean
  /** Een regel van Dealtrace voor alleen deze organisatie. */
  afwijking: boolean
  /** Wat Dealtrace standaard aanzet. */
  standaard: boolean
  /** De keuze van de beheerder, of null als de standaard geldt. */
  keuze: boolean | null
  /** Dealtrace zette hem uit: de keuze van de organisatie telt niet. */
  founderUit: boolean
}
export interface NiveauFunctie {
  sleutel: string
  naam: string
  groep: string
  pakket: Pakket
  inPakket: boolean
  /** null: voor iedereen op niveau; anders de rollen die hem los van het niveau hebben. */
  alleenVoor: Rol[] | null
  /** Rollen voor wie hij los van het niveau aanstaat (bijvoorbeeld de salesmanager). */
  altijdVoor: Rol[]
  /** Een niveaufunctie in het pakket: de beheerder kan hem per niveau aan of uit zetten. */
  schakelbaar: boolean
  /** Minstens één niveau wijkt af van de standaard door een keuze van de beheerder. */
  aangepast: boolean
  cellen: Record<Niveau, NiveauCel>
}

/** Groepnaam zonder het featurenummer ("F14 Agents en mandaten" wordt "Agents en mandaten"). */
export const groepNaam = (g: string) => g.replace(/^F\d+\s+/, '')

const isNiveau = (n: unknown): n is Niveau => typeof n === 'string' && (NIVEAUS as readonly string[]).includes(n)

/** Alleen geldige keuzes uit org_settings: bekende niveaufunctie, bekend niveau, aan of uit. */
export function schoneKeuzes(waarde: unknown): FunctieKeuzes {
  const uit: FunctieKeuzes = {}
  if (!waarde || typeof waarde !== 'object' || Array.isArray(waarde)) return uit
  for (const [sleutel, cellen] of Object.entries(waarde as Record<string, unknown>)) {
    const f = functie(sleutel)
    if (!f || f.rollen !== 'iedereen' || !cellen || typeof cellen !== 'object') continue
    for (const [n, aan] of Object.entries(cellen as Record<string, unknown>)) {
      if (isNiveau(n) && typeof aan === 'boolean') (uit[sleutel] ??= {})[n] = aan
    }
  }
  return uit
}

/** Waarom deze keuze niet kan, of null als hij mag. Aanzetten buiten het pakket of na een uitzetting door Dealtrace kan niet; een rolfunctie hangt niet af van het niveau. */
export function keuzeFout(sleutel: string, niveau: string, aan: unknown, organisatie: OrganisatieContext, stand: FunctieRegel[]): { status: number; tekst: string } | null {
  const f = functie(sleutel)
  if (!f || (f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')) || !isNiveau(niveau) || typeof aan !== 'boolean') return { status: 422, tekst: 'Onbekende functie of niveau' }
  if (f.rollen !== 'iedereen') return { status: 422, tekst: 'Deze functie hoort bij een rol en hangt niet af van het niveau' }
  if (aan && !pakketBevat(organisatie, f)) return { status: 422, tekst: 'Deze functie zit niet in jullie pakket' }
  if (aan && founderUit(sleutel, niveau, organisatie, stand)) return { status: 409, tekst: 'Dealtrace heeft deze functie uitgezet' }
  return null
}

/** De nieuwe keuzes na één schakelaar: gelijk aan de standaard betekent geen keuze meer. */
export function zetKeuze(keuzes: FunctieKeuzes, sleutel: string, niveau: Niveau, aan: boolean, organisatie: Pick<OrganisatieContext, 'id'>, stand: FunctieRegel[]): FunctieKeuzes {
  const uit: FunctieKeuzes = JSON.parse(JSON.stringify(keuzes ?? {}))
  const cel = { ...(uit[sleutel] ?? {}) }
  if (aan === aanVoorNiveau(sleutel, niveau, organisatie, stand)) delete cel[niveau]
  else cel[niveau] = aan
  if (Object.keys(cel).length) uit[sleutel] = cel
  else delete uit[sleutel]
  return uit
}

/** Aantal cellen dat door een keuze van de beheerder afwijkt van de standaard. */
export function aantalKeuzes(keuzes: FunctieKeuzes | undefined): number {
  return Object.values(keuzes ?? {}).reduce((n, c) => n + Object.keys(c).length, 0)
}

export function niveauOverzicht(organisatie: OrganisatieContext, stand: FunctieRegel[]) {
  const functies: NiveauFunctie[] = []
  for (const f of FUNCTIES) {
    if (f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')) continue
    const alleenVoor = f.rollen === 'iedereen' ? null : f.rollen.filter((r) => r !== 'founder')
    const inPakket = pakketBevat(organisatie, f)
    const cellen = Object.fromEntries(NIVEAUS.map((n) => {
      const standaard = aanVoorNiveau(f.sleutel, n, organisatie, stand)
      const k = alleenVoor ? undefined : organisatie.keuzes?.[f.sleutel]?.[n]
      return [n, {
        aan: niveauAan(f.sleutel, n, alleenVoor ? { id: organisatie.id } : organisatie, stand),
        afwijking: stand.some((r) => r.functie === f.sleutel && r.niveau === n && r.organisationId === organisatie.id),
        standaard,
        keuze: typeof k === 'boolean' && k !== standaard ? k : null,
        founderUit: founderUit(f.sleutel, n, organisatie, stand),
      }]
    })) as Record<Niveau, NiveauCel>
    functies.push({
      sleutel: f.sleutel, naam: f.naam, groep: groepNaam(featureGroep(f.sleutel)), pakket: f.pakket, inPakket, alleenVoor,
      altijdVoor: [...(f.altijdVoor ?? [])], schakelbaar: !alleenVoor && inPakket,
      aangepast: NIVEAUS.some((n) => cellen[n].keuze !== null && !cellen[n].founderUit), cellen,
    })
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
    /** Cellen waarin de keuze van de beheerder afwijkt van de standaard. */
    keuzes: functies.reduce((n, f) => n + NIVEAUS.filter((v) => f.cellen[v].keuze !== null && !f.cellen[v].founderUit).length, 0),
    groepen,
  }
}

/** Wat GET /api/instellingen/niveaus en de schakelaars teruggeven (zonder de rechten). */
export type NiveauOverzicht = ReturnType<typeof niveauOverzicht>

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
