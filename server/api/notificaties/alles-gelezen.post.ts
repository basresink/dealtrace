// POST /api/notificaties/alles-gelezen: alle eigen meldingen gelezen, op de server (dus op elk toestel).
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker } = await vereisSessie(event)
  return metOrganisatie(gebruiker.organisationId!, async (tx) => {
    const r = await tx.execute(sql`update notificaties set gelezen_op = now() where gebruiker_id = ${gebruiker.id} and gelezen_op is null and verborgen_op is null`)
    return { aantal: r.rowCount ?? 0 }
  })
})
