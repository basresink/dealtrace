// GET /api/signals/tegengehouden?dagen=30: "Toon tegengehouden" (P19, Expert). Inzichten die de
// bewijsplicht, de ouderdom of de minimale relevantie tegenhield, met de reden. Buiten de gewone feed.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agents.waaromNiet')
  const q = getQuery(event)
  const dagen = Math.min(365, Math.max(1, Number(q.dagen) || 30))
  const alles = ctx.gebruiker.rol === 'beheerder' || ctx.gebruiker.rol === 'salesmanager'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rows = (await tx.execute(sql`select s.id, s.title, s.agent, s.type, s.bron, s.relevance_score, s.created_at, s.data, a.id as account_id, a.name as account
      from signals s left join accounts a on a.id = s.account_id
      where s.status = 'tegengehouden' and s.created_at >= now() - make_interval(days => ${dagen}) ${alles ? sql`` : sql`and s.owner_id = ${ctx.gebruiker.id}`}
      order by s.created_at desc limit 200`)).rows as any[]
    return rows.map((r) => ({ id: r.id, title: r.title, agent: r.agent, type: r.type, bron: r.bron, relevantie: r.relevance_score, createdAt: new Date(r.created_at).toISOString(), reden: r.data?.tegenhoudReden ?? null, specifiekeBron: r.data?.bron?.naam ?? null, account: r.account_id ? { id: r.account_id, naam: r.account } : null }))
  })
})
