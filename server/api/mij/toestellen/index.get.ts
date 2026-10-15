// GET /api/mij/toestellen: de toestellen waarop je bent ingelogd (Mijn instellingen).
import { and, desc, eq, isNull } from 'drizzle-orm'
import { gebruikDb, schema } from '../../../utils/db'
import { vereisSessie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisSessie(event)
  const rijen = await gebruikDb().select().from(schema.gebruikerToestellen).where(and(eq(schema.gebruikerToestellen.gebruikerId, ctx.gebruiker.id), isNull(schema.gebruikerToestellen.ingetrokkenOp))).orderBy(desc(schema.gebruikerToestellen.laatstGezien))
  return rijen.map((t) => ({ id: t.id, label: t.label, laatstGezien: t.laatstGezien, ditToestel: t.id === ctx.sessie.tid }))
})
