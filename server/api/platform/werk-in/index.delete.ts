// DELETE /api/platform/werk-in: "Terug naar platform". Cookie weg, auditregel "einde".
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'
import { leesWerkInInhoud, wisWerkIn } from '../../../utils/werkIn'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const inhoud = await leesWerkInInhoud(event)
  wisWerkIn(event)
  if (inhoud?.founderId === ctx.gebruiker.id) {
    await alsPlatform((tx) => platformAudit(tx, event, ctx, { organisatieId: inhoud.organisatieId, handeling: 'werkin.einde', object: inhoud.organisatieId, voor: { modus: inhoud.modus } }))
  }
  setResponseStatus(event, 204)
  return null
})
