// PUT /api/accounts/:id/extra-bronnen {bronnen: [{label, url}]}: de extra bronnen uit het Info-venster.
// Ze staan als URL-bron in data.volgBronnen, zodat de agents ze volgen; trefwoorden blijven staan.
import { eq, sql } from 'drizzle-orm'
import { controleerExtraBronnen, zetInVolgBronnen } from '../../../utils/extraBronnen'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ bronnen?: unknown }>(event)
  const bronnen = controleerExtraBronnen(b?.bronnen)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select({ data: schema.accounts.data }).from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const volg = zetInVolgBronnen((a.data as any)?.volgBronnen, bronnen, ctx.gebruiker.id)
    await tx.execute(sql`update accounts set data = jsonb_set(data, '{volgBronnen}', ${JSON.stringify(volg)}::jsonb), updated_at = now() where id = ${id}`)
    return { bronnen }
  })
})
