// POST /api/belscripts/prospect/vul {accountId, contactId?, scriptId?}: Vul met AI. Eén aanroep via de
// AI-schil met credits (soort belscript). Het resultaat is een concept: elk AI-blok wacht op bevestigen,
// aanpassen of verwerpen. Zonder pakket of niveau: 403 met de reden; zonder credits: 402.
import { metOrganisatie } from '../../../utils/db'
import { aiStand, vulProspect } from '../../../utils/belscriptStudio'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const b = await readBody<{ accountId?: string; contactId?: string | null; scriptId?: string | null }>(event)
  if (!b?.accountId) throw createError({ statusCode: 400, statusMessage: 'accountId is verplicht' })
  const stand = aiStand(ctx)
  if (!stand.aan) throw createError({ statusCode: 403, statusMessage: stand.reden! })
  return metOrganisatie(ctx.organisatie.id, (tx) => vulProspect(tx, ctx, { accountId: b.accountId!, contactId: b.contactId ?? null, scriptId: b.scriptId ?? null }))
})
