// GET /api/accounts/kies?q=: snelle keuze van een account (Nieuwe taak), tien treffers.
import { ilike } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2) return []
  return metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, plaats: schema.accounts.city }).from(schema.accounts)
    .where(ilike(schema.accounts.name, `%${q.replace(/[%_]/g, '')}%`)).limit(10)))
})
