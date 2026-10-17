// POST /api/signals/:id/gelezen: "Markeer als gelezen". Het moment staat in data.gelezenOp voor de historie.
import { and, eq, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const nu = new Date().toISOString()
    await tx.update(schema.signals).set({ status: 'gelezen', data: sql`coalesce(${schema.signals.data}, '{}'::jsonb) || ${JSON.stringify({ gelezenOp: nu })}::jsonb`, updatedAt: nu }).where(and(eq(schema.signals.id, id), eq(schema.signals.status, 'nieuw')))
    return { id, status: 'gelezen' }
  })
})
