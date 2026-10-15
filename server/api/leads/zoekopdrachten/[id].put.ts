// PUT /api/leads/zoekopdrachten/:id {naam?, automatisch?}: hernoemen of wekelijks aan of uit.
import { and, eq } from 'drizzle-orm'
import { kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.opgeslagen')
  const b = await readBody<{ naam?: string; automatisch?: string; verwijder?: boolean }>(event)
  const id = getRouterParam(event, 'id')!
  if (b?.automatisch === 'wekelijks' && !kan(ctx, 'leads.automatisch')) throw createError({ statusCode: 403, statusMessage: 'Automatische rondes staan voor jou nog niet aan', data: { reden: 'niveau' } })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const waar = and(eq(schema.leadZoekopdrachten.id, id), eq(schema.leadZoekopdrachten.gebruikerId, ctx.gebruiker.id))
    if (b?.verwijder) { await tx.delete(schema.leadZoekopdrachten).where(waar); return { verwijderd: true } }
    const [r] = await tx.update(schema.leadZoekopdrachten).set({
      ...(b?.naam?.trim() ? { naam: b.naam.trim().slice(0, 80) } : {}),
      ...(b?.automatisch ? { automatisch: b.automatisch === 'wekelijks' ? 'wekelijks' : 'uit' } : {}),
    }).where(waar).returning()
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Zoekopdracht onbekend' })
    return r
  })
})
