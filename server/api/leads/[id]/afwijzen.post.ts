// POST /api/leads/:id/afwijzen {reden}: "Niet relevant". De reden staat op de server; het bedrijf
// komt in een volgende ronde niet terug, ook niet op een ander toestel (gat 47).
import { AFWIJSREDENEN } from '../../../../shared/leadGenerator'
import { metOrganisatie } from '../../../utils/db'
import { wijsAf } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.overnemen')
  const b = await readBody<{ reden?: string }>(event)
  const reden = AFWIJSREDENEN.find((r) => r === b?.reden)
  if (!reden) throw createError({ statusCode: 422, statusMessage: 'Kies een reden' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const l = await wijsAf(tx, ctx.gebruiker.id, getRouterParam(event, 'id')!, reden)
    return { id: l.id, status: l.status, reden }
  })
})
