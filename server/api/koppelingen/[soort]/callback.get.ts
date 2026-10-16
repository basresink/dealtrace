// GET /api/koppelingen/:soort/callback?code&state: terug uit het CRM. 401 zonder sessie; 400 bij een
// onbekende of verlopen state. De state wordt binnen de organisatie van de sessie gezocht (RLS), dus
// een callback van organisatie A kan nooit tokens in organisatie B zetten. Tokens versleuteld (doel crm).
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { crmModus } from '../../../utils/bronnen/crm/adapter'
import { hubspotRuilCode } from '../../../utils/bronnen/crm/hubspot'
import { crmSoortUit, terugUrl } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { versleutel } from '../../../utils/geheimen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crm')
  const soort = crmSoortUit(event, true)
  const q = getQuery(event)
  const state = typeof q.state === 'string' ? q.state : ''
  const code = typeof q.code === 'string' ? q.code : ''
  const geldig = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = (await tx.execute(sql`delete from koppeling_states where state = ${state} and gebruiker_id = ${ctx.gebruiker.id} and soort = ${soort} returning verloopt_op`)).rows as any[]
    return !!s && new Date(s.verloopt_op).getTime() > Date.now()
  })
  if (!geldig || !code) throw createError({ statusCode: 400, statusMessage: 'Deze koppelpoging is onbekend of verlopen. Begin opnieuw bij Verbind met HubSpot.' })
  let tokens: { access: string; refresh: string; verloopt: string }
  try {
    tokens = crmModus() === 'mock' ? { access: `mock-${crypto.randomUUID()}`, refresh: `mock-${crypto.randomUUID()}`, verloopt: new Date(Date.now() + 3600_000).toISOString() } : await hubspotRuilCode(code, terugUrl(event, soort))
  } catch (e: any) { return sendRedirect(event, `/instellingen/koppelingen/crm?fout=${encodeURIComponent(e.message)}`) }
  await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const op = new Date().toISOString()
    const inst = { account: crmModus() === 'mock' ? 'Testportaal (mock)' : 'HubSpot', verbondenOp: op, laatsteFout: null }
    await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen, getest_op) values (${ctx.organisatie.id}, ${soort}, 'actief', ${versleutel(tokens, 'crm')}, ${JSON.stringify(inst)}::jsonb, now())
      on conflict (organisation_id, soort) do update set status = 'actief', geheimen = excluded.geheimen, instellingen = koppelingen.instellingen || excluded.instellingen, getest_op = now(), updated_at = now()`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'koppeling.crm.verbonden', resourceType: 'koppelingen', resourceId: soort, changes: { soort } })
  })
  return sendRedirect(event, '/instellingen/koppelingen/crm?verbonden=1')
})
