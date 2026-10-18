// AI-credits (11.4, F26). Alle AI rekent in credits: één pot per organisatie per maand,
// een vast aantal credits per handeling, ongeacht het model. De prijs per handeling
// staat alleen hier (gat 16). Dit is de basis die P08 nodig heeft; P33 voegt de
// boeking in ai_credits, de melding bij 80 procent en het plafond per gebruiker toe.
import type { Pakket } from './types'

export const AI_SOORTEN = [
  'assistent', 'assistentUitgebreid', 'webonderzoek', 'zoekronde', 'dossier', 'inzichtBeoordeling', 'concept',
  'belscript', 'notulist', 'brief', 'coach', 'spraakopdracht', 'visitekaartje', 'transcriptie', 'bandInvulling',
] as const
export type AiSoort = typeof AI_SOORTEN[number]

export interface AiSoortDef { naam: string; credits: number; pakketten: readonly Pakket[] }
const ALLE: readonly Pakket[] = ['starter', 'plus', 'compleet']
const PLUS: readonly Pakket[] = ['plus', 'compleet']
const COMPLEET: readonly Pakket[] = ['compleet']

/** De standaardtabel uit 11.4. De founder past de prijzen aan zonder release (P24, P33). */
export const AI_SOORT: Record<AiSoort, AiSoortDef> = {
  assistent: { naam: 'AI-assistent: gewone vraag', credits: 1, pakketten: ALLE },
  assistentUitgebreid: { naam: 'AI-assistent: met accountgegevens of lang antwoord', credits: 2, pakketten: ALLE },
  webonderzoek: { naam: 'Webonderzoek', credits: 10, pakketten: COMPLEET },
  zoekronde: { naam: 'Zoekronde leadgenerator', credits: 20, pakketten: COMPLEET },
  dossier: { naam: 'Dossier', credits: 10, pakketten: COMPLEET },
  inzichtBeoordeling: { naam: 'Inzicht-beoordeling', credits: 1, pakketten: PLUS },
  concept: { naam: 'Concept (Pitstop, boodschap)', credits: 2, pakketten: PLUS },
  belscript: { naam: 'Belscript-invulling', credits: 1, pakketten: PLUS },
  notulist: { naam: 'Notulist', credits: 5, pakketten: PLUS },
  brief: { naam: 'Brief en buying committee', credits: 3, pakketten: PLUS },
  coach: { naam: 'Coach en verbetervoorstel', credits: 20, pakketten: PLUS },
  spraakopdracht: { naam: 'Spraakopdracht', credits: 1, pakketten: ALLE },
  visitekaartje: { naam: 'Visitekaartje', credits: 2, pakketten: ALLE },
  transcriptie: { naam: 'Transcriptie (per begonnen minuut)', credits: 1, pakketten: ALLE },
  bandInvulling: { naam: 'BAND-invulling uit gespreksverslagen', credits: 1, pakketten: ALLE },
}

/** Pot per gebruiker per maand, samen in één pot per organisatie (voorlopig, open vraag 24). */
export const POT_PER_GEBRUIKER: Record<Pakket, number> = { starter: 200, plus: 600, compleet: 1500 }

export const CREDITS_OP_TEKST = 'De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen.'
export const LET_OP_VANAF = 0.8
/** Onder dit deel van de pot stoppen agents en motorrondes (11.4). */
export const AGENT_STOP_ONDER = 0.1

/**
 * Credits voor één handeling. Uitgebreide assistentvragen kosten 2 tot 5 naar lengte;
 * transcriptie 1 per begonnen minuut. Prijzen van de founder gaan voor.
 */
export function creditsVoor(soort: AiSoort, context: { tekens?: number; seconden?: number; bronnen?: number; woorden?: number; prijzen?: Partial<Record<AiSoort, number>> } = {}): number {
  const basis = context.prijzen?.[soort] ?? AI_SOORT[soort].credits
  if (soort === 'assistentUitgebreid') {
    // 2 met accountgegevens, plus 1 per bron boven de drie, plus 1 bij een antwoord boven 300 woorden; hooguit 5.
    const extra = Math.max(0, (context.bronnen ?? 0) - 3) + ((context.woorden ?? 0) > 300 ? 1 : 0) + (context.tekens ? Math.max(0, Math.ceil(context.tekens / 2000) - basis) : 0)
    return Math.min(Math.max(5, basis), basis + extra)
  }
  if (soort === 'transcriptie') return basis * Math.max(1, Math.ceil((context.seconden ?? 60) / 60))
  return basis
}

export const soortAanIn = (soort: AiSoort, pakket: Pakket) => AI_SOORT[soort].pakketten.includes(pakket)

export interface CreditsStand { pot: number; verbruikt: number; gereserveerd?: number; over: number; procentVerbruikt: number; letOp: boolean; op: boolean }

/** De stand van de pot: pot is gebruikers maal het pakketbedrag plus extra credits, tenzij de founder een vaste pot zet. */
export function creditsStand(i: { pakket: Pakket; gebruikers: number; extra?: number; vastePot?: number | null; verbruikt: number; gereserveerd?: number; toegekend?: number | null; perGebruiker?: number | null }): CreditsStand {
  const pot = Math.max(0, i.vastePot ?? Math.max(i.toegekend ?? 0, potVoor(i.pakket, i.gebruikers, 0, i.perGebruiker)) + (i.extra ?? 0))
  const verbruikt = Math.max(0, i.verbruikt)
  const gereserveerd = Math.max(0, i.gereserveerd ?? 0)
  const over = Math.max(0, pot - verbruikt - gereserveerd)
  const procentVerbruikt = pot ? Math.min(100, Math.round((verbruikt / pot) * 1000) / 10) : 100
  return { pot, verbruikt, gereserveerd, over, procentVerbruikt, letOp: pot > 0 && verbruikt >= pot * LET_OP_VANAF, op: over <= 0 }
}

/** De pot van een maand: credits per gebruiker van het pakket maal de actieve gebruikers, plus extra. */
export function potVoor(pakket: Pakket, actieveGebruikers: number, extra = 0, perGebruiker?: number | null): number {
  return Math.max(0, (perGebruiker ?? POT_PER_GEBRUIKER[pakket]) * Math.max(0, actieveGebruikers)) + Math.max(0, extra)
}

export const PLAFOND_TEKST = 'Je hebt je AI-credits voor deze maand gebruikt. Je beheerder kan je plafond verhogen.'
export const AGENTGRENS_TEKST = 'Minder dan 10 procent AI-credits over: automatische AI staat stil.'
export type Weigering = 'op' | 'plafond' | 'agentgrens' | 'pakket'
/**
 * De poort vóór elke AI-aanroep: pakket, pot, plafond van de gebruiker (alleen wat hij zelf vraagt)
 * en de agentgrens (automatische AI stopt als na de aanroep minder dan 10 procent over is).
 */
export function magVragenVoor(i: { stand: CreditsStand; kosten: number; automatisch: boolean; plafond?: number | null; verbruiktGebruiker?: number; soort?: AiSoort; pakket?: Pakket }): { ja: true } | { ja: false; reden: Weigering; status: 402 | 403; tekst: string } {
  if (i.soort && i.pakket && !soortAanIn(i.soort, i.pakket)) return { ja: false, reden: 'pakket', status: 403, tekst: `${AI_SOORT[i.soort].naam} zit niet in jullie pakket.` }
  if (i.stand.over <= 0 || i.stand.over < i.kosten) return { ja: false, reden: 'op', status: 402, tekst: CREDITS_OP_TEKST }
  if (!i.automatisch && i.plafond != null && (i.verbruiktGebruiker ?? 0) + i.kosten > i.plafond) return { ja: false, reden: 'plafond', status: 402, tekst: PLAFOND_TEKST }
  if (i.automatisch && i.stand.over - i.kosten < i.stand.pot * AGENT_STOP_ONDER) return { ja: false, reden: 'agentgrens', status: 402, tekst: AGENTGRENS_TEKST }
  return { ja: true }
}

/** Is er een melding nodig na deze boeking? 80 procent verbruikt of nog 10 procent over, één keer per maand. */
export function meldingNodig(voor: CreditsStand, na: CreditsStand, vlaggen: { gemeld80?: boolean; gemeld10?: boolean }): '80' | '10' | null {
  if (!na.pot) return null
  const overNa = na.pot - na.verbruikt
  if (!vlaggen.gemeld10 && overNa < na.pot * AGENT_STOP_ONDER && voor.pot - voor.verbruikt >= voor.pot * AGENT_STOP_ONDER) return '10'
  if (!vlaggen.gemeld80 && na.verbruikt >= na.pot * LET_OP_VANAF && voor.verbruikt < voor.pot * LET_OP_VANAF) return '80'
  return null
}

const WEB = /(website|webpagina|vacature|nieuws|op internet|online zoeken|zoek op|site van|linkedin)/i
/** Welke soort een vraag aan de assistent is: met accountgegevens duurder, webonderzoek alleen op verzoek. */
export function kiesAssistentSoort(vraag: string, context: { accountId?: string | null }, pakket: Pakket): { soort: AiSoort; nietInPakket?: boolean } {
  if (WEB.test(vraag)) return soortAanIn('webonderzoek', pakket) ? { soort: 'webonderzoek' } : { soort: 'webonderzoek', nietInPakket: true }
  return { soort: context.accountId ? 'assistentUitgebreid' : 'assistent' }
}

export interface Bron { soort: 'help' | 'verhaal' | 'account' | 'verslag' | 'taak' | 'web'; label: string; ref?: string | null; citaat?: string | null }
/** Bewijsplicht (11.2): een bron met een citaat dat niet letterlijk in het materiaal staat, valt weg. */
export function bronnenVoorAntwoord(materiaal: string[], bronnen: Bron[]): { geldig: Bron[]; afgewezen: Bron[] } {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase()
  const alles = materiaal.map(norm)
  const geldig: Bron[] = []
  const afgewezen: Bron[] = []
  for (const b of bronnen) (!b.citaat || alles.some((m) => m.includes(norm(b.citaat!))) ? geldig : afgewezen).push(b)
  return { geldig, afgewezen }
}

/** Mag deze AI-handeling (van een gebruiker of agent)? Weigert vóór de aanroep. */
export function magVragen(stand: CreditsStand, soort: AiSoort, pakket: Pakket, credits = creditsVoor(soort)): { mag: boolean; status?: 402 | 403; reden?: string } {
  if (!soortAanIn(soort, pakket)) return { mag: false, status: 403, reden: `${AI_SOORT[soort].naam} zit niet in je pakket` }
  if (stand.op || stand.over < credits) return { mag: false, status: 402, reden: CREDITS_OP_TEKST }
  return { mag: true }
}

/**
 * Mag een agent of motorronde AI gebruiken? Bovenop magVragen: stoppen onder 10 procent
 * van de pot en het dagplafond per AI-soort dat de beheerder zet.
 */
export function agentMagAi(stand: CreditsStand, soort: AiSoort, pakket: Pakket, dagplafond: number | null | undefined, verbruiktVandaag: number): { mag: boolean; reden?: string } {
  const v = magVragen(stand, soort, pakket)
  if (!v.mag) return { mag: false, reden: v.status === 403 ? v.reden : 'De AI-credits van deze maand zijn op' }
  const credits = creditsVoor(soort)
  if (stand.over - credits < stand.pot * AGENT_STOP_ONDER) return { mag: false, reden: 'Minder dan 10 procent AI-credits over' }
  if (dagplafond != null && verbruiktVandaag + credits > dagplafond) return { mag: false, reden: `Dagplafond voor ${AI_SOORT[soort].naam.toLowerCase()} bereikt` }
  return { mag: true }
}
