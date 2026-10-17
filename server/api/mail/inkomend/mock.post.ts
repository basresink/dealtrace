// POST /api/mail/inkomend/mock {van, onderwerp?, tekst?, berichtId?}: de mock-adapter voor lokaal en tests. Zet een
// mail in het postvak in het geheugen en leest het postvak meteen uit, zoals de cron doet. Alleen als de mailkoppeling
// van de organisatie op mock staat; anders 409.
import { metOrganisatie } from '../../../utils/db'
import { mailKoppeling } from '../../../utils/mail'
import { leesWebhook, pollPostvak, zetInMockPostvak } from '../../../utils/mailInkomend'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const m = leesWebhook(await readBody<any>(event))
  if (!m) throw createError({ statusCode: 422, statusMessage: 'Geef een afzender (van)' })
  const org = ctx.organisatie.id
  return metOrganisatie(org, async (tx) => {
    const k = await mailKoppeling(tx)
    if (!k || k.modus !== 'mock') throw createError({ statusCode: 409, statusMessage: 'Alleen met een mailkoppeling in de testmodus (mock)' })
    zetInMockPostvak(org, m)
    return pollPostvak(tx, org)
  })
})
