// De Profielbouwer (P19, F04, mandaat A): stelt het buying committee voor uit dossier, website en
// verslagen. Hij verzint geen namen; zekerheid onder 60 heet "vermoedelijk". De mens neemt over.
// Brief en buying committee: 3 credits (11.4).
import { sql } from 'drizzle-orm'
import type { JsonSchema } from '../../../shared/aiStap'
import { filterNamen } from '../../../shared/verkoopverhaal'
import { gebruikDb } from '../db'
import { voerAiStapUit } from '../llm-provider'
import { logAgentRun } from './bewaker'
import { PROMPT_BUYING_COMMITTEE } from '../../../shared/promptStandaard'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

export const COMMITTEE_SCHEMA: JsonSchema = {
  type: 'object', required: ['voorstellen'], additionalProperties: false,
  properties: { voorstellen: { type: 'array', items: { type: 'object', required: ['functie', 'rol', 'bron', 'zekerheid'], additionalProperties: false, properties: { naam: { type: 'string' }, functie: { type: 'string' }, rol: { type: 'string', enum: ['beslisser', 'beinvloeder', 'champion', 'gebruiker'] }, bron: { type: 'string' }, zekerheid: { type: 'number' } } } } },
}

export async function stelCommitteeVoor(tx: Tx, org: string, gebruiker: any, accountId: string, nu = new Date()) {
  const contacten = await rijen(tx, sql`select first_name, last_name, rol, data->>'functie' as functie from contacts where account_id = ${accountId} and status <> 'vertrokken'`)
  const verslagen = (await rijen(tx, sql`select data->>'tekst' as t from activiteiten where account_id = ${accountId} and data->>'tekst' is not null order by op desc limit 5`)).map((r) => r.t as string)
  const namen = contacten.map((c) => ({ naam: `${c.first_name ?? ''} ${c.last_name}`.trim() }))
  const functies = [...new Set([...contacten.map((c) => c.functie).filter(Boolean), ...verslagen.flatMap((t) => t.match(/\b(directeur|eigenaar|werkvoorbereider|projectleider|hoofd inkoop|inkoper|bedrijfsleider)\b/gi) ?? [])].map((f: string) => f.toLowerCase()))]
  const r = await voerAiStapUit<any>(tx, org, {
    soort: 'brief', schema: COMMITTEE_SCHEMA, accountId, gebruiker, boekAls: 'profielbouwer',
    prompt: PROMPT_BUYING_COMMITTEE,
    materiaal: { committee: true, functies, verslagen: verslagen.map((t) => filterNamen(t, namen)), bron: 'Verslagen en contacten' },
  }, nu)
  await logAgentRun(tx, org, { agent: 'profielbouwer', handeling: 'committee', mandaat: 'A', uitkomst: r.ok ? 'uitgevoerd' : 'fout', accountId, reden: r.ok ? null : r.reden }, nu)
  if (!r.ok) return { voorstellen: [], reden: r.reden }
  return { voorstellen: (r.antwoord.voorstellen as any[]).map((v) => ({ ...v, vermoedelijk: v.zekerheid < 60 })) }
}
