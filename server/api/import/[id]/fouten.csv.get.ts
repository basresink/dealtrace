// GET /api/import/:id/fouten.csv: de foutenlijst van een batch.
import { eq } from 'drizzle-orm'
import { schrijfCsv } from '../../../../shared/csv'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'import.uitvoeren')
  const id = getRouterParam(event, 'id')!
  const batch = await metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.select().from(schema.importBatches).where(eq(schema.importBatches.id, id)))[0])
  if (!batch) throw createError({ statusCode: 404, statusMessage: 'Import onbekend' })
  const rijen: unknown[][] = [['rij', 'bedrijf', 'veld', 'reden']]
  for (const r of (batch.rapport?.regels ?? []) as any[]) for (const f of r.fouten ?? []) rijen.push([r.rij, r.naam, f.veld, f.reden])
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="fouten-${batch.bronLabel.replace(/[^\w-]+/g, '-')}.csv"`)
  return schrijfCsv(rijen)
})
