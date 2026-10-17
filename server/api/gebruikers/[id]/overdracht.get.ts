// GET /api/gebruikers/:id/overdracht: wat er bij archiveren verhuist en aan wie (beheerder).
import { metOrganisatie } from '../../../utils/db'
import { overdrachtStand } from '../../../utils/gebruikers'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder archiveert gebruikers' })
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(organisatie.id, (tx) => overdrachtStand(tx, id))
})
