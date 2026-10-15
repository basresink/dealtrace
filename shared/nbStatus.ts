// De statusmachine per account (bouwplan 7.2, 7.3). Dit is de enige plek waar
// status en fase samen veranderen (gat 16): het meldpunt vraagt hier de nieuwe
// status op, naast volgendeFase uit shared/reis.ts.

export const NB_STATUSSEN = ['nieuw', 'in reis', 'wachtend', 'nee', 'gescoord', 'overgedragen'] as const
export type NbStatus = typeof NB_STATUSSEN[number]

/** Vaste gebeurtenissencatalogus (F05). Alleen deze zijn kiesbaar in een overgang. */
export const GEBEURTENISSEN = [
  'lead-overgenomen', 'import', 'dossier-compleet', 'gekwalificeerd', 'eerste-contact', 'gesprek-gevoerd',
  'eerste-afspraak-gepland', 'eerste-afspraak-gehouden', 'afspraak-niet-verschenen', 'overgedragen', 'geen-vervolg',
  'geparkeerd', 'heropvolging', 'handmatig',
] as const
export type Gebeurtenis = typeof GEBEURTENISSEN[number]

/** Uitkomsten van een poging (7.3); ritmestappen zelf zijn P07. */
export const UITKOMSTEN = ['afspraak', 'later', 'geen_reactie', 'voicemail', 'nieuw_contact', 'niet_geschikt', 'geen_interesse'] as const
export type Uitkomst = typeof UITKOMSTEN[number]

/** Handelingen op de kaart die alleen de status raken. */
export type Handeling = 'nee' | 'pauzeer'

export const GEBEURTENIS_LABEL: Record<Gebeurtenis, string> = {
  'lead-overgenomen': 'Lead overgenomen', import: 'Import', 'dossier-compleet': 'Dossier compleet', gekwalificeerd: 'Gekwalificeerd',
  'eerste-contact': 'Eerste contact', 'gesprek-gevoerd': 'Gesprek gevoerd', 'eerste-afspraak-gepland': 'Eerste afspraak gepland',
  'eerste-afspraak-gehouden': 'Eerste afspraak gehouden', 'afspraak-niet-verschenen': 'Niet verschenen of geannuleerd',
  overgedragen: 'Overgedragen', 'geen-vervolg': 'Geen vervolg', geparkeerd: 'Geparkeerd', heropvolging: 'Heropvolging', handmatig: 'Handmatig',
}

export function isGebeurtenis(v: unknown): v is Gebeurtenis {
  return typeof v === 'string' && (GEBEURTENISSEN as readonly string[]).includes(v)
}

export interface StatusContext {
  /** Bij `handmatig`: de hoofdfase en eindsoort van de fase waar het account naartoe gaat. */
  naarHoofdfase?: string
  naarEind?: 'overgedragen' | 'verloren' | null
}

/**
 * De nieuwe status na een gebeurtenis, uitkomst of handeling (tabel 7.2).
 * `overgedragen` blijft `overgedragen`; terugkomst gaat alleen via een
 * terugkomregel (winback). Een onbekende combinatie geeft de huidige status.
 */
export function volgendeStatus(status: string, wat: Gebeurtenis | Uitkomst | Handeling, context: StatusContext = {}): string {
  if (status === 'overgedragen' || status === 'klant') return status
  switch (wat) {
    case 'lead-overgenomen':
    case 'import':
      return status
    case 'gekwalificeerd':
      return status === 'nieuw' ? 'in reis' : status
    case 'eerste-contact':
    case 'gesprek-gevoerd':
      return status === 'nieuw' ? 'in reis' : status
    case 'eerste-afspraak-gepland':
    case 'afspraak':
      return ['nieuw', 'in reis', 'wachtend', 'nee'].includes(status) ? 'gescoord' : status
    case 'eerste-afspraak-gehouden':
      return status === 'gescoord' ? 'gescoord' : status
    case 'afspraak-niet-verschenen':
      return status === 'gescoord' ? 'in reis' : status
    case 'overgedragen':
      return status === 'gescoord' ? 'overgedragen' : status
    case 'geen-vervolg':
      return status === 'gescoord' ? 'nee' : status
    case 'geparkeerd':
    case 'later':
    case 'pauzeer':
      return ['nieuw', 'in reis'].includes(status) ? 'wachtend' : status
    case 'heropvolging':
      return ['wachtend', 'nee'].includes(status) ? 'in reis' : status
    case 'niet_geschikt':
    case 'geen_interesse':
    case 'nee':
      return ['nieuw', 'in reis', 'wachtend', 'gescoord'].includes(status) ? 'nee' : status
    case 'handmatig': {
      // Fase corrigeren: de status volgt de hoofdfase waar het account terechtkomt.
      if (context.naarEind === 'overgedragen') return status === 'gescoord' ? 'overgedragen' : status
      if (context.naarEind === 'verloren') return status === 'nee' || status === 'wachtend' ? status : 'nee'
      if (context.naarHoofdfase === 'verbinden') return 'gescoord'
      if (context.naarHoofdfase === 'bewerken') return status === 'nieuw' || status === 'gescoord' ? 'in reis' : status
      if (context.naarHoofdfase === 'vinden') return status === 'gescoord' ? 'in reis' : status
      return status
    }
    default:
      return status
  }
}

// ---------------------------------------------------------------------------
// Nee, afkoelperiode en benaderen
// ---------------------------------------------------------------------------

export const KANALEN = ['bellen', 'mail', 'linkedin', 'whatsapp', 'bezoek', 'kaart'] as const
export type Kanaal = typeof KANALEN[number]
export type Afkoeling = Record<Kanaal, number>

export const KANAAL_LABEL: Record<Kanaal, string> = { bellen: 'Bellen', mail: 'Mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', bezoek: 'Bezoek', kaart: 'Kaart' }

/** Standaard afkoelperiode in dagen (7.2); instelbaar per organisatie (org_settings 'afkoeling'). */
export const AFKOELING_STANDAARD: Afkoeling = { bellen: 90, mail: 60, linkedin: 90, whatsapp: 180, bezoek: 180, kaart: 365 }

export const NEE_REDENEN = [
  'Geen behoefte', 'Tevreden met huidige leverancier', 'Geen budget', 'Verkeerd moment', 'Niet de beslisser', 'Niet geschikt', 'Anders',
] as const
export type NeeReden = typeof NEE_REDENEN[number]

export function isNeeReden(v: unknown): v is NeeReden {
  return typeof v === 'string' && (NEE_REDENEN as readonly string[]).includes(v)
}

/** De afkoelperiode bij een nee: "Niet geschikt" is 365 dagen voor elk kanaal. */
export function afkoelingVoorNee(reden: string, instelling: Partial<Afkoeling> = {}): Afkoeling {
  if (reden === 'Niet geschikt') return Object.fromEntries(KANALEN.map((k) => [k, 365])) as Afkoeling
  return { ...AFKOELING_STANDAARD, ...instelling }
}

export interface NeeGegevens {
  reden: string
  toelichting?: string
  verlorenAan?: string | null
  op: string
  door?: string
  afkoeling: Partial<Afkoeling>
}

export interface BenaderAccount {
  nbStatus: string
  data?: { nee?: NeeGegevens | null; wachtendTot?: string | null } | null
}

const DAG = 24 * 3600 * 1000
const dagNummer = (t: Date | string) => Math.floor(Date.parse(typeof t === 'string' ? t : t.toISOString()) / DAG)

/** Eerste dag waarop het kanaal weer mag (YYYY-MM-DD), of null zonder afkoeling. */
export function afkoelingTot(nee: NeeGegevens | null | undefined, kanaal: Kanaal): string | null {
  if (!nee) return null
  const dagen = nee.afkoeling?.[kanaal]
  if (dagen === undefined || dagen === null) return null
  return new Date((dagNummer(nee.op) + dagen) * DAG).toISOString().slice(0, 10)
}

/**
 * Loopt de afkoelperiode voor dit kanaal nog? Op dag `op + dagen` mag het weer;
 * de dag ervoor (de laatste dag) nog niet. Alleen bij status nee.
 */
export function cooldownActief(account: BenaderAccount, kanaal: Kanaal, nu: Date): boolean {
  if (account.nbStatus !== 'nee') return false
  const tot = afkoelingTot(account.data?.nee, kanaal)
  return !!tot && dagNummer(nu) < dagNummer(tot)
}

/** Mag je dit account nu via dit kanaal benaderen? Gecontroleerd vóór elke poging. */
export function magBenaderen(account: BenaderAccount, kanaal: Kanaal, nu: Date, opties: { belMeNiet?: boolean } = {}): { mag: boolean; reden?: string } {
  if (account.nbStatus === 'overgedragen') return { mag: false, reden: 'Overgedragen; het vervolg loopt in DealDrive of het CRM' }
  if (cooldownActief(account, kanaal, nu)) {
    return { mag: false, reden: `Afkoelperiode ${KANAAL_LABEL[kanaal].toLowerCase()} tot ${afkoelingTot(account.data?.nee, kanaal)}` }
  }
  const tot = account.data?.wachtendTot
  if (account.nbStatus === 'wachtend' && tot && dagNummer(nu) < dagNummer(tot)) return { mag: false, reden: `Wachtend tot ${tot.slice(0, 10)}` }
  if (kanaal === 'bellen' && opties.belMeNiet) return { mag: false, reden: 'Staat op bel-me-niet' }
  return { mag: true }
}
