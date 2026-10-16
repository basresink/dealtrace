// POST /api/accounts/:id/documenten {naam, mime, data (base64), contactId?, type?, versie?, beschrijving?}: een
// document in de kennisbank, gekoppeld aan dit account of aan een contact van dit account (tabblad Documenten).
// PDF, Office, tekst, Markdown en afbeeldingen tot 8 MB; 415 voor andere soorten, 413 als het te groot is.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../../utils/db'
import { maakDocument } from '../../../../utils/kennisbank'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ naam?: string; mime?: string; data?: string; contactId?: string; type?: string; versie?: string; beschrijving?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = (await tx.execute(sql`select id from accounts where id = ${id}`)).rows
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    if (b?.contactId && !(await tx.execute(sql`select 1 from contacts where id = ${b.contactId} and account_id = ${id}`)).rows.length) throw createError({ statusCode: 422, statusMessage: 'Contact hoort niet bij dit account' })
    return maakDocument(tx, ctx.organisatie.id, ctx.gebruiker, { ...(b ?? {}), accountIds: b?.contactId ? [] : [id], contactIds: b?.contactId ? [b.contactId] : [] })
  })
})
