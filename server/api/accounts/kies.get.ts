// GET /api/accounts/kies?q=&soort=prospect: snelle keuze van een account (Nieuwe taak), tien treffers. Met
// soort=prospect alleen prospects (zoals bij een nieuw accountplan: plannen voor klanten horen in DealDrive).
// Gedeactiveerde accounts (0064) staan er niet tussen: daar plan je geen nieuw werk op.
import { and, eq, ilike, isNull } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const alleenProspects = query.soort === 'prospect'
  if (q.length < 2) return []
  return metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, plaats: schema.accounts.city }).from(schema.accounts)
    .where(and(ilike(schema.accounts.name, `%${q.replace(/[%_]/g, '')}%`), alleenProspects ? eq(schema.accounts.accountKind, 'prospect') : undefined, isNull(schema.accounts.gedeactiveerdOp))).limit(10)))
})
