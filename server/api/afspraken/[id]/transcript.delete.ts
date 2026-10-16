// DELETE /api/afspraken/:id/transcript: het geplakte of geüploade transcript weghalen. Een ingesproken
// verslag (opname) blijft staan.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisAfspraak(tx, ctx, id)
    await tx.execute(sql`delete from transcripten where record_soort = 'appointments' and record_id = ${id} and bijlage_id is null`)
    await tx.execute(sql`update appointments set data = data - 'transcriptBestand', updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'afspraak.transcript-weg', resourceType: 'appointments', resourceId: id, changes: {} })
    return { ok: true }
  })
})
