// GET /api/planning/jaar?scope=mij|team: kalender, knelpunten en maanddetail (F13). Vanaf
// Gevorderd; scope team alleen voor de salesmanager (eigen teams) en de beheerder.
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { jaarplanning, teamLeden } from '../../utils/planning'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'planning.jaar')
  const team = getQuery(event).scope === 'team' && ['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const r = await jaarplanning(tx, team ? await teamLeden(tx, ctx.gebruiker) : [ctx.gebruiker.id])
    return { ...r, scope: team ? 'team' : 'mij', kan: { inplannen: kan(ctx, 'planning.inplannen'), indelen: kan(ctx, 'prospects.klasseZetten'), team: ['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol) } }
  })
})
