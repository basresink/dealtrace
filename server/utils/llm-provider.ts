// De providerlaag voor AI (11.2, 13.1). Elke AI-stap loopt via voerAiStapUit: eerst de
// creditscheck (magVragen; voor agents ook agentMagAi via de Bewaker), dan maskeren,
// aanroepen met schema, één keer opnieuw en loggen in agent_runs. Zonder sleutel of in
// tests draait de mock met vaste fixtures; hij bewaart de laatste invoer voor de test
// dat privégegevens nooit meegaan.
import { creditsVoor, magVragen, type AiSoort } from '../../shared/credits'
import { voerAiKern, type AiProvider, type JsonSchema } from '../../shared/aiStap'
import { creditsStandVoor, laadAgentStand, logAgentRun, toets, type Voorstel } from './agents/bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export const MOCK_FIXTURES: Record<string, unknown[]> = {}
/** Mock die uit het materiaal een geldig antwoord maakt, voor soorten zonder vaste fixture. */
export const MOCK_GENERATOREN: Record<string, (materiaal: any) => unknown> = {
  // Opzet van een belscript: de opbouw van het startscript voor dit doel, met de kernzin van het verhaal.
  concept: (m) => m?.opzet ? {
    naam: `${m.opzet.doelLabel} (opzet)`,
    blokken: (m.opzet.voorbeeld ?? []).map((b: any) => ({ soort: b.soort, tekst: b.soort === 'opening' && m.kernzin ? `Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. ${m.kernzin}` : b.tekst })),
  } : { tekst: 'Mock-antwoord voor concept' },
  belscript: (m) => {
    const blokken: { blokId: string; tekst: string; bronnen: { soort: string; datum?: string; citaat?: string }[] }[] = []
    for (const b of m?.blokken ?? []) {
      if (b.soort === 'aanleiding' && m.inzichten?.[0]) blokken.push({ blokId: b.id, tekst: `Ik bel u naar aanleiding van dit: ${m.inzichten[0].titel}.`, bronnen: [{ soort: 'inzicht', datum: m.inzichten[0].op, citaat: m.inzichten[0].titel }] })
      if (b.soort === 'winpunt' && m.winpunt) blokken.push({ blokId: b.id, tekst: `${m.winpunt.titel}: ${m.winpunt.omschrijving}`, bronnen: [{ soort: 'winpunt', citaat: m.winpunt.titel }] })
    }
    return { blokken, gekozenWinpuntId: m?.winpunt?.id ?? '', argumentRef: m?.winpunt?.id ?? '' }
  },
}
export const mockLog: { soort: string; prompt: string; materiaal: unknown }[] = []

/** Mock-provider: per soort een rij vaste antwoorden (de laatste blijft staan). */
export const mockProvider: AiProvider = async ({ soort, prompt, materiaal }) => {
  mockLog.push({ soort, prompt, materiaal })
  if (mockLog.length > 50) mockLog.shift()
  const rij = MOCK_FIXTURES[soort]
  if (!rij?.length) return MOCK_GENERATOREN[soort] ? MOCK_GENERATOREN[soort]!(materiaal) : { tekst: `Mock-antwoord voor ${soort}` }
  return rij.length > 1 ? rij.shift() : rij[0]
}

/** De echte provider komt met de AI-koppeling (F23); tot dan altijd de mock. */
export function kiesProvider(): AiProvider {
  return mockProvider
}

export interface AiStap {
  soort: AiSoort
  prompt: string
  schema: JsonSchema
  materiaal: unknown
  /** Namens een agent (dan geldt de Bewaker) of een gebruiker. */
  agent?: string | null
  gebruiker?: Voorstel['gebruiker']
  accountId?: string | null
}

/**
 * Eén AI-stap. Een gebruiker zonder credits krijgt 402 met de melding uit 11.4; een agent
 * wordt door de Bewaker tegengehouden (onder 10 procent, dagplafond). Een stap zonder geldig
 * antwoord na twee pogingen wordt als fout gelogd en levert niets op (geen opslag).
 */
export async function voerAiStapUit<T = unknown>(tx: Tx, org: string, stap: AiStap, nu = new Date(), provider: AiProvider = kiesProvider()) {
  const credits = creditsVoor(stap.soort)
  if (stap.agent) {
    const b = await toets(tx, org, { agent: stap.agent, handeling: `ai:${stap.soort}`, gebruiker: stap.gebruiker, accountId: stap.accountId, ai: stap.soort }, nu)
    if (!b.mag) return { ok: false as const, reden: b.reden ?? 'Tegengehouden door de Bewaker' }
  } else {
    const stand = await laadAgentStand(tx, org)
    const v = magVragen(await creditsStandVoor(tx, org, nu), stap.soort, stand.pakket, credits)
    if (!v.mag) throw createError({ statusCode: v.status ?? 402, statusMessage: v.reden })
  }
  const uit = await voerAiKern<T>(provider, stap)
  if (stap.agent) {
    await logAgentRun(tx, org, {
      agent: stap.agent, handeling: `ai:${stap.soort}`, mandaat: 'A', uitkomst: uit.ok ? 'uitgevoerd' : 'fout', gebruikerId: stap.gebruiker?.id, accountId: stap.accountId,
      reden: uit.ok ? null : uit.fouten.join(' | ').slice(0, 500), kosten: uit.ok ? { soort: stap.soort, credits } : null,
    }, nu)
  }
  return uit.ok ? { ok: true as const, antwoord: uit.antwoord as T, pogingen: uit.pogingen } : { ok: false as const, reden: 'Het AI-antwoord was niet bruikbaar', fouten: uit.fouten }
}
