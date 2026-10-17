// GET /api/coaching: de teamleden met het laatste coachingsgesprek, tempo en achterstand over twee weken
// en de open afspraken uit eerdere gesprekken (P21).
import { nlMoment } from '../../../shared/datum'
import { coachingOverzicht } from '../../utils/coaching'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { zichtbareTeams } from '../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const teams = await zichtbareTeams(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol })
    return { teams, leden: await coachingOverzicht(tx, teams.map((t) => t.id), teams), vandaag: nlMoment(new Date()).datum }
  })
})
