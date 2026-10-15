import { and, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.opgeslagenFilters')
  const id = getRouterParam(event, 'id')!
  await metOrganisatie(ctx.organisatie.id, (tx) => tx.delete(schema.opgeslagenFilters).where(and(eq(schema.opgeslagenFilters.id, id), eq(schema.opgeslagenFilters.gebruikerId, ctx.gebruiker.id))))
  setResponseStatus(event, 204)
  return null
})
