// POST /api/auth/uitloggen {alleToestellen?}: dit toestel, of elke sessie van deze gebruiker.
import { and, eq, isNull } from 'drizzle-orm'
import { gebruikDb, schema } from '../../utils/db'
import { leesSessieInhoud, wisSessie } from '../../utils/sessie'
import { wisWerkIn } from '../../utils/werkIn'
import { vergeet } from '../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  // Ingetrokken toestellen meteen ongeldig op deze instantie (het korte geheugen bewaart ze 15 seconden).
  event.node.res.once('finish', () => vergeet('toestel:'))
  const s = await leesSessieInhoud(event)
  const b = await readBody<{ alleToestellen?: boolean }>(event).catch(() => ({} as { alleToestellen?: boolean }))
  if (s) {
    const nu = new Date().toISOString()
    const waar = b?.alleToestellen ? eq(schema.gebruikerToestellen.gebruikerId, s.sub) : eq(schema.gebruikerToestellen.id, s.tid!)
    await gebruikDb().update(schema.gebruikerToestellen).set({ ingetrokkenOp: nu }).where(and(waar, isNull(schema.gebruikerToestellen.ingetrokkenOp)))
  }
  wisSessie(event)
  wisWerkIn(event)
  setResponseStatus(event, 204)
  return null
})
