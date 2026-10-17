// POST /api/accounts/:id/deactiveren {reden, toelichting?}: deactiveren in plaats van verwijderen (0064).
// Reden uit de vaste lijst (shared/deactiveren.ts), bij Overig met toelichting. De eigenaar, de salesmanager
// van zijn team en de beheerder mogen het; lopend werk stopt met de reden erbij, de historie blijft.
import { controleerDeactivering } from '../../../../shared/deactiveren'
import { metOrganisatie } from '../../../utils/db'
import { alsHttp, deactiveer } from '../../../utils/deactiveren'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.deactiveren')
  const id = getRouterParam(event, 'id')!
  const invoer = controleerDeactivering(await readBody(event).catch(() => null))
  if (typeof invoer === 'string') throw createError({ statusCode: 422, statusMessage: invoer })
  return metOrganisatie(ctx.organisatie.id, (tx) => deactiveer(tx, ctx.organisatie.id, ctx.gebruiker, id, invoer).catch(alsHttp))
})
