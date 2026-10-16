// POST /api/stripe/webhook: events van Stripe Billing, zonder sessie. 400 bij een ongeldige handtekening
// (STRIPE_WEBHOOK_SECRET); een dubbel event-id doet niets. Een mislukte incasso pauzeert AI, niet de app.
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { controleerStripe, verwerkStripeEvent } from '../../utils/platformBeheer'

export default defineEventHandler(async (event) => {
  const rauw = (await readRawBody(event, 'utf8')) ?? ''
  if (!controleerStripe(rauw, getHeader(event, 'stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) throw createError({ statusCode: 400, statusMessage: 'Ongeldige handtekening' })
  let e: any
  try { e = JSON.parse(rauw) } catch { throw createError({ statusCode: 400, statusMessage: 'Geen geldige JSON' }) }
  if (!e?.id || !e?.type || !e?.data?.object) throw createError({ statusCode: 400, statusMessage: 'Onbekend event' })
  return { resultaat: await verwerkStripeEvent({ buiten: (w) => gebruikDb().transaction(w), inOrg: metOrganisatie }, e) }
})
