// POST /api/signals/:id/afwijzen {reden, toelichting?}: Gevorderd en hoger. Een vaste reden of "Eigen reden"
// met een eigen tekst (3 tot 300 tekens). De reden telt in de rapportage per regel (acceptatie); de eigen
// tekst staat in de historie van het inzicht. 422 zonder geldige reden.
import { eq } from 'drizzle-orm'
import { afwijsData, leesAfwijsReden } from '../../../../shared/inzichten'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'inzichten.afwijzen')
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ reden?: string; toelichting?: string }>(event).catch(() => ({} as { reden?: string; toelichting?: string }))
  const k = leesAfwijsReden(body?.reden, body?.toelichting)
  if (!k.ok) throw createError({ statusCode: 422, statusMessage: k.melding })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select().from(schema.signals).where(eq(schema.signals.id, id))
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Inzicht onbekend' })
    const nu = new Date()
    await tx.update(schema.signals).set({ status: 'afgewezen', data: { ...(s.data ?? {}), ...afwijsData(k.keuze, ctx.gebruiker.id, nu) }, updatedAt: nu.toISOString() }).where(eq(schema.signals.id, id))
    return { id, status: 'afgewezen', reden: k.keuze.reden, toelichting: k.keuze.toelichting }
  })
})
