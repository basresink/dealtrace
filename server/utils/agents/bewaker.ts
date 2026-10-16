// De Bewaker op de server (11.3): laadt mandaten, pauze, credits en het account, en
// roept magHandelen aan. Hij kan alleen blokkeren en melden; elke blokkade staat in
// agent_runs met reden. Hij voert zelf nooit iets uit.
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { agentMagAi, creditsStand, creditsVoor, type AiSoort, type CreditsStand } from '../../../shared/credits'
import { effectiefMandaat, magHandelen, organisatieMaximum, type AgentMandaten, type AgentPauze, type HandelingContext, type Mandaat, type Uitvoering } from '../../../shared/mandaat'
import type { Kanaal } from '../../../shared/nbStatus'
import type { Tegengehouden } from '../../../shared/planner'
import { nlMoment, nlTijdstip } from '../../../shared/datum'
import type { Pakket } from '../../../shared/types'
import { schema } from '../db'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]

export interface AgentStand {
  pakket: Pakket
  mandaten: AgentMandaten
  maxima: Record<string, Mandaat>
  pauze: AgentPauze | null
  creditsPerSoort: Partial<Record<AiSoort, number>>
  werkdagen: Record<string, unknown>
}

async function instelling<T>(tx: Tx, key: string): Promise<T | undefined> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, key))
  return r?.value as T | undefined
}

/** Alles wat de Bewaker over de organisatie moet weten. */
export async function laadAgentStand(tx: Tx, org: string): Promise<AgentStand> {
  const [o] = await tx.select({ pakket: schema.organisations.pakket }).from(schema.organisations).where(eq(schema.organisations.id, org))
  const maxima = Object.fromEntries((await tx.select().from(schema.platformAgentmaxima)).map((m) => [m.agent, m.maxMandaat as Mandaat]))
  return {
    pakket: (o?.pakket ?? 'starter') as Pakket,
    mandaten: (await instelling<AgentMandaten>(tx, 'agentmandaten')) ?? {},
    maxima,
    pauze: (await instelling<AgentPauze | null>(tx, 'agentenGepauzeerd')) ?? null,
    creditsPerSoort: (await instelling<Partial<Record<AiSoort, number>>>(tx, 'agentCreditsPerSoort')) ?? {},
    werkdagen: (await instelling<Record<string, unknown>>(tx, 'werkdagen')) ?? {},
  }
}

const maandStart = (nu: Date) => nlTijdstip(`${nlMoment(nu).datum.slice(0, 8)}01`, 0).toISOString()
const dagStart = (nu: Date) => nlTijdstip(nlMoment(nu).datum, 0).toISOString()

/**
 * De stand van de pot. Tot P33 de boeking in ai_credits levert, telt het verbruik uit
 * agent_runs; de leverancier kan in aiCredits een vaste pot of extra credits zetten.
 */
export async function creditsStandVoor(tx: Tx, org: string, nu = new Date()): Promise<CreditsStand> {
  const { stand } = await import('../credits')
  return stand(tx, org, nu)
}

/** Credits die agents vandaag aan deze AI-soort verbruikten. */
export async function agentCreditsVandaag(tx: Tx, soort: AiSoort, nu = new Date()): Promise<number> {
  return ((await tx.execute(sql`select coalesce(sum((kosten->>'credits')::int), 0)::int as c from agent_runs where kosten->>'soort' = ${soort} and uitkomst = 'uitgevoerd' and op >= ${dagStart(nu)}`)).rows[0] as any)?.c ?? 0
}

export interface AgentRunRij {
  agent: string; handeling: string; mandaat: Mandaat; uitkomst: 'uitgevoerd' | 'als_taak' | 'geblokkeerd' | 'fout'
  gebruikerId?: string | null; accountId?: string | null; contactId?: string | null; taskId?: string | null; reden?: string | null
  bronnen?: unknown[]; kosten?: { soort: string; credits: number; cent?: number } | null
}

/** Het logboek: elke agenthandeling, ook wat werd tegengehouden. */
export async function logAgentRun(tx: Tx, org: string, r: AgentRunRij, nu = new Date()) {
  const [rij] = await tx.insert(schema.agentRuns).values({
    organisationId: org, agent: r.agent, handeling: r.handeling, mandaatNiveau: r.mandaat, uitkomst: r.uitkomst, gebruikerId: r.gebruikerId ?? null,
    accountId: r.accountId ?? null, contactId: r.contactId ?? null, taskId: r.taskId ?? null, reden: r.reden ?? null, bronnen: r.bronnen ?? [], kosten: r.kosten ?? null, op: nu.toISOString(),
  }).returning({ id: schema.agentRuns.id })
  return rij!.id
}

/** Blokkades van de motor loggen; dezelfde blokkade staat er hooguit één keer per dag. */
export async function logTegengehouden(tx: Tx, org: string, lijst: Tegengehouden[], nu = new Date()) {
  if (!lijst.length) return 0
  const al = await tx.select({ agent: schema.agentRuns.agent, handeling: schema.agentRuns.handeling, accountId: schema.agentRuns.accountId, reden: schema.agentRuns.reden })
    .from(schema.agentRuns).where(and(eq(schema.agentRuns.uitkomst, 'geblokkeerd'), gte(schema.agentRuns.op, dagStart(nu)), inArray(schema.agentRuns.accountId, lijst.map((t) => t.accountId!).filter(Boolean))))
  const gezien = new Set(al.map((a) => `${a.agent}|${a.handeling}|${a.accountId}|${a.reden}`))
  let n = 0
  for (const t of lijst) {
    const k = `${t.agent}|${t.handeling}|${t.accountId}|${t.reden}`
    if (gezien.has(k)) continue
    gezien.add(k)
    await logAgentRun(tx, org, { agent: t.agent, handeling: t.handeling, mandaat: t.mandaat, uitkomst: 'geblokkeerd', accountId: t.accountId, gebruikerId: t.ownerId, reden: t.reden, bronnen: t.regelId ? [{ regel: t.regelId }] : [] }, nu)
    n++
  }
  return n
}

export interface Voorstel {
  agent: string
  handeling: string
  /** Namens wie (bepaalt het niveau en een eigen mandaat). */
  gebruiker?: { id: string; niveau: string; data?: { mandaat?: Record<string, { mandaat: Mandaat; dagplafond?: number | null }> } | null } | null
  accountId?: string | null
  contactId?: string | null
  kanaal?: Kanaal | null
  naarBuiten?: boolean
  binnenKader?: boolean
  eersteBericht?: boolean
  /** AI-handeling: de soort voor de creditscheck. */
  ai?: AiSoort | null
  /** Hoeveel deze agent vandaag namens deze gebruiker al deed (dagplafond). */
  vandaagGedaan?: number
}

export interface Toets { mag: boolean; uitvoering: Uitvoering; reden?: string; mandaat: Mandaat; credits?: number }

/** Het effectieve mandaat van een agent namens een gebruiker. */
export function mandaatVoor(stand: AgentStand, agent: string, gebruiker: Voorstel['gebruiker'], naarBuiten = false): Mandaat {
  const inst = stand.mandaten[agent]
  if (inst && inst.aan === false) return 'D'
  return effectiefMandaat(agent, {
    platform: stand.maxima[agent] ?? null,
    organisatie: inst?.mandaat ?? organisatieMaximum(agent, stand.maxima[agent]),
    niveau: (gebruiker?.niveau ?? 'expert') as 'beginner' | 'gevorderd' | 'expert',
    eigen: gebruiker?.data?.mandaat?.[agent]?.mandaat ?? null,
    gepauzeerd: !!stand.pauze,
    naarBuiten,
  })
}

/**
 * De toets vóór elke agenthandeling: mandaat, consent, afkoeling, ritme, capaciteit,
 * AI-credits en werkuren. Een blokkade wordt direct gelogd.
 */
export async function toets(tx: Tx, org: string, v: Voorstel, nu = new Date(), stand?: AgentStand): Promise<Toets> {
  const st = stand ?? await laadAgentStand(tx, org)
  const mandaat = mandaatVoor(st, v.agent, v.gebruiker, v.naarBuiten)
  const ctx: HandelingContext = { mandaat, kanaal: v.kanaal ?? null, naarBuiten: v.naarBuiten, binnenKader: v.binnenKader, eersteBericht: v.eersteBericht, werkdagen: st.werkdagen as any }
  if (v.accountId) {
    const [a] = await tx.select({ nbStatus: schema.accounts.nbStatus, data: schema.accounts.data }).from(schema.accounts).where(eq(schema.accounts.id, v.accountId))
    if (a) {
      ctx.account = { nbStatus: a.nbStatus, data: { nee: (a.data as any)?.nee ?? null, wachtendTot: (a.data as any)?.wachtendTot ?? null } }
      const ritme = (a.data as any)?.reis?.ritme
      if (ritme?.actief && v.handeling.startsWith('ritme:') && !v.handeling.startsWith(`ritme:${ritme.ritmeId}`)) ctx.anderRitme = true
    }
  }
  if (v.contactId) {
    const [c] = await tx.select({ rol: schema.contacts.rol, data: schema.contacts.data }).from(schema.contacts).where(eq(schema.contacts.id, v.contactId))
    if (c) ctx.contact = { rol: c.rol, belMeNiet: !!(c.data as any)?.belMeNiet, consent: (c.data as any)?.consent ?? null }
  }
  let credits: number | undefined
  if (v.ai) {
    const cs = await creditsStandVoor(tx, org, nu)
    ctx.ai = agentMagAi(cs, v.ai, st.pakket, st.creditsPerSoort[v.ai] ?? null, await agentCreditsVandaag(tx, v.ai, nu))
    credits = creditsVoor(v.ai)
  }
  const plafond = v.gebruiker?.data?.mandaat?.[v.agent]?.dagplafond ?? st.mandaten[v.agent]?.dagplafond ?? null
  if (plafond != null && (v.vandaagGedaan ?? 0) >= plafond) ctx.dagplafondBereikt = true
  // Een kanaal dat de beheerder in Kanalen en consent uitzette (P26), gaat nooit.
  const uit = v.kanaal ? ((await tx.execute(sql`select value from org_settings where key = 'kanalenUit'`)).rows[0] as any)?.value : null
  const b = Array.isArray(uit) && uit.includes(v.kanaal) ? { mag: false, uitvoering: 'geblokkeerd' as const, reden: `Kanaal ${v.kanaal} staat uit` } : magHandelen(v.agent, v.handeling, nu, ctx)
  if (!b.mag) {
    await logAgentRun(tx, org, { agent: v.agent, handeling: v.handeling, mandaat, uitkomst: 'geblokkeerd', gebruikerId: v.gebruiker?.id, accountId: v.accountId, contactId: v.contactId, reden: b.reden }, nu)
  }
  return { ...b, mandaat, credits }
}
