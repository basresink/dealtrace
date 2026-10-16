// POST /api/tasks/:id/analyse: de Notulist leest het verslag en het transcript van een beltaak en geeft
// samenvatting, actiepunten (concepttaken in Concepten), koopsignalen (inzichten), bezwaren en open vragen.
// De mens keurt de concepten goed. Zonder klant of met te weinig tekst: 422; de Bewaker kan tegenhouden.
import { analyseVan, vereisBeltaak } from '../../../utils/belverslag'
import { analyseerBelverslag } from '../../../utils/agents/notulist'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const t = await vereisBeltaak(tx, ctx, id)
    if (!t.account_id) throw createError({ statusCode: 422, statusMessage: 'Analyse hoort bij een beltaak met een klant' })
    const r = await analyseerBelverslag(tx, ctx.organisatie.id, id)
    if (!r) throw createError({ statusCode: 422, statusMessage: 'Schrijf eerst een verslag of voeg een transcript toe (minstens een paar zinnen)' })
    if (!r.ok) return { ok: false, reden: r.reden }
    return { ok: true, actiepunten: r.actiepunten, concurrenten: r.concurrenten, analyse: { ...analyseVan(r.analyse), op: new Date().toISOString() } }
  })
})
