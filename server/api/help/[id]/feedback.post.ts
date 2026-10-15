// POST /api/help/:id/feedback {nuttig, reden?}: "Was dit nuttig?". Nee vraagt een reden.
import { FEEDBACK_REDENEN } from '../../../../shared/help'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id') ?? ''
  const b = await readBody<{ nuttig?: boolean; reden?: string }>(event)
  if (typeof b?.nuttig !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'nuttig ontbreekt' })
  if (!b.nuttig && !(FEEDBACK_REDENEN as readonly string[]).includes(b.reden ?? '')) throw createError({ statusCode: 422, statusMessage: 'Kies een reden' })
  await metOrganisatie(ctx.organisatie.id, async (tx) => {
    await tx.insert(schema.helpFeedback).values({ organisationId: ctx.organisatie.id, gebruikerId: ctx.gebruiker.id, artikelId: id, nuttig: b.nuttig!, reden: b.nuttig ? null : b.reden! })
  })
  setResponseStatus(event, 204)
  return null
})
