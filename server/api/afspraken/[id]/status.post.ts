// POST /api/afspraken/:id/status {status: 'niet_verschenen' | 'geannuleerd'}.
import { metOrganisatie } from '../../../utils/db'
import { zetAfspraakStatus } from '../../../utils/agenda'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const { status } = await readBody<{ status?: string }>(event)
  if (status !== 'niet_verschenen' && status !== 'geannuleerd') throw createError({ statusCode: 422, statusMessage: 'Kies niet verschenen of geannuleerd' })
  return metOrganisatie(ctx.organisatie.id, (tx) => zetAfspraakStatus(tx, ctx.organisatie.id, getRouterParam(event, 'id')!, ctx.gebruiker.id, status))
})
