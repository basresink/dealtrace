// POST /api/koppelingen/salesdna/mock-stuur {bestand}: alleen lokaal. Stuurt een fixture uit seed/webhooks
// gesigneerd naar de eigen webhook, zoals de mock van SalesDNA dat zou doen (13.5). Online bestaat hij niet.
import { MOCK_FIXTURES } from '../../../utils/bronnen/salesdna'
import { ontsleutel } from '../../../utils/geheimen'
import { metOrganisatie } from '../../../utils/db'
import { koppeling } from '../../../utils/salesdna'
import { teken } from '../../../utils/salesdnaWebhook'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  if (useRuntimeConfig().online) throw createError({ statusCode: 404 })
  const ctx = await vereisFunctie(event, 'koppeling.salesdna')
  const { bestand } = await readBody<{ bestand?: string }>(event)
  const k = await metOrganisatie(ctx.organisatie.id, (tx) => koppeling(tx, ctx.organisatie.id))
  const geheim = ontsleutel(k?.geheimen)?.geheim
  if (!k || !geheim) throw createError({ statusCode: 409, statusMessage: 'Koppel eerst met adres "mock"' })
  const alle: Record<string, any> = { ...Object.fromEntries(MOCK_FIXTURES.basis.map((b) => [b.onderwerpId, b])), 'L0.8-verouderd': MOCK_FIXTURES.verouderd.l08, 'L0.4-v3': MOCK_FIXTURES.los.l04v3, 'L0.6-v2': MOCK_FIXTURES.los.l06v2 }
  const b = alle[bestand ?? '']
  if (!b) throw createError({ statusCode: 404, statusMessage: 'Onbekende fixture' })
  const nu = new Date().toISOString()
  const body = JSON.stringify({ ...b, eventId: `${b.eventId}-${Date.now()}`, tijd: nu })
  const id = JSON.parse(body).eventId
  const url: string = `/api/koppelingen/salesdna/webhook/${k.id}`
  return ($fetch as any)(url, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-salesdna-signature': teken(body, geheim), 'x-salesdna-event-id': id, 'x-salesdna-tijd': nu } })
})
