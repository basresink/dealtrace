// GET /api/coaching: de teamleden met het laatste coachingsgesprek en open afspraken (P21).
import { coachingOverzicht } from '../../utils/coaching'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { zichtbareTeams } from '../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const teams = await zichtbareTeams(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol })
    return { teams, leden: await coachingOverzicht(tx, teams.map((t) => t.id)) }
  })
})
