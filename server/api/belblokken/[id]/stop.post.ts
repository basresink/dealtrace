// POST /api/belblokken/:id/stop: het blokresultaat; meldingen gaan weer door.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { stopBlok } from '../../../utils/bellen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select({ g: schema.belblokSessies.gebruikerId }).from(schema.belblokSessies).where(eq(schema.belblokSessies.id, id))
    if (!s || s.g !== ctx.gebruiker.id) throw createError({ statusCode: 404, statusMessage: 'Belblok onbekend' })
    return stopBlok(tx, id, ctx.gebruiker.id)
  })
})
