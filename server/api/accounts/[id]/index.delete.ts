// DELETE /api/accounts/:id bestaat niet meer (0064): niemand verwijdert een prospect in de gewone app. Deze route
// weigert altijd met 405, zodat een oude aanroep niet bij de paginaweergave uitkomt. Deactiveren gaat via
// POST /api/accounts/:id/deactiveren; de historie blijft dan bewaard.
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  await vereisOrganisatie(event)
  setResponseHeader(event, 'Allow', 'GET, PUT')
  throw createError({ statusCode: 405, statusMessage: 'Verwijderen kan niet; deactiveer de prospect' })
})
