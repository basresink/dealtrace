// AI-credits (11.4, F26). Alle AI rekent in credits: één pot per organisatie per maand,
// een vast aantal credits per handeling, ongeacht het model. De prijs per handeling
// staat alleen hier (gat 16). Dit is de basis die P08 nodig heeft; P33 voegt de
// boeking in ai_credits, de melding bij 80 procent en het plafond per gebruiker toe.
import type { Pakket } from './types'

export const AI_SOORTEN = [
  'assistent', 'assistentUitgebreid', 'webonderzoek', 'zoekronde', 'dossier', 'inzichtBeoordeling', 'concept',
  'belscript', 'notulist', 'brief', 'coach', 'spraakopdracht', 'visitekaartje', 'transcriptie',
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
export function creditsVoor(soort: AiSoort, context: { tekens?: number; seconden?: number; prijzen?: Partial<Record<AiSoort, number>> } = {}): number {
  const basis = context.prijzen?.[soort] ?? AI_SOORT[soort].credits
  if (soort === 'assistentUitgebreid' && context.tekens) return Math.min(5, Math.max(basis, Math.ceil(context.tekens / 2000)))
  if (soort === 'transcriptie') return basis * Math.max(1, Math.ceil((context.seconden ?? 60) / 60))
  return basis
}

export const soortAanIn = (soort: AiSoort, pakket: Pakket) => AI_SOORT[soort].pakketten.includes(pakket)

export interface CreditsStand { pot: number; verbruikt: number; over: number; procentVerbruikt: number; letOp: boolean; op: boolean }

/** De stand van de pot: pot is gebruikers maal het pakketbedrag plus extra credits, tenzij de founder een vaste pot zet. */
export function creditsStand(i: { pakket: Pakket; gebruikers: number; extra?: number; vastePot?: number | null; verbruikt: number }): CreditsStand {
  const pot = Math.max(0, i.vastePot ?? POT_PER_GEBRUIKER[i.pakket] * Math.max(0, i.gebruikers) + (i.extra ?? 0))
  const verbruikt = Math.max(0, i.verbruikt)
  const over = Math.max(0, pot - verbruikt)
  const procentVerbruikt = pot ? Math.min(100, Math.round((verbruikt / pot) * 1000) / 10) : 100
  return { pot, verbruikt, over, procentVerbruikt, letOp: pot > 0 && verbruikt >= pot * LET_OP_VANAF, op: over <= 0 }
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
