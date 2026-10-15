// POST /api/briefing/uitkomst {onderwerp, id, doel, volgendeStap?}: na het gesprek "Doel gehaald?".
import { bewaarUitkomst } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'briefing.lezen')
  const b = await readBody<any>(event)
  if (!['afspraak', 'taak'].includes(b?.onderwerp) || !b?.id) throw createError({ statusCode: 400, statusMessage: 'Onderwerp en id zijn verplicht' })
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarUitkomst(tx, { soort: b.onderwerp, id: String(b.id) }, { doel: b.doel, volgendeStap: b.volgendeStap ?? null }))
})
