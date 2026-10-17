// POST /api/gebruikers/:id/heractiveer: een gearchiveerde gebruiker terugzetten (beheerder), binnen de seats.
import { metOrganisatie } from '../../../utils/db'
import { heractiveerGebruiker } from '../../../utils/gebruikers'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder heractiveert gebruikers' })
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(organisatie.id, (tx) => heractiveerGebruiker(tx, organisatie.id, { id: gebruiker.id }, id))
})
