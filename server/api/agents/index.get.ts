// GET /api/agents: stand per agent, tellers van vandaag, pauze en wat de Bewaker vandaag
// tegenhield (vanaf Gevorderd; 403 bij Beginner).
import { and, eq, gte, sql } from 'drizzle-orm'
import { AGENTS, ALTIJD_AAN, mandaatOpties, organisatieMaximum } from '../../../shared/mandaat'
import { nlMoment, nlTijdstip } from '../../../shared/datum'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { laadAgentStand, mandaatVoor } from '../../utils/agents/bewaker'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agents.lezen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand = await laadAgentStand(tx, ctx.organisatie.id)
    const vanaf = nlTijdstip(nlMoment(new Date()).datum, 0).toISOString()
    const tellers = (await tx.execute(sql`select agent, count(*) filter (where uitkomst in ('uitgevoerd', 'als_taak'))::int as gedaan, count(*) filter (where uitkomst = 'geblokkeerd')::int as geblokkeerd
      from agent_runs where op >= ${vanaf} group by agent`)).rows as { agent: string; gedaan: number; geblokkeerd: number }[]
    const gebruiker = { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data as any }
    const beheer = kan(ctx, 'agents.beheer')
    const agents = AGENTS.map((a) => {
      const max = organisatieMaximum(a.sleutel, stand.maxima[a.sleutel])
      const inst = stand.mandaten[a.sleutel]
      const t = tellers.find((x) => x.agent === a.sleutel)
      return {
        sleutel: a.sleutel, naam: a.naam, omschrijving: a.omschrijving, gebouwd: a.gebouwd, altijdAan: ALTIJD_AAN.has(a.sleutel),
        max, opties: mandaatOpties(max), mandaat: inst?.mandaat ?? max, dagplafond: inst?.dagplafond ?? null, aan: inst?.aan !== false,
        perNiveau: a.perNiveau, vandaagGedaan: t?.gedaan ?? 0, vandaagTegengehouden: t?.geblokkeerd ?? 0,
        voorMij: mandaatVoor(stand, a.sleutel, gebruiker), eigen: (ctx.gebruiker.data as any)?.mandaat?.[a.sleutel] ?? null,
      }
    })
    // Beheerder en salesmanager zien alles; een Expert de blokkades op zijn eigen accounts.
    const alles = beheer || ctx.gebruiker.rol === 'salesmanager'
    const tegengehouden = kan(ctx, 'agents.waaromNiet') || beheer
      ? await tx.select({ id: schema.agentRuns.id, agent: schema.agentRuns.agent, handeling: schema.agentRuns.handeling, reden: schema.agentRuns.reden, op: schema.agentRuns.op, accountId: schema.agentRuns.accountId, account: schema.accounts.name })
        .from(schema.agentRuns).leftJoin(schema.accounts, eq(schema.accounts.id, schema.agentRuns.accountId))
        .where(and(eq(schema.agentRuns.uitkomst, 'geblokkeerd'), gte(schema.agentRuns.op, vanaf), alles ? sql`true` : eq(schema.accounts.ownerId, ctx.gebruiker.id)))
        .orderBy(sql`${schema.agentRuns.op} desc`).limit(100)
      : []
    return {
      agents, pauze: stand.pauze, tegengehouden,
      kan: { beheer, eigenMandaat: kan(ctx, 'agents.eigenMandaat') && ctx.gebruiker.rol === 'accountmanager', waaromNiet: kan(ctx, 'agents.waaromNiet'), verbruik: kan(ctx, 'verbruik.lezen') || beheer },
    }
  })
})
