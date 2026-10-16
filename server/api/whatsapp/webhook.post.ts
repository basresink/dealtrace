// POST /api/whatsapp/webhook?org=: statussen en opt-outs van de provider. Ondertekend met HMAC-SHA256 over de
// ruwe body (x-hub-signature-256); zonder geldige handtekening 401. Een opt-out zet de toestemming op nee.
// GET met hub.challenge (verificatie bij Meta) staat in webhook.get.ts.
import { controleerWebhook } from '../../utils/bronnen/whatsapp'
import { metOrganisatie } from '../../utils/db'
import { verwerkWebhook, waKoppeling } from '../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const org = String(getQuery(event).org ?? '')
  const ruw = (await readRawBody(event, 'utf8')) ?? ''
  if (!/^[\w-]{3,80}$/.test(org)) throw createError({ statusCode: 401, statusMessage: 'Ongeldige handtekening' })
  return metOrganisatie(org, async (tx) => {
    const k = await waKoppeling(tx)
    if (!k || !controleerWebhook(ruw, getHeader(event, 'x-hub-signature-256'), k.webhookGeheim)) throw createError({ statusCode: 401, statusMessage: 'Ongeldige handtekening' })
    let body: any
    try { body = JSON.parse(ruw) } catch { throw createError({ statusCode: 400, statusMessage: 'Geen geldige JSON' }) }
    return verwerkWebhook(tx, body)
  })
})
