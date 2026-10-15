// POST /api/koppelingen/salesdna/test {endpoint, geheim?}: ping naar SalesDNA, zonder iets te bewaren.
import { ontsleutel } from '../../../utils/geheimen'
import { metOrganisatie } from '../../../utils/db'
import { koppeling } from '../../../utils/salesdna'
import { salesdnaBron } from '../../../utils/bronnen/salesdna'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna')
  const b = await readBody<{ endpoint?: string; geheim?: string }>(event)
  const geheim = b?.geheim || (await metOrganisatie(ctx.organisatie.id, async (tx) => ontsleutel((await koppeling(tx, ctx.organisatie.id))?.geheimen)?.geheim))
  if (!b?.endpoint?.trim() || !geheim) throw createError({ statusCode: 400, statusMessage: 'Vul het adres en het geheim in' })
  const r = await salesdnaBron(b.endpoint, geheim).ping()
  if (!r.ok) throw createError({ statusCode: 400, statusMessage: r.reden })
  return { ok: true, tekst: 'Verbinding werkt' }
})
