// POST /api/instellingen/verkoopverhaal/voorstellen/:id {status}: een voorstel van een Expert
// overnemen of afwijzen. Overnemen zet de tekst niet zelf in het verhaal; dat doe je in het onderdeel.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../../utils/audit'
import { metOrganisatie, schema } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  const id = getRouterParam(event, 'id')!
  const { status } = await readBody<{ status?: string }>(event)
  if (status !== 'overgenomen' && status !== 'afgewezen') throw createError({ statusCode: 422, statusMessage: 'Kies overgenomen of afgewezen' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = await tx.update(schema.vvVoorstellen).set({ status }).where(eq(schema.vvVoorstellen.id, id)).returning()
    if (!r.length) throw createError({ statusCode: 404, statusMessage: 'Voorstel niet gevonden' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: `verkoopverhaal.voorstel.${status}`, resourceType: 'vv_voorstellen', resourceId: id, changes: { status } })
    return { ok: true }
  })
})
