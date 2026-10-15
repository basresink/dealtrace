// POST /api/accounts/:id/verrijk-contacten {max?}: contactpersonen uit Datacollectief op één account
// (P15). Hooguit max records (standaard 5); ontdubbeld op e-mail en anders volledige naam (15.1);
// alleen lege velden worden aangevuld (Datacollectief overschrijft nooit hand of KvK, 10.1); nooit
// privégegevens; een afgemeld adres komt niet terug (15.2). Elk veld krijgt herkomst met datum.
import { DcFout } from '../../../utils/bronnen/datacollectief'
import { metOrganisatie } from '../../../utils/db'
import { verrijkContactenViaDc } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'datacollectief.verrijken')
  const id = getRouterParam(event, 'id')!
  const max = Math.min(10, Math.max(1, Number((await readBody<{ max?: number }>(event).catch(() => ({})) as any)?.max) || 5))
  try {
    return await metOrganisatie(ctx.organisatie!.id, (tx) => verrijkContactenViaDc(tx, ctx.organisatie!.id, ctx.organisatie!.pakket, id, ctx.gebruiker.id, max))
  } catch (e) { if (e instanceof DcFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message }); throw e }
})
