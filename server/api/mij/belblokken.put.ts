// PUT /api/mij/belblokken {blokken, voorkeuren}: eigen vaste blokken vanaf Gevorderd; "Vult
// zichzelf" alleen voor Expert; maximaal 20 blokken (422).
import { eq } from 'drizzle-orm'
import { valideerBlokken } from '../../../shared/belblokken'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { blokkenVan } from '../../utils/bellen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.plannen')
  const b = await readBody<{ blokken?: unknown; voorkeuren?: any }>(event)
  const fouten = valideerBlokken(b?.blokken)
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0]!, data: { fouten } })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [u] = await tx.select({ werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const huidig = blokkenVan(u ?? {})
    let blokken = b!.blokken as any[]
    // Zonder "Vult zichzelf" (Expert) houdt een bestaand blok zijn stand en is een nieuw blok "Ik vul zelf".
    if (!kan(ctx, 'belblok.automatisch')) blokken = blokken.map((x) => ({ ...x, automatisch: huidig.blokken.find((h) => h.id === x.id)?.automatisch ?? false, verhouding: huidig.blokken.find((h) => h.id === x.id)?.verhouding ?? x.verhouding }))
    const lunch = b?.voorkeuren?.lunch
    const voorkeuren = lunch && /^\d\d:\d\d$/.test(lunch.start) && Number.isInteger(lunch.minuten) && lunch.minuten >= 0 && lunch.minuten <= 120 ? { lunch } : huidig.voorkeuren
    const data = { ...(u?.data ?? {}), belblokken: { blokken, voorkeuren } } as any
    await tx.update(schema.users).set({ data, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, ctx.gebruiker.id))
    return { blokken, voorkeuren }
  })
})
