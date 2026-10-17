// POST /api/leads/:id/afwijzen {reden, toelichting?}: "Niet relevant". Een vaste reden uit AFWIJSREDENEN of
// "Andere reden" met een eigen tekst (3 tot 200 tekens, anders 422). De reden staat op de server; het
// bedrijf komt in een volgende ronde niet terug, ook niet op een ander toestel (gat 47).
import { leesLeadAfwijsReden } from '../../../../shared/leadGenerator'
import { metOrganisatie } from '../../../utils/db'
import { wijsAf } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.overnemen')
  const b = await readBody<{ reden?: string; toelichting?: string }>(event)
  const k = leesLeadAfwijsReden(b?.reden, b?.toelichting)
  if (!k.ok) throw createError({ statusCode: 422, statusMessage: k.melding })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const l = await wijsAf(tx, ctx.gebruiker.id, getRouterParam(event, 'id')!, k.reden, k.toelichting)
    return { id: l.id, status: l.status, reden: k.reden, toelichting: k.toelichting }
  })
})
