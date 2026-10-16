// DELETE /api/tasks/:id/transcript: het geplakte of geüploade transcript van een beltaak weghalen.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeltaak } from '../../../utils/belverslag'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisBeltaak(tx, ctx, id)
    await tx.execute(sql`delete from transcripten where record_soort = 'tasks' and record_id = ${id} and bijlage_id is null`)
    await tx.execute(sql`update tasks set data = data - 'transcriptBestand', updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'taak.transcript-weg', resourceType: 'tasks', resourceId: id, changes: {} })
    return { ok: true }
  })
})
