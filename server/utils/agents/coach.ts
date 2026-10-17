// De Coach (P21, F20, 11.3, mandaat A voor voorstellen): hoogstens drie coachingpunten met cijfers en een
// bestaand artikel uit de academie; de manager beslist en deelt. Ook de zelfanalyse voor een Expert en het
// maandelijkse verbetervoorstel per reis. "Coach en verbetervoorstel": 20 credits (11.4).
import { sql } from 'drizzle-orm'
import type { JsonSchema } from '../../../shared/aiStap'
import { coachPunten, genoegOmTeVergelijken, type CoachPunt } from '../../../shared/team'
import { filterNamen } from '../../../shared/verkoopverhaal'
import { gebruikDb } from '../db'
import { voerAiStapUit } from '../llm-provider'
import { logAgentRun, toets } from './bewaker'
import { PROMPT_VERBETERVOORSTEL, promptCoachpunten } from '../../../shared/promptStandaard'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Record<string, any>[]

export const COACH_SCHEMA: JsonSchema = {
  type: 'object', required: ['punten'], additionalProperties: false,
  properties: {
    punten: { type: 'array', items: { type: 'object', required: ['tekst', 'onderbouwing', 'artikelSleutel'], additionalProperties: false, properties: {
      tekst: { type: 'string', maxLength: 300 }, artikelSleutel: { type: 'string' },
      onderbouwing: { type: 'object', required: ['cijfers', 'bron'], additionalProperties: false, properties: { cijfers: { type: 'array', items: { type: 'string', maxLength: 200 } }, bron: { type: 'string', maxLength: 140 } } },
    } } },
  },
}

export interface CoachMateriaal { cijfers: Record<string, unknown>; team: Record<string, unknown>; verslagen: string[]; scriptgebruik?: Record<string, unknown> | null }
/** Coachingpunten voor een accountmanager (de manager vraagt, of de Expert zelf). Namen gaan gefilterd mee. */
export async function coachVoorstel(tx: Tx, org: string, vrager: { id: string; niveau: string; data?: any }, voor: { id: string; naam: string }, m: CoachMateriaal, nu = new Date(), opties: { zelf?: boolean } = {}): Promise<CoachPunt[]> {
  const artikelen = (await rijen(tx, sql`select slug from help_artikelen`)).map((r) => r.slug as string)
  const namen = (await rijen(tx, sql`select coalesce(first_name || ' ', '') || last_name as naam from contacts c join accounts a on a.id = c.account_id where a.owner_id = ${voor.id} limit 500`)).map((r) => ({ naam: String(r.naam).trim() }))
  const r = await voerAiStapUit<{ punten: CoachPunt[] }>(tx, org, {
    soort: 'coach', boekAls: 'coach', gebruiker: { id: vrager.id, niveau: vrager.niveau as any, data: vrager.data }, schema: COACH_SCHEMA,
    prompt: promptCoachpunten(opties.zelf),
    materiaal: { coach: true, cijfers: m.cijfers, team: m.team, verslagen: m.verslagen.slice(0, 10).map((t) => filterNamen(t, namen)), scriptgebruik: m.scriptgebruik ?? null, artikelen, genoeg: genoegOmTeVergelijken(Number((m.cijfers as any).gesprekken ?? 0), 'gesprekken').genoeg },
  }, nu)
  await logAgentRun(tx, org, { agent: 'coach', handeling: opties.zelf ? 'zelfanalyse' : 'coachingpunten', mandaat: 'A', uitkomst: r.ok ? 'uitgevoerd' : 'fout', gebruikerId: voor.id, reden: r.ok ? null : r.reden }, nu)
  if (!r.ok) throw Object.assign(new Error(r.reden ?? 'De Coach kon geen punten maken'), { statusCode: 502, statusMessage: r.reden ?? 'De Coach kon geen punten maken' })
  return coachPunten(r.antwoord.punten ?? [], artikelen)
}

/**
 * Het maandelijkse verbetervoorstel per reisversie met minstens 20 accounts (maandjob, als agent: stopt
 * onder 10 procent van de pot). Het voorstel wordt een inzicht van soort verbetervoorstel voor de managers.
 */
export async function maandVerbetervoorstel(tx: Tx, org: string, nu = new Date()) {
  const t = await toets(tx, org, { agent: 'coach', handeling: 'verbetervoorstel', ai: 'coach' }, nu)
  if (!t.mag) return { gemaakt: 0, gestopt: t.reden ?? 'Tegengehouden' }
  const maand = nu.toISOString().slice(0, 7)
  const reizen = await rijen(tx, sql`select r.id, r.naam, r.versie, count(a.id)::int as n from reistemplates r join accounts a on a.reis_id = r.id where r.status = 'actief' group by 1, 2, 3`)
  const managers = (await rijen(tx, sql`select id from users where role = 'salesmanager' and status = 'actief'`)).map((u) => u.id as string)
  let gemaakt = 0
  for (const r of reizen) {
    if (!genoegOmTeVergelijken(r.n, 'reisversie').genoeg) continue
    const [al] = await rijen(tx, sql`select 1 from signals where type = 'verbetervoorstel' and onderwerp = ${`verbetervoorstel:${r.id}:${maand}`}`)
    if (al) continue
    const fases = await rijen(tx, sql`select coalesce(fase_id, '-') as fase, count(*)::int as n from accounts where reis_id = ${r.id} group by 1 order by 2 desc`)
    const v = await voerAiStapUit<{ punten: CoachPunt[] }>(tx, org, {
      soort: 'coach', agent: 'coach', schema: COACH_SCHEMA,
      prompt: PROMPT_VERBETERVOORSTEL,
      materiaal: { coach: true, verbetervoorstel: true, reis: r.naam, versie: r.versie, fases, artikelen: ['doelgroepen-en-reizen'] },
    }, nu)
    if (!v.ok) break
    const p = v.antwoord.punten?.[0]
    if (!p) continue
    for (const m of managers) {
      await tx.execute(sql`insert into signals (id, organisation_id, owner_id, onderwerp, agent, type, title, relevance_score, status, bron, data) values (${crypto.randomUUID()}, ${org}, ${m}, ${`verbetervoorstel:${r.id}:${maand}`}, 'coach', 'verbetervoorstel', ${`Verbetervoorstel ${r.naam}`}, 60, 'nieuw', 'intern',
        ${JSON.stringify({ reisId: r.id, versie: r.versie, voorstel: p.tekst, onderbouwing: p.onderbouwing, agent: 'coach' })}::jsonb)`)
    }
    gemaakt++
  }
  await logAgentRun(tx, org, { agent: 'coach', handeling: 'verbetervoorstel', mandaat: 'A', uitkomst: 'uitgevoerd', reden: `${gemaakt} voorstellen` }, nu)
  return { gemaakt, gestopt: null }
}
