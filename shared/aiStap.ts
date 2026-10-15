// De gemeenschappelijke schil om elke AI-stap (11.2): schema op elk antwoord, één keer
// opnieuw, daarna een fout zonder opslag; privégegevens gemaskeerd vóór de aanroep.
// Databasevrij, zodat de schil met de mock-provider als golden master te testen is.
import { maskeerPrive } from './mandaat'

export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSchema
  enum?: readonly unknown[]
  minItems?: number
  maxLength?: number
}

/** Kleine JSON-schemacontrole: genoeg voor de tool-use-schema's van Dealtrace. */
export function valideerSchema(schema: JsonSchema, w: unknown, pad = 'antwoord'): string[] {
  const f: string[] = []
  const t = schema.type
  if (t === 'object') {
    if (!w || typeof w !== 'object' || Array.isArray(w)) return [`${pad} is geen object`]
    const o = w as Record<string, unknown>
    for (const k of schema.required ?? []) if (o[k] === undefined) f.push(`${pad}.${k} ontbreekt`)
    for (const [k, v] of Object.entries(o)) {
      const sub = schema.properties?.[k]
      if (!sub) { if (schema.additionalProperties === false) f.push(`${pad}.${k} is niet toegestaan`); continue }
      f.push(...valideerSchema(sub, v, `${pad}.${k}`))
    }
  } else if (t === 'array') {
    if (!Array.isArray(w)) return [`${pad} is geen lijst`]
    if (schema.minItems && w.length < schema.minItems) f.push(`${pad} heeft te weinig items`)
    if (schema.items) w.forEach((x, i) => f.push(...valideerSchema(schema.items!, x, `${pad}[${i}]`)))
  } else if (t === 'string') {
    if (typeof w !== 'string') return [`${pad} is geen tekst`]
    if (schema.maxLength && w.length > schema.maxLength) f.push(`${pad} is te lang`)
  } else if (t === 'number' || t === 'integer') {
    if (typeof w !== 'number' || !Number.isFinite(w) || (t === 'integer' && !Number.isInteger(w))) return [`${pad} is geen ${t === 'integer' ? 'geheel getal' : 'getal'}`]
  } else if (t === 'boolean') {
    if (typeof w !== 'boolean') return [`${pad} is geen ja of nee`]
  }
  if (schema.enum && !schema.enum.includes(w)) f.push(`${pad} heeft een onbekende waarde`)
  return f
}

export type AiProvider = (invoer: { soort: string; prompt: string; materiaal: unknown; schema: JsonSchema; poging: number }) => Promise<unknown>

export interface AiStapUitkomst<T = unknown> {
  ok: boolean
  antwoord?: T
  pogingen: number
  fouten: string[]
  /** Wat echt naar de provider ging (gemaskeerd). */
  invoer: unknown
}

/** Eén AI-stap: maskeren, aanroepen, valideren, één keer opnieuw. Een mislukte stap levert niets op. */
export async function voerAiKern<T>(provider: AiProvider, stap: { soort: string; prompt: string; schema: JsonSchema; materiaal: unknown }): Promise<AiStapUitkomst<T>> {
  const materiaal = maskeerPrive(stap.materiaal)
  const fouten: string[] = []
  for (let poging = 1; poging <= 2; poging++) {
    let antwoord: unknown
    try {
      antwoord = await provider({ soort: stap.soort, prompt: stap.prompt, materiaal, schema: stap.schema, poging })
    } catch (e) {
      fouten.push(`Poging ${poging}: ${(e as Error).message}`)
      continue
    }
    const f = valideerSchema(stap.schema, antwoord)
    if (!f.length) return { ok: true, antwoord: antwoord as T, pogingen: poging, fouten, invoer: materiaal }
    fouten.push(`Poging ${poging}: ${f.join('; ')}`)
  }
  return { ok: false, pogingen: 2, fouten, invoer: materiaal }
}

/**
 * Namenfilter (11.2, C.9 geval 9): namen van contactpersonen gaan nooit mee in een
 * AI-aanroep, ook niet als ze in aantekeningen staan.
 */
export function verwijderNamen<T>(materiaal: T, namen: (string | null | undefined)[]): T {
  const delen = [...new Set(namen.flatMap((n) => (n ?? '').split(/\s+/)).map((n) => n.trim()).filter((n) => n.length >= 3 && !/^(van|der|den|de|het)$/i.test(n)))]
  if (!delen.length) return materiaal
  const re = new RegExp(`\\b(${delen.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const loop = (w: any): any => (typeof w === 'string' ? w.replace(re, '[naam]') : Array.isArray(w) ? w.map(loop) : w && typeof w === 'object' ? Object.fromEntries(Object.entries(w).map(([k, v]) => [k, loop(v)])) : w)
  return loop(materiaal)
}
