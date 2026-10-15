// POST /api/regels/starterset {bevestigd: true}: de organisatieregels worden precies de
// 23 regels van de starterset (gat 41). Persoonlijke en teamregels blijven staan.
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { regelUitRij, zetStartersetTerug } from '../../utils/motor'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'regels.beheer')
  const b = await readBody<{ bevestigd?: boolean }>(event)
  if (b?.bevestigd !== true) throw createError({ statusCode: 428, statusMessage: 'Bevestig het terugzetten van de starterset' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await zetStartersetTerug(tx, ctx.organisatie.id)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regels.starterset', resourceType: 'activity_rules', changes: { aantal: rijen.length } })
    return { regels: rijen.map(regelUitRij) }
  })
})
