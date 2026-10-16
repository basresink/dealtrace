// POST /api/help/:id/gelezen {vragenGoed?}: markeer als gelezen; idempotent per gebruiker en artikel. Met de
// controlevragen wordt het aantal goede antwoorden bewaard voor de statistiek.
import { metOrganisatie } from '../../../utils/db'
import { markeerGelezen } from '../../../utils/help'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id') ?? ''
  const b = await readBody<{ vragenGoed?: number }>(event).catch(() => ({} as { vragenGoed?: number }))
  const ok = await metOrganisatie(ctx.organisatie.id, (tx) => markeerGelezen(tx, ctx.organisatie.id, ctx.gebruiker.id, id, b?.vragenGoed ?? null))
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
  return { gelezen: true }
})
