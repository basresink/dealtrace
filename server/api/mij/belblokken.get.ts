// GET /api/mij/belblokken: vaste blokken en voorkeuren (standaard voor je werkplek als je er geen hebt).
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { blokkenVan } from '../../utils/bellen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [u] = await tx.select({ werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    return blokkenVan(u ?? {})
  })
})
