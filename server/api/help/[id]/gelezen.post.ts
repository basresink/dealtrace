// POST /api/help/:id/gelezen: markeer als gelezen; idempotent per gebruiker en artikel.
import { metOrganisatie } from '../../../utils/db'
import { markeerGelezen } from '../../../utils/help'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id') ?? ''
  const ok = await metOrganisatie(ctx.organisatie.id, (tx) => markeerGelezen(tx, ctx.organisatie.id, ctx.gebruiker.id, id))
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
  return { gelezen: true }
})
