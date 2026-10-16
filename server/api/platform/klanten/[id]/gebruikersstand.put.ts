// PUT /api/platform/klanten/:id/gebruikersstand {stand}: "aanvragen" (via ons) of "zelf" (binnen de seats).
import { eq, sql } from 'drizzle-orm'
import { schema } from '../../../../utils/db'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'
import { vergeetOrganisaties } from '../../../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  // De organisatiecontext staat in het korte geheugen; na deze wijziging opnieuw lezen.
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const { stand } = await readBody<{ stand?: string }>(event)
  if (stand !== 'aanvragen' && stand !== 'zelf') throw createError({ statusCode: 400, statusMessage: 'Onbekende stand' })
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    await tx.execute(sql`update organisations set data = data || jsonb_build_object('gebruikersStand', ${stand}::text), updated_at = now() where id = ${id}`)
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'gebruikersstand.wijzigen', object: id, voor: { stand: o.data?.gebruikersStand ?? null }, na: { stand } })
    return { stand }
  })
})
