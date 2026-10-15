// DELETE /api/koppelingen/agenda/:provider: ontkoppelen; de tokens worden gewist.
import { ontkoppel, type Provider } from '../../../../utils/agenda'
import { schrijfAudit } from '../../../../utils/audit'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const p = getRouterParam(event, 'provider') as Provider
  if (!['microsoft', 'google'].includes(p)) throw createError({ statusCode: 404, statusMessage: 'Onbekende agenda' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await ontkoppel(tx, ctx.gebruiker.id, p)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'agenda.ontkoppelen', resourceType: 'agenda_koppelingen', resourceId: p, changes: {} })
    return { ok: true }
  })
})
