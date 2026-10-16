// DELETE /api/accounts/:id/documenten/:docId: je eigen document bij dit account verwijderen.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const docId = getRouterParam(event, 'docId')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const weg = (await tx.execute(sql`delete from bijlagen where id = ${docId} and record_soort = 'account' and record_id = ${id} and soort = 'document' and eigenaar_id = ${ctx.gebruiker.id} returning id`)).rows
    if (!weg.length) throw createError({ statusCode: 404, statusMessage: 'Document niet gevonden of niet van jou' })
    return { ok: true }
  })
})
