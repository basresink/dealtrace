// GET /api/analyse/regio?scope=eigen|team: "Waar laat je potentie liggen?" (F18). Accountmanager
// eigen accounts; salesmanager ook het team (403 voor de teamscope zonder die rol).
import { sql } from 'drizzle-orm'
import { regioAnalyse } from '../../utils/bezoeken'
import { metOrganisatie } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'regio.analyse')
  const scope = getQuery(event).scope === 'team' ? 'team' : 'eigen'
  const manager = ['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol)
  if (scope === 'team' && !manager) throw createError({ statusCode: 403, statusMessage: 'De teamweergave is voor de salesmanager' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    let eigenaren: string[] | null = [ctx.gebruiker.id]
    if (scope === 'team') {
      if (ctx.gebruiker.rol === 'beheerder') eigenaren = null
      else {
        const teams = await eigenTeams(tx, ctx.gebruiker.id)
        eigenaren = ((await tx.execute(sql`select id, team_id from users`)).rows as any[]).filter((u) => teams.includes(u.team_id)).map((u) => u.id)
      }
    }
    return { scope, manager, ...(await regioAnalyse(tx, eigenaren)) }
  })
})
