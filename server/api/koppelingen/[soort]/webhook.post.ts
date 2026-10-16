// POST /api/koppelingen/:soort/webhook?k=<koppelingId>: een wijziging in het CRM (HubSpot, handtekening v3).
// Geen sessie; 401 bij een ongeldige handtekening of een te oud tijdstip. Daarna een synchronisatie
// voor die ene organisatie.
import { sql } from 'drizzle-orm'
import { syncCrm } from '../../../utils/crm'
import { crmSoortUit, hubspotHandtekeningKlopt } from '../../../utils/crmApi'
import { gebruikDb, metOrganisatie } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const soort = crmSoortUit(event)
  const rauw = (await readRawBody(event, 'utf8')) ?? ''
  const ok = hubspotHandtekeningKlopt(process.env.HUBSPOT_CLIENT_SECRET ?? '', 'POST', getRequestURL(event).href, rauw, getHeader(event, 'x-hubspot-request-timestamp') ?? '', getHeader(event, 'x-hubspot-signature-v3') ?? '')
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Handtekening of tijdstip ongeldig' })
  const id = String(getQuery(event).k ?? '')
  const [k] = (await gebruikDb().execute(sql`select * from dealtrace_crm_koppeling(${id})`)).rows as any[]
  if (!k || k.soort !== soort || k.status !== 'actief') throw createError({ statusCode: 401, statusMessage: 'Onbekende koppeling' })
  const job = metOrganisatie(k.organisation_id, (tx) => syncCrm(tx, k.organisation_id, { soort, handeling: 'uur' })).catch(() => undefined)
  event.waitUntil?.(job)
  setResponseStatus(event, 202)
  return { ok: true }
})
