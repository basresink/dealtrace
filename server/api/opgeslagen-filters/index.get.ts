import { and, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.opgeslagenFilters')
  const lijst = String(getQuery(event).lijst ?? 'prospects')
  return metOrganisatie(ctx.organisatie.id, (tx) => tx.select().from(schema.opgeslagenFilters).where(and(eq(schema.opgeslagenFilters.gebruikerId, ctx.gebruiker.id), eq(schema.opgeslagenFilters.lijst, lijst))))
})
