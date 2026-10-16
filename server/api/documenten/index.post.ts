// POST /api/documenten {naam, mime, data (base64), type?, versie?, beschrijving?, accountIds?, contactIds?}: een
// document in de kennisbank, eventueel gekoppeld aan accounts en contacten (dan staat het ook op hun tabblad
// Documenten). PDF, Office, tekst, Markdown en afbeeldingen tot 8 MB; 415 voor andere soorten, 413 als het te
// groot is, 422 voor een onbekend account of contact.
import { metOrganisatie } from '../../utils/db'
import { maakDocument, type KennisbankUpload } from '../../utils/kennisbank'
import { vereisDocumenten } from '../../utils/kennisbankToegang'

export default defineEventHandler(async (event) => {
  const ctx = await vereisDocumenten(event)
  const b = await readBody<KennisbankUpload>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => maakDocument(tx, ctx.organisatie.id, ctx.gebruiker, b ?? {}))
})
