// POST /api/weekreview/blijver: een besluit over een taak die drie keer of vaker doorschoof. Plan in
// (datum), Draag over (collega) of Laat los (met reden; de taak sluit met die reden).
import { metOrganisatie } from '../../utils/db'
import { besluitBlijver } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'
import { reviewWeekUit } from '../../utils/dagritmeApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.weekreview')
  const b = await readBody<{ week?: string; taakId?: string; besluit?: string; datum?: string; naar?: string; reden?: string }>(event)
  if (!b?.taakId || !['inplannen', 'overdragen', 'loslaten'].includes(String(b.besluit))) throw createError({ statusCode: 422, statusMessage: 'Kies Plan in, Draag over of Laat los' })
  const week = reviewWeekUit(b.week)
  return metOrganisatie(ctx.organisatie!.id, (tx) => besluitBlijver(tx, ctx.organisatie!.id, ctx.gebruiker.id, week, { taakId: b.taakId!, besluit: b.besluit as any, datum: b.datum ?? null, naar: b.naar ?? null, reden: b.reden ?? null }))
})
