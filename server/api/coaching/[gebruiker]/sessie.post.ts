// POST /api/coaching/:gebruiker/sessie {datum}: een nieuwe coachingsessie met een momentopname van de cijfers. 422 zonder datum.
import { sql } from 'drizzle-orm'
import { cijfers } from '../../../utils/coaching'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { vereisTeamlid } from '../../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  const b = await readBody<{ datum?: string }>(event)
  if (!b?.datum || !/^\d{4}-\d{2}-\d{2}$/.test(b.datum)) throw createError({ statusCode: 422, statusMessage: 'Kies een datum' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const u = await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, getRouterParam(event, 'gebruiker')!)
    const c = await cijfers(tx, u as any)
    const [s] = (await tx.execute(sql`insert into coaching_sessies (organisation_id, gebruiker_id, manager_id, datum, data) values (${ctx.organisatie.id}, ${u.id}, ${ctx.gebruiker.id}, ${b.datum}, ${JSON.stringify({ cijfers: { kpi: c.kpi, conversie: c.conversie, team: c.team }, punten: [], gesprekken: [] })}::jsonb) returning id, datum`)).rows as any[]
    return { id: s.id, datum: b.datum, punten: [] }
  })
})
