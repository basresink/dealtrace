// Gedeeld door de CRM-endpoints (P20): de soort uit de route, alleen bekende CRM's.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { CRM_BESCHIKBAAR, type CrmSoort } from '../../shared/crm'
import { isCrmSoort } from './crm'

export function crmSoortUit(event: H3Event, alleenBeschikbaar = false): CrmSoort {
  const s = getRouterParam(event, 'soort') ?? ''
  if (!isCrmSoort(s)) throw createError({ statusCode: 404, statusMessage: 'Onbekende koppeling' })
  if (alleenBeschikbaar && !CRM_BESCHIKBAAR.includes(s)) throw createError({ statusCode: 422, statusMessage: 'Deze koppeling volgt later' })
  return s
}
export const terugUrl = (event: H3Event, soort: CrmSoort) => `${getRequestURL(event).origin}/api/koppelingen/${soort}/callback`

/** HubSpot handtekening v3: HMAC-SHA256 over methode, URL, body en tijdstip; hooguit 5 minuten oud. */
export function hubspotHandtekeningKlopt(geheim: string, methode: string, url: string, body: string, tijd: string, handtekening: string, nu = Date.now()) {
  if (!geheim || !tijd || !handtekening || Math.abs(nu - Number(tijd)) > 5 * 60_000) return false
  const verwacht = createHmac('sha256', geheim).update(`${methode}${url}${body}${tijd}`).digest('base64')
  const a = Buffer.from(verwacht)
  const b = Buffer.from(handtekening)
  return a.length === b.length && timingSafeEqual(a, b)
}
