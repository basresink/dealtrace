// POST /api/belscripts/:id/neem-over: een variant neemt de nieuwste versie van het origineel over.
import { and, desc, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.variant')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.belscripts).where(and(eq(schema.belscripts.id, id), eq(schema.belscripts.gebruikerId, ctx.gebruiker.id)))
    if (!r?.basisScriptId) throw createError({ statusCode: 404, statusMessage: 'Variant onbekend' })
    const [o] = await tx.select().from(schema.belscriptVersies).where(eq(schema.belscriptVersies.belscriptId, r.basisScriptId)).orderBy(desc(schema.belscriptVersies.versie)).limit(1)
    if (!o) throw createError({ statusCode: 409, statusMessage: 'Het origineel heeft geen actieve versie' })
    await tx.update(schema.belscripts).set({ data: { ...o.data, basisVersie: o.versie } as any, updatedAt: new Date().toISOString() }).where(eq(schema.belscripts.id, id))
    return { id, basisVersie: o.versie }
  })
})
