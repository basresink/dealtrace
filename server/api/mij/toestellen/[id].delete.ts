// DELETE /api/mij/toestellen/:id: uitloggen op één toestel.
import { and, eq, isNull } from 'drizzle-orm'
import { gebruikDb, schema } from '../../../utils/db'
import { vereisSessie } from '../../../utils/sessie'
import { vergeet } from '../../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  // Ingetrokken toestellen meteen ongeldig op deze instantie (het korte geheugen bewaart ze 15 seconden).
  event.node.res.once('finish', () => vergeet('toestel:'))
  const ctx = await vereisSessie(event)
  const r = await gebruikDb().update(schema.gebruikerToestellen).set({ ingetrokkenOp: new Date().toISOString() })
    .where(and(eq(schema.gebruikerToestellen.id, getRouterParam(event, 'id')!), eq(schema.gebruikerToestellen.gebruikerId, ctx.gebruiker.id), isNull(schema.gebruikerToestellen.ingetrokkenOp))).returning({ id: schema.gebruikerToestellen.id })
  if (!r.length) throw createError({ statusCode: 404, statusMessage: 'Toestel onbekend' })
  setResponseStatus(event, 204)
  return null
})
