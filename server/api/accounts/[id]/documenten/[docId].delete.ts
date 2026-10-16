// DELETE /api/accounts/:id/documenten/:docId: een document dat aan dit account (of een contact ervan) hangt
// verwijderen, uit de kennisbank en van elke kaart. Alleen wie het uploadde of de beheerder.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../../utils/db'
import { verwijderDocument } from '../../../../utils/kennisbank'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const docId = getRouterParam(event, 'docId')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await tx.execute(sql`select 1 from document_koppelingen where document_id = ${docId} and account_id = ${id}`)).rows.length) throw createError({ statusCode: 404, statusMessage: 'Document niet gevonden bij dit account' })
    return verwijderDocument(tx, ctx.organisatie.id, docId, ctx.gebruiker)
  })
})
