// GET /api/koppelingen/:soort/start: OAuth starten (beheerder). De state hangt aan de sessie en de
// organisatie en vervalt na 10 minuten (regel 21; geen state in het geheugen). Lokaal (mock) gaat
// de stroom direct naar de callback.
import { sql } from 'drizzle-orm'
import { crmModus } from '../../../utils/bronnen/crm/adapter'
import { hubspotAutorisatieUrl } from '../../../utils/bronnen/crm/hubspot'
import { crmSoortUit, terugUrl } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crm')
  const soort = crmSoortUit(event, true)
  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await metOrganisatie(ctx.organisatie.id, async (tx) => {
    await tx.execute(sql`delete from koppeling_states where verloopt_op < now()`)
    await tx.execute(sql`insert into koppeling_states (state, organisation_id, gebruiker_id, soort, verloopt_op) values (${state}, ${ctx.organisatie.id}, ${ctx.gebruiker.id}, ${soort}, now() + interval '10 minutes')`)
  })
  if (crmModus() === 'mock') return sendRedirect(event, `/api/koppelingen/${soort}/callback?code=mock&state=${state}`)
  try { return sendRedirect(event, hubspotAutorisatieUrl(state, terugUrl(event, soort))) } catch (e: any) { return sendRedirect(event, `/instellingen/koppelingen/crm?fout=${encodeURIComponent(e.message)}`) }
})
