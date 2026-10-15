// Hoe een agent werkt (11.3): 1. voorstel, 2. de Bewaker (toets, met magHandelen),
// 3. uitvoering: A en B direct met een rij in activiteiten en agent_runs, C als taak met
// concept, D als taak met voorbereiding. Hier staan de schrijvers van executor_status
// 'concept-klaar', 'uitgevoerd' en 'tegengehouden' (gat 22); 'goedgekeurd' zet de mens.
import { eq } from 'drizzle-orm'
import { gaatNaarMens, type Mandaat } from '../../../shared/mandaat'
import { schema } from '../db'
import { logAgentRun, toets, type AgentStand, type Toets, type Voorstel } from './bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]

export interface AgentWerk {
  /** De taak als het naar de mens gaat (C, D of tegengehouden). */
  taak: { ownerId: string; title: string; actionType: string; dueDate?: string | null; waarom: string; concept?: unknown; campaignId?: string | null }
  /** De handeling zelf bij A of B. Geeft bronnen en kosten terug voor het logboek. */
  uitvoeren: (tx: Tx) => Promise<{ bronnen?: unknown[]; kosten?: { soort: string; credits: number } | null } | void>
}

export interface Afloop { uitkomst: 'uitgevoerd' | 'als_taak' | 'geblokkeerd'; toets: Toets; taskId?: string; runId?: string }

async function maakTaak(tx: Tx, org: string, v: Voorstel, w: AgentWerk, mandaat: Mandaat, executor: 'mens' | 'ai', status: 'concept-klaar' | 'tegengehouden' | null, waarom: string, nu: Date) {
  const tijd = nu.toISOString()
  const [t] = await tx.insert(schema.tasks).values({
    organisationId: org, ownerId: w.taak.ownerId, accountId: v.accountId ?? null, contactId: v.contactId ?? null, campaignId: w.taak.campaignId ?? null,
    actionType: w.taak.actionType, title: w.taak.title, dueDate: w.taak.dueDate ?? tijd, executor, executorStatus: status,
    data: { waarom, herkomst: { bron: 'agent', uitvoerder: w.taak.ownerId }, agent: v.agent, mandaat, ...(w.taak.concept !== undefined ? { concept: w.taak.concept } : {}) },
    createdAt: tijd, updatedAt: tijd,
  }).returning({ id: schema.tasks.id })
  return t!.id
}

/** Eén agenthandeling van voorstel tot uitvoering, altijd via de Bewaker. */
export async function voerUit(tx: Tx, org: string, v: Voorstel, w: AgentWerk, nu = new Date(), stand?: AgentStand): Promise<Afloop> {
  const b = await toets(tx, org, v, nu, stand)
  if (b.uitvoering === 'geblokkeerd') {
    // Credits of dagplafond: de handeling gaat als taak naar de mens, met de reden in de aanleiding.
    if (gaatNaarMens(b.reden)) {
      const taskId = await maakTaak(tx, org, v, w, b.mandaat, 'mens', 'tegengehouden', `Tegengehouden door de Bewaker: ${b.reden!.charAt(0).toLowerCase()}${b.reden!.slice(1)}`, nu)
      return { uitkomst: 'geblokkeerd', toets: b, taskId }
    }
    return { uitkomst: 'geblokkeerd', toets: b }
  }
  if (b.uitvoering === 'direct') {
    const r = (await w.uitvoeren(tx)) ?? {}
    const runId = await logAgentRun(tx, org, { agent: v.agent, handeling: v.handeling, mandaat: b.mandaat, uitkomst: 'uitgevoerd', gebruikerId: v.gebruiker?.id, accountId: v.accountId, contactId: v.contactId, bronnen: r.bronnen, kosten: r.kosten ?? null }, nu)
    return { uitkomst: 'uitgevoerd', toets: b, runId }
  }
  const concept = b.uitvoering === 'als_taak_concept'
  const taskId = await maakTaak(tx, org, v, w, b.mandaat, concept ? 'ai' : 'mens', concept ? 'concept-klaar' : null, `${w.taak.waarom}${b.reden ? ` (${b.reden})` : ''}`, nu)
  const runId = await logAgentRun(tx, org, { agent: v.agent, handeling: v.handeling, mandaat: b.mandaat, uitkomst: 'als_taak', gebruikerId: v.gebruiker?.id, accountId: v.accountId, contactId: v.contactId, taskId, reden: b.reden }, nu)
  return { uitkomst: 'als_taak', toets: b, taskId, runId }
}

/** Een goedgekeurd concept alsnog uitvoeren (na de mens), opnieuw langs de Bewaker. */
export async function voerGoedgekeurdUit(tx: Tx, org: string, taskId: string, v: Voorstel, uitvoeren: AgentWerk['uitvoeren'], nu = new Date()): Promise<Afloop> {
  // Goedgekeurd door de mens: het kader is er; afkoeling, consent en werkuren gelden nog steeds.
  const b = await toets(tx, org, { ...v, binnenKader: true, eersteBericht: false }, nu)
  const nogSteedsBuiten = b.uitvoering === 'geblokkeerd'
  if (nogSteedsBuiten) return { uitkomst: 'geblokkeerd', toets: b, taskId }
  const r = (await uitvoeren(tx)) ?? {}
  const tijd = nu.toISOString()
  await tx.update(schema.tasks).set({ executorStatus: 'uitgevoerd', status: 'klaar', updatedAt: tijd }).where(eq(schema.tasks.id, taskId))
  const runId = await logAgentRun(tx, org, { agent: v.agent, handeling: v.handeling, mandaat: 'C', uitkomst: 'uitgevoerd', gebruikerId: v.gebruiker?.id, accountId: v.accountId, contactId: v.contactId, taskId, bronnen: r.bronnen, kosten: r.kosten ?? null }, nu)
  return { uitkomst: 'uitgevoerd', toets: b, taskId, runId }
}
