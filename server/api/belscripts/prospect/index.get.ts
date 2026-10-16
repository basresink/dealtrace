// GET /api/belscripts/prospect?accountId=&contactId=&scriptId=: alles voor het tabblad Per prospect en
// het voorbeeld van de belmodus: kaart, gekozen standaardscript met reden, de gegevens die de AI krijgt
// (met bron, en wat ontbreekt), de bewaarde versies en of de AI mag vullen.
import { AI_SOORT } from '../../../../shared/credits'
import { metOrganisatie } from '../../../utils/db'
import { aiStand, prospectContext } from '../../../utils/belscriptStudio'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const q = getQuery(event)
  const accountId = typeof q.accountId === 'string' ? q.accountId : ''
  if (!accountId) throw createError({ statusCode: 400, statusMessage: 'accountId is verplicht' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const p = await prospectContext(tx, ctx, accountId, { contactId: typeof q.contactId === 'string' ? q.contactId : null, scriptId: typeof q.scriptId === 'string' ? q.scriptId : null })
    return { ...p, ai: { ...aiStand(ctx), credits: AI_SOORT.belscript.credits } }
  })
})
