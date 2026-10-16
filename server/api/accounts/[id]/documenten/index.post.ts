// POST /api/accounts/:id/documenten {naam, mime, data (base64), contactId?}: een document bij het account of bij
// een contact van dat account (tabblad Documenten).
// PDF, Office, tekst en afbeeldingen tot 8 MB; 415 voor andere soorten, 413 als het te groot is.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

const SOORTEN = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/msword|application\/vnd\.ms-excel|text\/(plain|csv)|image\/(jpeg|png|webp))$/

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ naam?: string; mime?: string; data?: string; contactId?: string }>(event)
  const naam = String(b?.naam ?? '').trim().slice(0, 200)
  if (!naam || !b?.data) throw createError({ statusCode: 400, statusMessage: 'Kies een document' })
  if (!SOORTEN.test(b.mime ?? '')) throw createError({ statusCode: 415, statusMessage: 'Alleen PDF, Office, tekst of afbeeldingen' })
  const inhoud = Buffer.from(b.data, 'base64')
  if (inhoud.length > 8_000_000) throw createError({ statusCode: 413, statusMessage: 'Het document is groter dan 8 MB' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = (await tx.execute(sql`select id from accounts where id = ${id}`)).rows
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    if (b.contactId && !(await tx.execute(sql`select 1 from contacts where id = ${b.contactId} and account_id = ${id}`)).rows.length) throw createError({ statusCode: 422, statusMessage: 'Contact hoort niet bij dit account' })
    const nieuw = crypto.randomUUID()
    await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud, naam)
      values (${nieuw}, ${ctx.organisatie.id}, ${ctx.gebruiker.id}, ${b.contactId ? 'contact' : 'account'}, ${b.contactId ?? id}, 'document', ${b.mime}, ${inhoud.length}, ${inhoud}, ${naam})`)
    return { id: nieuw, naam }
  })
})
