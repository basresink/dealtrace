// GET /api/agents/credits?maand=YYYY-MM: per AI-soort de credits van de agents deze maand
// en vandaag, het dagplafond en de stand van de pot (beheerder; salesmanager lezen).
import { sql } from 'drizzle-orm'
import { AI_SOORT, AI_SOORTEN, AGENT_STOP_ONDER, soortAanIn } from '../../../shared/credits'
import { nlMoment, nlTijdstip } from '../../../shared/datum'
import { metOrganisatie } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { creditsStandVoor, laadAgentStand } from '../../utils/agents/bewaker'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'agents.beheer') && !kan(ctx, 'verbruik.lezen')) weigerFunctie('verbruik.lezen', 'niveau')
  const nu = new Date()
  const q = getQuery(event)
  const maand = typeof q.maand === 'string' && /^\d{4}-\d{2}$/.test(q.maand) ? q.maand : nlMoment(nu).datum.slice(0, 7)
  const van = nlTijdstip(`${maand}-01`, 0).toISOString()
  const [j, m] = maand.split('-').map(Number)
  const tot = nlTijdstip(`${m === 12 ? j! + 1 : j}-${String(m === 12 ? 1 : m! + 1).padStart(2, '0')}-01`, 0).toISOString()
  const dag = nlTijdstip(nlMoment(nu).datum, 0).toISOString()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand = await laadAgentStand(tx, ctx.organisatie.id)
    const rijen = (await tx.execute(sql`select kosten->>'soort' as soort, sum((kosten->>'credits')::int)::int as maand,
      coalesce(sum((kosten->>'credits')::int) filter (where op >= ${dag}), 0)::int as vandaag
      from agent_runs where kosten is not null and uitkomst = 'uitgevoerd' and op >= ${van} and op < ${tot} group by 1`)).rows as { soort: string; maand: number; vandaag: number }[]
    return {
      maand, stand: await creditsStandVoor(tx, ctx.organisatie.id, nu), stopOnder: AGENT_STOP_ONDER,
      soorten: AI_SOORTEN.map((s) => ({
        soort: s, naam: AI_SOORT[s].naam, credits: AI_SOORT[s].credits, aan: soortAanIn(s, stand.pakket),
        maand: rijen.find((r) => r.soort === s)?.maand ?? 0, vandaag: rijen.find((r) => r.soort === s)?.vandaag ?? 0, dagplafond: stand.creditsPerSoort[s] ?? null,
      })),
      kan: { beheer: kan(ctx, 'agents.beheer') },
    }
  })
})
