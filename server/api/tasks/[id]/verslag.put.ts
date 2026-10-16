// PUT /api/tasks/:id/verslag {tekst, bron?}: het gespreksverslag bij een beltaak bewaren (taakvenster, blok
// Transcript en gespreksverslag). Leeg wist het verslag. Het staat bij de taak; bij afronden gaat het mee
// naar de belactiviteit (de activiteitenlog is alleen-toevoegen, dus later bijwerken blijft bij de taak).
// Het tabblad Gespreksverslagen leest het van de taak.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeltaak } from '../../../utils/belverslag'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ tekst?: string; bron?: string }>(event)
  const tekst = String(b?.tekst ?? '').trim()
  if (tekst.length > 50_000) throw createError({ statusCode: 413, statusMessage: 'Het verslag is te lang' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisBeltaak(tx, ctx, id)
    const verslag = tekst ? { tekst, bron: b?.bron === 'ingesproken' ? 'ingesproken' : 'getypt', op: new Date().toISOString(), door: ctx.gebruiker.id } : null
    await tx.execute(sql`update tasks set data = jsonb_set(data, '{verslag}', ${JSON.stringify(verslag)}::jsonb), updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'taak.verslag', resourceType: 'tasks', resourceId: id, changes: { woorden: tekst ? tekst.split(/\s+/).length : 0 } })
    return { ok: true, verslag }
  })
})
