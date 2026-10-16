// PUT /api/afspraken/:id/verslag {tekst, bron?}: het gespreksverslag bewaren zonder af te ronden
// (afspraakvenster, blok Transcript en gespreksverslag). Leeg wist het verslag. "Rond af" neemt het over.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ tekst?: string; bron?: string }>(event)
  const tekst = String(b?.tekst ?? '').trim()
  if (tekst.length > 50_000) throw createError({ statusCode: 413, statusMessage: 'Het verslag is te lang' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const ap = await vereisAfspraak(tx, ctx, id)
    const verslag = tekst ? { ...(ap.data?.verslag ?? {}), tekst, bron: b?.bron === 'ingesproken' ? 'ingesproken' : 'getypt', perAgendapunt: ap.data?.verslag?.perAgendapunt ?? [], op: new Date().toISOString() } : null
    await tx.execute(sql`update appointments set data = jsonb_set(data, '{verslag}', ${JSON.stringify(verslag)}::jsonb), updated_at = now(), versie = versie + 1 where id = ${id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'afspraak.verslag', resourceType: 'appointments', resourceId: id, changes: { woorden: tekst ? tekst.split(/\s+/).length : 0 } })
    return { ok: true, verslag }
  })
})
