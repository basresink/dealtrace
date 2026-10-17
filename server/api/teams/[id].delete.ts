// DELETE /api/teams/:id: alleen een leeg team (beheerder). Met leden of teamregels 409 met uitleg.
import { metOrganisatie } from '../../utils/db'
import { verwijderTeam } from '../../utils/gebruikers'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder beheert teams' })
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(organisatie.id, (tx) => verwijderTeam(tx, organisatie.id, { id: gebruiker.id }, id))
})
