// POST /api/contacten/visitekaartje {bijlageId, accountId?}: het kaartje lezen (2 credits) tot een
// conceptcontact, met een mogelijk duplicaat bij het account. Bewaren gaat via de sync-mutatie
// contact.uitVisitekaartje.
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { leesVisitekaartje } from '../../utils/spraak'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contact.visitekaartje')
  const b = await readBody<{ bijlageId?: string; accountId?: string | null }>(event)
  if (!b?.bijlageId) throw createError({ statusCode: 400, statusMessage: 'Geen foto van het visitekaartje' })
  return metOrganisatie(ctx.organisatie.id, (tx) => leesVisitekaartje(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau }, b.bijlageId!, b.accountId ?? null))
})
