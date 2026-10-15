// Agents en mandaten (11.3). Elke agenthandeling loopt door de Bewaker (magHandelen).
// Mandaatniveaus, agents en hun maxima staan hier één keer (gat 16).
import { nlMoment, isWerkdag, type WerkdagInstelling } from './datum'
import { magBenaderen, type Kanaal } from './nbStatus'

export const MANDATEN = ['A', 'B', 'C', 'D'] as const
export type Mandaat = typeof MANDATEN[number]
export const MANDAAT_LABEL: Record<Mandaat, string> = { A: 'autonoom', B: 'binnen een goedgekeurd kader', C: 'per stuk goedkeuren', D: 'altijd mens' }
/** Hoe ruimer, hoe lager het getal: A is het meest autonoom. */
const RANG: Record<Mandaat, number> = { A: 0, B: 1, C: 2, D: 3 }
export const strengste = (...m: (Mandaat | null | undefined)[]): Mandaat => m.filter(Boolean).reduce((a, b) => (RANG[b!] > RANG[a!] ? b : a), 'A') as Mandaat

export type NiveauMandaat = Mandaat | 'uit'
export interface AgentDef {
  sleutel: string
  naam: string
  /** Platformmaximum (de founder kan het verlagen). */
  platformMax: Mandaat
  /** Standaard organisatiemaximum. */
  organisatieMax: Mandaat
  /** Mandaat per gebruikersniveau ('uit' = de agent doet niets namens deze gebruiker; alles als concept C). */
  perNiveau: { beginner: NiveauMandaat; gevorderd: NiveauMandaat; expert: NiveauMandaat }
  gebouwd: boolean
  omschrijving: string
}

export const AGENTS: AgentDef[] = [
  { sleutel: 'zoeker', naam: 'Zoeker', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: false, omschrijving: 'Zoekt nieuwe prospects bij je doelgroep.' },
  { sleutel: 'verrijker', naam: 'Verrijker', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Vult dossiers aan met bewijs.' },
  { sleutel: 'waarnemer', naam: 'Waarnemer', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Let op signalen bij je accounts.' },
  { sleutel: 'profielbouwer', naam: 'Profielbouwer', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Bouwt het buying committee op.' },
  { sleutel: 'planner', naam: 'Planner', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Plant pogingen en laat taken landen binnen je capaciteit.' },
  { sleutel: 'notulist', naam: 'Notulist', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Maakt verslagen van gesprekken.' },
  { sleutel: 'coach', naam: 'Coach', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: false, omschrijving: 'Geeft verbetervoorstellen.' },
  { sleutel: 'gids', naam: 'Gids', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: false, omschrijving: 'Helpt je de app te leren kennen.' },
  { sleutel: 'schrijver', naam: 'Schrijver', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'C', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Schrijft concepten; een Beginner keurt elk concept per stuk goed.' },
  { sleutel: 'verzender', naam: 'Verzender', platformMax: 'B', organisatieMax: 'B', perNiveau: { beginner: 'uit', gevorderd: 'B', expert: 'B' }, gebouwd: true, omschrijving: 'Verstuurt vervolgmails binnen een goedgekeurd kader; de eerste mail en elke mail aan een beslisser per stuk.' },
  { sleutel: 'berichtgever', naam: 'Berichtgever', platformMax: 'C', organisatieMax: 'C', perNiveau: { beginner: 'C', gevorderd: 'C', expert: 'C' }, gebouwd: false, omschrijving: 'Stelt WhatsApp-berichten voor.' },
  { sleutel: 'linkedin', naam: 'LinkedIn-assistent', platformMax: 'C', organisatieMax: 'C', perNiveau: { beginner: 'C', gevorderd: 'C', expert: 'C' }, gebouwd: false, omschrijving: 'Stelt LinkedIn-berichten voor.' },
  { sleutel: 'bewaker', naam: 'Bewaker', platformMax: 'A', organisatieMax: 'A', perNiveau: { beginner: 'A', gevorderd: 'A', expert: 'A' }, gebouwd: true, omschrijving: 'Toetst elke handeling vooraf; kan alleen blokkeren en melden.' },
]
export const agentDef = (s: string) => AGENTS.find((a) => a.sleutel === s)

/** De executor_status van een taak: alleen waarden die de code zet (gat 22). */
export const EXECUTOR_STATUSSEN = ['concept-klaar', 'goedgekeurd', 'uitgevoerd', 'tegengehouden'] as const
export type ExecutorStatus = typeof EXECUTOR_STATUSSEN[number]

/**
 * Effectief mandaat: het strengste van platformmaximum, organisatiemaximum, het
 * niveau van de gebruiker en een eigen mandaat (Expert). Gepauzeerd zet B (en A
 * voor handelingen naar buiten) naar de mens. D blijft D; 'uit' wordt C (alles als concept).
 */
export function effectiefMandaat(agent: string, opties: { platform?: Mandaat | null; organisatie?: Mandaat | null; niveau: 'beginner' | 'gevorderd' | 'expert'; eigen?: Mandaat | null; gepauzeerd?: boolean; naarBuiten?: boolean }): Mandaat {
  const def = agentDef(agent)
  if (!def) return 'D'
  const perNiveau = def.perNiveau[opties.niveau]
  const niveau: Mandaat = perNiveau === 'uit' ? 'C' : perNiveau
  let m = strengste(opties.platform ?? def.platformMax, opties.organisatie ?? def.organisatieMax, niveau, opties.niveau === 'expert' ? opties.eigen ?? null : null)
  if (opties.gepauzeerd && (m === 'B' || (m === 'A' && opties.naarBuiten))) m = 'C'
  return m
}

export type Uitvoering = 'direct' | 'als_taak_concept' | 'als_taak_mens' | 'geblokkeerd'
export interface HandelingContext {
  mandaat: Mandaat
  /** Contacthandeling op een kanaal (afkoeling, consent). */
  kanaal?: Kanaal | null
  account?: { nbStatus: string; data?: { nee?: any; wachtendTot?: string | null } | null } | null
  contact?: { belMeNiet?: boolean; consent?: { email?: { status: string }; whatsapp?: { status: string } } | null; rol?: string | null } | null
  /** Hoort de handeling bij een lopend ritme of goedgekeurde campagne (vereist voor B)? */
  binnenKader?: boolean
  /** Account zit al in een ander ritme. */
  anderRitme?: boolean
  capaciteitVol?: boolean
  /** AI-handeling: uitkomst van agentMagAi. */
  ai?: { mag: boolean; reden?: string } | null
  dagplafondBereikt?: boolean
  eersteBericht?: boolean
  werkdagen?: WerkdagInstelling
  /** De agent benadert zelf iemand (mail, bericht); alleen dan gelden de werkuren. Plannen van een taak niet. */
  naarBuiten?: boolean
}

/** Werkuren: werkdagen van 08:00 tot 18:00 (8.13), met feestdagen. */
export function binnenWerkuren(nu: Date, inst: WerkdagInstelling = {}): boolean {
  const m = nlMoment(nu)
  return isWerkdag(m.datum, inst) && m.uur >= 8 && m.uur < 18
}

const datumKort = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))

/**
 * De Bewaker: mag deze agent deze handeling nu doen? Hij kan alleen blokkeren of
 * naar de mens sturen, nooit zelf iets uitvoeren.
 */
export function magHandelen(agent: string, handeling: string, nu: Date, c: HandelingContext): { mag: boolean; uitvoering: Uitvoering; reden?: string } {
  const blok = (reden: string) => ({ mag: false, uitvoering: 'geblokkeerd' as const, reden })
  if (!agentDef(agent)) return blok('Onbekende agent')
  if (c.ai && !c.ai.mag) return blok(c.ai.reden ?? 'Geen AI-credits')
  if (c.dagplafondBereikt) return blok('Dagplafond bereikt')
  if (c.anderRitme) return blok('Het account zit al in een ander ritme')
  if (c.capaciteitVol) return blok('Capaciteit van vandaag is vol')
  if (c.kanaal && c.account) {
    const b = magBenaderen({ nbStatus: c.account.nbStatus, data: c.account.data ?? {} }, c.kanaal, nu, { belMeNiet: c.contact?.belMeNiet })
    if (!b.mag) {
      const tot = /tot (\d{4}-\d{2}-\d{2})/.exec(b.reden ?? '')?.[1]
      return blok(tot && b.reden?.startsWith('Afkoelperiode') ? `Afkoelperiode ${c.kanaal === 'mail' ? 'mail' : c.kanaal} tot ${datumKort(tot)}` : b.reden ?? 'Niet benaderen')
    }
  }
  if (c.kanaal === 'whatsapp' && c.contact?.consent?.whatsapp?.status !== 'ja') return blok('Geen consent voor WhatsApp')
  if (c.kanaal === 'mail' && c.contact?.consent?.email?.status === 'nee') return blok('Geen consent voor e-mail')
  if (c.mandaat === 'D') return { mag: true, uitvoering: 'als_taak_mens', reden: 'Mandaat D: altijd mens' }
  if (c.mandaat === 'C') return { mag: true, uitvoering: 'als_taak_concept', reden: 'Mandaat C: per stuk goedkeuren' }
  // B: alleen binnen een goedgekeurd kader, nooit de eerste mail of een mail aan een beslisser.
  if (c.mandaat === 'B') {
    if (!c.binnenKader) return { mag: true, uitvoering: 'als_taak_concept', reden: 'Buiten een goedgekeurd kader: per stuk goedkeuren' }
    if (c.eersteBericht || c.contact?.rol === 'beslisser') return { mag: true, uitvoering: 'als_taak_concept', reden: 'Eerste bericht of beslisser: per stuk goedkeuren' }
  }
  // A en B naar buiten: alleen binnen werkuren.
  if (c.naarBuiten && !binnenWerkuren(nu, c.werkdagen)) return blok('Buiten werkuren')
  return { mag: true, uitvoering: 'direct' }
}

/** Privémail en privémobiel gaan nooit mee in een AI-aanroep (11.2, 15.2). */
export function maskeerPrive<T>(materiaal: T): T {
  const PRIVE_VELDEN = new Set(['priveEmail', 'priveMobiel', 'privemail', 'privemobiel', 'mobielPrive', 'emailPrive'])
  const maskeerTekst = (t: string) => t
    .replace(/\b[\w.+-]+@(gmail|hotmail|outlook|live|yahoo|icloud|kpnmail|ziggo|home|planet)\.[a-z.]+\b/gi, '[privémail]')
    .replace(/(\+31\s?6|06)[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/g, '[privémobiel]')
  const loop = (w: any): any => {
    if (typeof w === 'string') return maskeerTekst(w)
    if (Array.isArray(w)) return w.map(loop)
    if (w && typeof w === 'object') return Object.fromEntries(Object.entries(w).filter(([k]) => !PRIVE_VELDEN.has(k)).map(([k, v]) => [k, k === 'mobiel' ? '[privémobiel]' : loop(v)]))
    return w
  }
  return loop(materiaal)
}

/** Instellingen van de agents: alleen via /api/agents te schrijven, nooit via PUT /api/settings. */
export const AGENT_INSTELLINGEN = ['agentmandaten', 'agentCreditsPerSoort', 'agentenGepauzeerd'] as const
export interface AgentInstelling { mandaat: Mandaat; dagplafond?: number | null; aan?: boolean }
export type AgentMandaten = Record<string, AgentInstelling>
export interface AgentPauze { sinds: string; door: string }

/** Agents die altijd aanstaan en waarvan je het mandaat niet wijzigt. */
export const ALTIJD_AAN = new Set(['bewaker'])

/** De niveaus die je mag kiezen: van het maximum tot en met D (A is het ruimst). */
export function mandaatOpties(max: Mandaat): Mandaat[] {
  return MANDATEN.filter((m) => RANG[m] >= RANG[max])
}

/** Het maximum dat de organisatie mag zetten: het platformmaximum (de founder) of de standaard. */
export function organisatieMaximum(agent: string, platform?: Mandaat | null): Mandaat {
  const def = agentDef(agent)
  return strengste(platform ?? def?.platformMax ?? 'D', def?.organisatieMax ?? 'D')
}

/** Controle op een gewenst mandaat; een fout geeft 422. */
export function mandaatFout(agent: string, gewenst: unknown, max: Mandaat): string | null {
  if (!agentDef(agent)) return 'Onbekende agent'
  if (ALTIJD_AAN.has(agent)) return 'De Bewaker staat altijd aan; zijn mandaat wijzig je niet'
  if (!MANDATEN.includes(gewenst as Mandaat)) return 'Kies A, B, C of D'
  if (RANG[gewenst as Mandaat] < RANG[max]) return `Hoger dan het maximum (${max})`
  return null
}

/** Een geweigerde handeling die toch als taak naar de mens gaat (in plaats van weg te vallen). */
export const NAAR_MENS_REDENEN = [/AI-credits/, /^Dagplafond/]
export const gaatNaarMens = (reden?: string) => !!reden && NAAR_MENS_REDENEN.some((r) => r.test(reden))
