// GET /api/help/:slug: één artikel met inhoud, gelezen en gerelateerde artikelen.
// Een eigen artikel van een andere organisatie bestaat voor jou niet (404, via RLS).
import { metOrganisatie } from '../../../utils/db'
import { gelezenDoor, leesArtikelen } from '../../../utils/help'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const slug = getRouterParam(event, 'id') ?? ''
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const artikelen = await leesArtikelen(tx)
    // Een eigen artikel gaat voor een platformartikel met dezelfde slug.
    const a = artikelen.find((x) => x.slug === slug && x.organisationId) ?? artikelen.find((x) => x.slug === slug || x.id === slug)
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
    const gelezen = await gelezenDoor(tx, ctx.gebruiker.id)
    const gerelateerd = artikelen.filter((x) => x.id !== a.id && x.categorie === a.categorie && x.collectie === a.collectie).slice(0, 3).map((x) => ({ slug: x.slug, titel: x.titel }))
    return { ...a, gelezen: gelezen.has(a.id), gerelateerd }
  })
})
