// DELETE /api/push/abonneer {endpoint}: dit toestel ontvangt geen pushmeldingen meer.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker } = await vereisSessie(event)
  const b = await readBody<{ endpoint?: string }>(event)
  return metOrganisatie(gebruiker.organisationId!, async (tx) => {
    await tx.execute(sql`delete from push_subscriptions where endpoint = ${b?.endpoint ?? ''} and gebruiker_id = ${gebruiker.id}`)
    return { ok: true }
  })
})
