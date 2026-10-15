// Gedeelde handler voor de SalesDNA-webhook (pad met koppelings-id, of header X-SalesDNA-Koppeling).
// Antwoordt meteen; de verwerking loopt daarna als job (waitUntil), zodat SalesDNA binnen 5 s 2xx krijgt.
import type { H3Event } from 'h3'
import { ontvang, verwerkWachtende } from './salesdna'

export async function webhook(event: H3Event, koppelingId: string | null | undefined) {
  const rauw = (await readRawBody(event, 'utf8')) ?? ''
  const r = await ontvang(koppelingId, rauw, {
    handtekening: getHeader(event, 'x-salesdna-signature'), eventId: getHeader(event, 'x-salesdna-event-id'), tijd: getHeader(event, 'x-salesdna-tijd'),
  })
  if (r.status === 401) throw createError({ statusCode: 401, statusMessage: 'Handtekening of tijdstip ongeldig' })
  if (r.resultaat === 'wacht' && r.org) {
    const job = verwerkWachtende(r.org).catch(() => undefined)
    event.waitUntil?.(job)
  }
  setResponseStatus(event, r.status)
  return { ok: true, resultaat: r.resultaat }
}
