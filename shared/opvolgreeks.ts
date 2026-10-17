// Opvolgreeksen (F7): na een uitkomst als "stuur informatie" of "voicemail" een reeks van mail, LinkedIn en een
// belmoment, die vanzelf stopt zodra de prospect reageert. De startsjablonen staan hier één keer (gat 16); elke
// organisatie krijgt ze als rijen in reekssjablonen (migratie 0058). Alles hier is puur: `nu` gaat mee.
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, voegWerkdagenToe, volgendeWerkdag, volgendWerkmoment, weekdag, type WerkdagInstelling } from './datum'

export const REEKS_KANALEN = ['mail', 'linkedin', 'bellen'] as const
export type ReeksKanaal = typeof REEKS_KANALEN[number]
export const REEKS_KANAAL_LABEL: Record<ReeksKanaal | 'einde', string> = { mail: 'Mail', linkedin: 'LinkedIn', bellen: 'Bellen', einde: 'Einde' }
/** Het actietype van de taak per kanaal (shared/taken.ts). */
export const REEKS_ACTIE: Record<ReeksKanaal, string> = { mail: 'mailen', linkedin: 'linkedin', bellen: 'bellen' }

/** Een stap van een sjabloon: dag, kanaal, titel van de taak, en voor de Schrijver een onderwerp en een instructie. */
export interface SjabloonStap { dag: number; kanaal: ReeksKanaal; titel: string; onderwerp?: string; instructie?: string }

/** De uitkomsten in Rond af en de belmodus waarbij een reeks kan starten (migratie 0065, reekssjablonen.uitkomsten). */
export const REEKS_UITKOMSTEN = ['informatie', 'voicemail', 'later'] as const
export type ReeksUitkomst = typeof REEKS_UITKOMSTEN[number]
export const REEKS_UITKOMST_LABEL: Record<ReeksUitkomst, string> = { informatie: 'Stuur informatie', voicemail: 'Voicemail ingesproken', later: 'Gesproken, later' }

/**
 * Stopregels per sjabloon. Een afmelding stopt altijd (wettelijk); de andere drie staan standaard aan en de beheerder
 * kan ze per sjabloon uitzetten. Een antwoord in de gekoppelde mailbox telt als reactie.
 */
export const STOPREGELS = ['reactie', 'afspraak', 'nee'] as const
export type Stopregel = typeof STOPREGELS[number]
export type Stopregels = Record<Stopregel, boolean>
export const STOPREGEL_LABEL: Record<Stopregel, string> = { reactie: 'Een reactie: antwoord in de mailbox, teruggebeld of een gelogde reactie', afspraak: 'Een geplande afspraak', nee: 'Een nee via het meldpunt of een uitkomst geen interesse' }
export const STANDAARD_STOPREGELS: Stopregels = { reactie: true, afspraak: true, nee: true }

export interface ReeksSjabloon {
  sleutel: string
  naam: string
  omschrijving: string
  /** De uitkomst waarna je deze reeks start. */
  na: string
  stappen: SjabloonStap[]
  /** Geen reactie: op deze dag terug naar het hercontactritme, met de volgende poging na `wachtDagen`. */
  einde: { dag: number; wachtDagen: number }
  /** Bij welke uitkomsten Rond af en de belmodus deze reeks voorstellen. */
  uitkomsten?: ReeksUitkomst[]
  stopregels?: Stopregels
}

export const STARTSJABLONEN: ReeksSjabloon[] = [
  {
    sleutel: 'na-informatie', naam: 'Na informatie', na: 'Stuur maar wat informatie',
    omschrijving: 'De beloofde informatie met het winpunt, een LinkedIn-connectie, een belmoment en een praktijkvoorbeeld.',
    stappen: [
      { dag: 0, kanaal: 'mail', titel: 'Mail: de beloofde informatie met het winpunt' },
      { dag: 3, kanaal: 'linkedin', titel: 'LinkedIn: connectieverzoek met een korte notitie' },
      { dag: 6, kanaal: 'bellen', titel: 'Bellen: heeft u de informatie kunnen bekijken?' },
      { dag: 10, kanaal: 'mail', titel: 'Mail: praktijkvoorbeeld uit dezelfde branche' },
    ],
    einde: { dag: 21, wachtDagen: 30 },
    uitkomsten: ['informatie'],
  },
  {
    sleutel: 'na-voicemail', naam: 'Na voicemail', na: 'Voicemail ingesproken',
    omschrijving: 'Een korte mail na je voicemail, een tweede belpoging op een ander uur, LinkedIn en een laatste vraag.',
    stappen: [
      { dag: 0, kanaal: 'mail', titel: 'Mail: kort bericht na je voicemail' },
      { dag: 2, kanaal: 'bellen', titel: 'Bellen: tweede poging op een ander uur' },
      { dag: 5, kanaal: 'linkedin', titel: 'LinkedIn: connectieverzoek met een korte notitie' },
      { dag: 9, kanaal: 'mail', titel: 'Mail: één korte vraag om af te sluiten' },
    ],
    einde: { dag: 16, wachtDagen: 30 },
    uitkomsten: ['voicemail'],
  },
  {
    sleutel: 'na-eerste-gesprek', naam: 'Na eerste gesprek', na: 'Eerste gesprek gevoerd',
    omschrijving: 'De samenvatting van het gesprek, een LinkedIn-connectie, een belmoment om de afspraak te plannen en een praktijkvoorbeeld.',
    stappen: [
      { dag: 0, kanaal: 'mail', titel: 'Mail: samenvatting en de afgesproken volgende stap' },
      { dag: 2, kanaal: 'linkedin', titel: 'LinkedIn: connectie met een verwijzing naar het gesprek' },
      { dag: 7, kanaal: 'bellen', titel: 'Bellen: stand van zaken en de afspraak plannen' },
      { dag: 14, kanaal: 'mail', titel: 'Mail: praktijkvoorbeeld bij wat jullie vertelden' },
    ],
    einde: { dag: 24, wachtDagen: 21 },
    uitkomsten: ['later'],
  },
]

export const REEKS_STATUSSEN = ['loopt', 'gepauzeerd', 'gestopt', 'klaar'] as const
export type ReeksStatus = typeof REEKS_STATUSSEN[number]
export const REEKS_STATUS_LABEL: Record<ReeksStatus, string> = { loopt: 'Loopt', gepauzeerd: 'Gepauzeerd', gestopt: 'Gestopt', klaar: 'Klaar' }

export const STAP_STATUSSEN = ['gepland', 'open', 'gedaan', 'overgeslagen', 'tegengehouden'] as const
export type StapStatus = typeof STAP_STATUSSEN[number]
export const STAP_STATUS_LABEL: Record<StapStatus, string> = { gepland: 'Gepland', open: 'Wacht op jou', gedaan: 'Klaar', overgeslagen: 'Overgeslagen', tegengehouden: 'Tegengehouden' }

export const STOPREDENEN = ['reactie', 'afspraak', 'nee', 'afmelding', 'handmatig'] as const
export type Stopreden = typeof STOPREDENEN[number]
export const STOPREDEN_LABEL: Record<Stopreden, string> = {
  reactie: 'De prospect reageerde', afspraak: 'Er staat een afspraak', nee: 'De prospect zei nee', afmelding: 'Het contact meldde zich af voor mail', handmatig: 'Je stopte de reeks',
}

/** Mandaat van een reeks: C keurt elke stap goed, B verstuurt mail binnen het goedgekeurde kader. */
export const REEKS_MANDATEN = ['B', 'C'] as const
export type ReeksMandaat = typeof REEKS_MANDATEN[number]
export const REEKS_MANDAAT_LABEL: Record<ReeksMandaat, string> = { C: 'Elke stap goedkeuren', B: 'Binnen kader' }

export interface GeplandeStap { volgnummer: number; dag: number; kanaal: ReeksKanaal | 'einde'; titel: string; instructie?: string | null; onderwerp?: string | null; geplandOp: string }
export interface ReeksStap extends GeplandeStap { id: string; status: StapStatus; taskId?: string | null; conceptId?: string | null; reden?: string | null }

/** Het moment van een dag in de reeks: dag 0 is nu (of het volgende werkmoment), daarna 09:00 op een werkdag. */
export function momentVoorDag(start: Date, dag: number, inst: WerkdagInstelling = {}): Date {
  if (dag <= 0) {
    const m = nlMoment(start)
    return isWerkdag(m.datum, inst) && m.uur >= 9 && m.uur < 18 ? start : volgendWerkmoment(start, inst)
  }
  return nlTijdstip(voegWerkdagenToe(plusDagen(nlMoment(start).datum, dag), 0, inst), 9)
}

/** Plan alle stappen van een sjabloon vanaf `start`, met als laatste stap het einde (terug naar het ritme). */
export function planReeks(s: Pick<ReeksSjabloon, 'stappen' | 'einde'>, start: Date, inst: WerkdagInstelling = {}): GeplandeStap[] {
  const stappen: GeplandeStap[] = [...s.stappen].sort((a, b) => a.dag - b.dag).map((x, i) => ({ volgnummer: i + 1, dag: x.dag, kanaal: x.kanaal, titel: x.titel, instructie: x.instructie ?? null, onderwerp: x.onderwerp ?? null, geplandOp: momentVoorDag(start, x.dag, inst).toISOString() }))
  stappen.push({ volgnummer: stappen.length + 1, dag: s.einde.dag, kanaal: 'einde', titel: `Geen reactie: terug naar het ritme, volgende poging na ${s.einde.wachtDagen} dagen`, geplandOp: momentVoorDag(start, s.einde.dag, inst).toISOString() })
  return stappen
}

/**
 * Concepten en taken komen een werkdag voor de stap klaar (de Schrijver schrijft vlak voor de verzenddag); dag 0 meteen
 * bij de start; het einde op het moment zelf.
 */
export function aanDeBeurt(stap: Pick<ReeksStap, 'status' | 'kanaal' | 'geplandOp'> & { dag?: number }, nu: Date, inst: WerkdagInstelling = {}): boolean {
  if (stap.status !== 'gepland') return false
  if (stap.kanaal === 'einde') return Date.parse(stap.geplandOp) <= nu.getTime()
  if (stap.dag === 0) return true
  return nlMoment(new Date(stap.geplandOp)).datum <= volgendeWerkdag(nlMoment(nu).datum, inst)
}

export interface ReactieSignalen {
  /** Afspraken op het account (aangemaakt na de start telt). */
  afspraken: { createdAt: string; status: string }[]
  nbStatus: string
  /** Is het contact van de reeks afgemeld voor mail (onderdrukkingslijst)? */
  afgemeld: boolean
  /** Contactmomenten door een mens op het account, met uitkomst. */
  momenten: { op: string; soort: string; uitkomst: string | null }[]
}

const REACTIE_UITKOMSTEN = new Set(['afspraak', 'later', 'gesproken', 'beantwoord', 'reactie'])
const NEE_UITKOMSTEN = new Set(['niet_geschikt', 'geen_interesse'])

/**
 * Stopt de reeks? Een afspraak, een nee, een afmelding of een gelogde reactie na de start (ook een antwoord in de
 * gekoppelde mailbox: soort reactie). De stopregels van het sjabloon kunnen afspraak, nee en reactie uitzetten; een
 * afmelding stopt altijd.
 */
export function stopReden(gestartOp: string, s: ReactieSignalen, regels: Partial<Stopregels> | null = null): Stopreden | null {
  const aan = (r: Stopregel) => regels?.[r] !== false
  const na = (op: string) => Date.parse(op) > Date.parse(gestartOp)
  if (aan('afspraak') && s.afspraken.some((a) => na(a.createdAt) && a.status !== 'geannuleerd')) return 'afspraak'
  if (aan('nee') && (s.nbStatus === 'nee' || s.momenten.some((m) => na(m.op) && m.uitkomst && NEE_UITKOMSTEN.has(m.uitkomst)))) return 'nee'
  if (s.afgemeld) return 'afmelding'
  if (aan('reactie') && s.momenten.some((m) => na(m.op) && (m.soort === 'reactie' || (m.uitkomst && REACTIE_UITKOMSTEN.has(m.uitkomst))))) return 'reactie'
  return null
}

/** Na een stop: een taak "bel terug", behalve na een nee (dan geldt de afkoeling). De Bewaker toetst het bellen nog. */
export const belTerugNa = (r: Stopreden) => r === 'reactie' || r === 'afspraak' || r === 'afmelding'

/** Bij een stop: alles wat nog niet gedaan is, valt weg. */
export function staptStop<T extends Pick<ReeksStap, 'status'>>(stappen: T[]): T[] {
  return stappen.map((s) => (s.status === 'gepland' || s.status === 'open' ? { ...s, status: 'overgeslagen' as const } : s))
}

/** Hervatten na een pauze: wat nog gepland staat, schuift de duur van de pauze op (nooit naar het verleden). */
export function schuifOp<T extends Pick<ReeksStap, 'status' | 'geplandOp'>>(stappen: T[], pauzeMs: number, nu: Date): T[] {
  return stappen.map((s) => (s.status === 'gepland' ? { ...s, geplandOp: new Date(Math.max(Date.parse(s.geplandOp) + Math.max(0, pauzeMs), nu.getTime())).toISOString() } : s))
}

/** De stand in woorden: "Loopt · dag 4 · stap 2 van 4", met wat op jou wacht. */
export function reeksStand(r: { status: ReeksStatus; gestartOp: string; stopreden?: Stopreden | null }, stappen: Pick<ReeksStap, 'status' | 'kanaal'>[], nu: Date) {
  const echte = stappen.filter((s) => s.kanaal !== 'einde')
  const gedaan = echte.filter((s) => s.status === 'gedaan' || s.status === 'overgeslagen' || s.status === 'tegengehouden').length
  const wacht = echte.filter((s) => s.status === 'open').length
  const dag = Math.max(0, Math.floor((Date.parse(`${nlMoment(nu).datum}T12:00:00Z`) - Date.parse(`${nlMoment(new Date(r.gestartOp)).datum}T12:00:00Z`)) / 864e5))
  const stap = Math.min(echte.length, gedaan + 1)
  let label = `${REEKS_STATUS_LABEL[r.status]} · dag ${dag}`
  if (r.status === 'gestopt') label = `Gestopt: ${r.stopreden ? STOPREDEN_LABEL[r.stopreden].charAt(0).toLowerCase() + STOPREDEN_LABEL[r.stopreden].slice(1) : 'handmatig'}`
  if (r.status === 'klaar') label = 'Klaar: terug naar het ritme'
  return { dag, stap, van: echte.length, wacht, label }
}

/** Mag B? Alleen als het effectieve mandaat van de Verzender voor deze gebruiker A of B is. */
export function mandaatKeuzes(verzender: 'A' | 'B' | 'C' | 'D'): ReeksMandaat[] {
  return verzender === 'A' || verzender === 'B' ? ['C', 'B'] : ['C']
}

/** Controle van een eigen sjabloon; een fout geeft 422. */
export function valideerSjabloon(s: Partial<ReeksSjabloon>): string[] {
  const f: string[] = []
  if (!s.naam?.trim()) f.push('Naam ontbreekt')
  if (!s.stappen?.length) f.push('Een reeks heeft minstens één stap')
  for (const [i, st] of (s.stappen ?? []).entries()) {
    if (!REEKS_KANALEN.includes(st.kanaal)) f.push(`Stap ${i + 1} heeft geen kanaal`)
    if (!Number.isInteger(st.dag) || st.dag < 0) f.push(`Stap ${i + 1} heeft geen geldige dag`)
    if (!st.titel?.trim()) f.push(`Stap ${i + 1} heeft geen titel`)
    if ((st.titel ?? '').length > 120) f.push(`De titel van stap ${i + 1} is langer dan 120 tekens`)
    if ((st.onderwerp ?? '').length > 120) f.push(`Het onderwerp van stap ${i + 1} is langer dan 120 tekens`)
    if ((st.instructie ?? '').length > 600) f.push(`De instructie van stap ${i + 1} is langer dan 600 tekens`)
  }
  if ((s.stappen ?? []).length > 12) f.push('Een reeks heeft hooguit 12 stappen')
  for (const u of s.uitkomsten ?? []) if (!(REEKS_UITKOMSTEN as readonly string[]).includes(u)) f.push(`Onbekende uitkomst ${u}`)
  const laatste = Math.max(0, ...(s.stappen ?? []).map((x) => x.dag))
  if (!s.einde || !Number.isInteger(s.einde.dag) || s.einde.dag <= laatste) f.push('Het einde ligt na de laatste stap')
  if (!s.einde || !Number.isInteger(s.einde.wachtDagen) || s.einde.wachtDagen < 1) f.push('Kies na hoeveel dagen het ritme verder gaat')
  return f
}

// Het overzicht (/opvolgreeksen): vijf standen in woorden, met de reeksen die op jou wachten bovenaan.
export const OVERZICHT_STANDEN = ['concept', 'open', 'loopt', 'raak', 'gestopt'] as const
export type OverzichtStand = typeof OVERZICHT_STANDEN[number]
export const OVERZICHT_LABEL: Record<OverzichtStand, string> = { concept: 'Concept', open: 'Open', loopt: 'Loopt', raak: 'Raak', gestopt: 'Gestopt' }
export const OVERZICHT_UITLEG: Record<OverzichtStand, string> = {
  concept: 'Een concept van de Schrijver wacht op je goedkeuring', open: 'Een stap wacht op jou: een taak om af te vinken', loopt: 'Loopt vanzelf: de volgende stap staat gepland',
  raak: 'Gestopt door een reactie of een afspraak', gestopt: 'Gestopt of klaar zonder reactie',
}

/**
 * De stand van een reeks in het overzicht. Concept: een open mail- of LinkedIn-stap met een concept dat nog niet is
 * goedgekeurd. Open: een andere open stap (een taak voor jou). Loopt: niets wacht. Raak: gestopt door een reactie of
 * een afspraak. Gestopt: nee, afmelding, handmatig of klaar.
 */
export function overzichtStand(r: { status: ReeksStatus; stopreden?: Stopreden | null }, stappen: { status: StapStatus; kanaal: string; conceptStatus?: string | null }[]): OverzichtStand {
  if (r.status === 'gestopt') return r.stopreden === 'reactie' || r.stopreden === 'afspraak' ? 'raak' : 'gestopt'
  if (r.status === 'klaar') return 'gestopt'
  const open = stappen.filter((s) => s.status === 'open')
  if (open.some((s) => s.kanaal !== 'bellen' && s.conceptStatus === 'klaar')) return 'concept'
  if (open.length) return 'open'
  return 'loopt'
}

/** Volgorde in de lijst: wat op jou wacht eerst (concepten, dan open), dan lopend, dan raak en gestopt (nieuwste eerst). */
export function sorteerOverzicht<T extends { stand: OverzichtStand; volgendeOp?: string | null; gestartOp: string; gestoptOp?: string | null }>(lijst: T[]): T[] {
  const rang = (s: OverzichtStand) => OVERZICHT_STANDEN.indexOf(s)
  return [...lijst].sort((a, b) => rang(a.stand) - rang(b.stand)
    || (a.stand === 'raak' || a.stand === 'gestopt' ? Date.parse(b.gestoptOp ?? b.gestartOp) - Date.parse(a.gestoptOp ?? a.gestartOp) : Date.parse(a.volgendeOp ?? a.gestartOp) - Date.parse(b.volgendeOp ?? b.gestartOp)))
}

/** De kop van het overzicht: "11 reeksen lopen, 2 wachten op jou." */
export function overzichtKop(lopend: number, wachten: number): string {
  const l = lopend === 0 ? 'Geen reeks loopt' : lopend === 1 ? '1 reeks loopt' : `${lopend} reeksen lopen`
  return wachten ? `${l}, ${wachten} ${wachten === 1 ? 'wacht' : 'wachten'} op jou.` : `${l}, niets wacht op jou.`
}

/** De maandag (NL) van de week van `nu`, als ISO-datum. */
export function maandagVan(nu: Date): string {
  const d = nlMoment(nu).datum
  return plusDagen(d, 1 - weekdag(d))
}

/** "Deze week: 3 reacties, 2 afspraken uit een reeks." Telt stops sinds maandag. */
export function weekRegel(stops: { stopreden: Stopreden | null; gestoptOp: string | null }[], nu: Date): string {
  const maandag = maandagVan(nu)
  const deze = stops.filter((s) => s.gestoptOp && nlMoment(new Date(s.gestoptOp)).datum >= maandag)
  const reacties = deze.filter((s) => s.stopreden === 'reactie').length
  const afspraken = deze.filter((s) => s.stopreden === 'afspraak').length
  if (!reacties && !afspraken) return 'Deze week nog geen reactie of afspraak uit een reeks.'
  return `Deze week: ${reacties} ${reacties === 1 ? 'reactie' : 'reacties'}, ${afspraken} ${afspraken === 1 ? 'afspraak' : 'afspraken'} uit een reeks.`
}

/** Het sjabloon dat past bij een uitkomst in Rond af of de belmodus (het eerste actieve met die uitkomst). */
export function sjabloonVoorUitkomst<T extends { uitkomsten?: string[] | null }>(sjablonen: T[], uitkomst: string | null | undefined): T | null {
  if (!uitkomst) return null
  return sjablonen.find((s) => (s.uitkomsten ?? []).includes(uitkomst)) ?? null
}

/** Welke reeksuitkomst hoort bij een uitkomstcode? Voicemail en Gesproken, later; "Stuur informatie" kies je zelf. */
export function reeksUitkomstVan(code: string | null | undefined): ReeksUitkomst | null {
  return code === 'voicemail' ? 'voicemail' : code === 'later' ? 'later' : code === 'informatie' ? 'informatie' : null
}

/** Korte regel voor een strip in Prospects of de belmodus: "Na informatie · stap 2 van 4 · volgende: Bellen di 20 okt". */
export function reeksStrip(r: { naam: string; status: ReeksStatus; stap: number; van: number; volgende?: { kanaal: string; titel: string; geplandOp: string } | null }): string {
  const delen = [r.naam, `stap ${r.stap} van ${r.van}`]
  if (r.status === 'gepauzeerd') delen.push('gepauzeerd')
  else if (r.volgende) {
    const wanneer = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(r.volgende.geplandOp)).replace(/\./g, '')
    delen.push(`volgende: ${REEKS_KANAAL_LABEL[r.volgende.kanaal as ReeksKanaal | 'einde'] ?? r.volgende.kanaal} ${wanneer}`)
  }
  return delen.join(' · ')
}

// Inkomende mail (reactie herkennen in de mailbox).
/** Het adres uit "Naam <adres@domein>" of een kaal adres, in kleine letters. */
export function mailAdres(van: string | null | undefined): string | null {
  const m = /<([^>]+)>/.exec(van ?? '')
  const a = (m ? m[1]! : String(van ?? '')).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a) ? a : null
}

/** Een automatisch antwoord (afwezigheid, bezorgfout) is geen reactie van een mens en stopt de reeks niet. */
export function isAutoAntwoord(m: { onderwerp?: string | null; headers?: Record<string, string> | null; van?: string | null }): boolean {
  const h = Object.fromEntries(Object.entries(m.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()]))
  if (h['auto-submitted'] && h['auto-submitted'] !== 'no') return true
  if (h['x-autoreply'] || h['x-autorespond'] || ['auto_reply', 'bulk', 'junk'].includes(h['precedence'] ?? '')) return true
  if (/^(mailer-daemon|postmaster|no-?reply)@/i.test(mailAdres(m.van) ?? '')) return true
  return /^(automatisch antwoord|automatic reply|auto(matic)?[- ]?reply|out of (the )?office|afwezig|niet aanwezig|undeliverable|onbestelbaar|delivery status notification)/i.test(String(m.onderwerp ?? '').replace(/^(re|aw|antw):\s*/i, '').trim())
}
