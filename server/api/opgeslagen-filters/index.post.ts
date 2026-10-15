import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.opgeslagenFilters')
  const b = await readBody<{ naam?: string; lijst?: string; query?: Record<string, string> }>(event)
  if (!b.naam?.trim() || !b.query) throw createError({ statusCode: 400, statusMessage: 'Naam en filters zijn verplicht' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.insert(schema.opgeslagenFilters).values({ organisationId: ctx.organisatie.id, gebruikerId: ctx.gebruiker.id, lijst: b.lijst ?? 'prospects', naam: b.naam!.trim(), query: b.query! }).returning())[0])
})
