// De AI-koppeling (P24, F23): oplosketen organisatie, platform, omgeving, mock. Claude is de standaard
// (webonderzoek alleen via Claude); de sleutel staat versleuteld met een eigen geheim (LLM_KEY_SECRET) en
// komt nooit naar de client. Met AI_PROVIDER=mock (lokaal, tests) altijd de mock, zonder netwerk.
// Hier ook de promptketen: per slot de laag van de organisatie, dan die van het platform, dan de code,
// met het vaste kader altijd aan het eind.
import { sql } from 'drizzle-orm'
import type { AiProvider, JsonSchema } from '../../shared/aiStap'
import { promptKeten, slotVoor, type PromptSlot } from '../../shared/platform'
import { ontsleutel } from './geheimen'
import { mockProvider } from './llm-provider'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>

export const STANDAARD_MODEL = 'claude-sonnet-5-5'
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

/** Claude met tool use: het schema is het invoerschema van één verplicht gereedschap, zodat het antwoord altijd JSON is. */
export function claudeProvider(sleutel: string, modellen: Record<string, string> = {}, haal: typeof fetch = fetch): AiProvider {
  return async ({ soort, prompt, materiaal, schema }) => {
    const r = await haal(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': sleutel, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modellen[soort] ?? modellen.standaard ?? STANDAARD_MODEL, max_tokens: 2048, system: prompt,
        messages: [{ role: 'user', content: `Materiaal (JSON):\n${JSON.stringify(materiaal)}` }],
        tools: [{ name: 'antwoord', description: 'Geef het antwoord in dit schema.', input_schema: schema as JsonSchema }],
        tool_choice: { type: 'tool', name: 'antwoord' },
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!r.ok) throw new Error(r.status === 401 ? 'De AI-sleutel wordt geweigerd' : `De AI-provider antwoordde ${r.status}`)
    const j: any = await r.json()
    const tool = (j?.content ?? []).find((c: any) => c.type === 'tool_use')
    if (!tool) throw new Error('Geen antwoord in het schema')
    return tool.input
  }
}

/** De koppeling die geldt: eerst de eigen van de organisatie, dan die van het platform, dan de omgeving. */
export async function aiKoppelingVoor(tx: Tx, org: string): Promise<{ bron: 'organisatie' | 'platform' | 'omgeving' | 'mock'; provider: string; sleutel: string | null; modellen: Record<string, string>; regio: string }> {
  if ((process.env.AI_PROVIDER ?? 'mock') === 'mock') return { bron: 'mock', provider: 'mock', sleutel: null, modellen: {}, regio: 'EU' }
  const [k] = (await tx.execute(sql`select * from dealtrace_llm_koppeling(${org})`)).rows as Rij[]
  const sleutel = k?.provider === 'claude' ? ontsleutel(k.sleutel, 'llm')?.sleutel ?? null : null
  if (k && sleutel) return { bron: k.organisation_id ? 'organisatie' : 'platform', provider: 'claude', sleutel, modellen: k.modellen ?? {}, regio: k.regio ?? 'EU' }
  if (process.env.ANTHROPIC_API_KEY) return { bron: 'omgeving', provider: 'claude', sleutel: process.env.ANTHROPIC_API_KEY, modellen: k?.modellen ?? {}, regio: 'EU' }
  return { bron: 'mock', provider: 'mock', sleutel: null, modellen: {}, regio: 'EU' }
}
export async function providerVoor(tx: Tx, org: string): Promise<AiProvider> {
  const k = await aiKoppelingVoor(tx, org)
  return k.provider === 'claude' && k.sleutel ? claudeProvider(k.sleutel, k.modellen) : mockProvider
}

/** De laatste versie per laag voor een slot (RLS: de eigen laag en die van het platform). */
export async function promptLagen(tx: Tx, slot: PromptSlot): Promise<{ organisatie: string | null; platform: string | null }> {
  const rijen = (await tx.execute(sql`select distinct on (laag) laag, tekst from prompt_versies where slot = ${slot} order by laag, versie desc`)).rows as Rij[]
  return { organisatie: rijen.find((r) => r.laag === 'organisatie')?.tekst ?? null, platform: rijen.find((r) => r.laag === 'platform')?.tekst ?? null }
}
/** De prompt voor een AI-stap: de keten als de stap een slot heeft, anders de code met het vaste kader. */
export async function promptVoor(tx: Tx, soort: string, materiaal: unknown, code: string): Promise<string> {
  const slot = slotVoor(soort, materiaal)
  return promptKeten({ ...(slot ? await promptLagen(tx, slot) : {}), code })
}
