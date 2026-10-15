// POST /api/signals/:id/afwijzen {reden}: Gevorderd en hoger; telt in de rapportage per regel. 422 zonder reden.
import { eq } from 'drizzle-orm'
import { AFWIJS_REDENEN } from '../../../../shared/taken'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'inzichten.afwijzen')
  const id = getRouterParam(event, 'id')!
  const { reden } = await readBody<{ reden?: string }>(event)
  if (!reden || !(AFWIJS_REDENEN as readonly string[]).includes(reden)) throw createError({ statusCode: 422, statusMessage: 'Kies een reden om af te wijzen' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select().from(schema.signals).where(eq(schema.signals.id, id))
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Inzicht onbekend' })
    await tx.update(schema.signals).set({ status: 'afgewezen', data: { ...(s.data ?? {}), afwijsReden: reden }, updatedAt: new Date().toISOString() }).where(eq(schema.signals.id, id))
    return { id, status: 'afgewezen' }
  })
})
