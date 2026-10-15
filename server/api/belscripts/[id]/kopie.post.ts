// POST /api/belscripts/:id/kopie: een persoonlijke variant (Gevorderd). Erft doel, fases en
// koppelingen; onthoudt de versie van het origineel voor "Het origineel is gewijzigd".
import { and, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.variant')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.belscripts).where(and(eq(schema.belscripts.id, id), eq(schema.belscripts.isPersoonlijk, false)))
    if (!r || r.status !== 'actief') throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
    const [v] = await tx.select().from(schema.belscriptVersies).where(and(eq(schema.belscriptVersies.belscriptId, id), eq(schema.belscriptVersies.versie, r.versie)))
    const data = { ...(v?.data ?? r.data), basisVersie: r.versie } as any
    const [n] = await tx.insert(schema.belscripts).values({ organisationId: ctx.organisatie.id, naam: `${r.naam} (mijn variant)`, doel: r.doel, status: 'concept', versie: 0, eigenaarId: ctx.gebruiker.id, basisScriptId: id, isPersoonlijk: true, gebruikerId: ctx.gebruiker.id, data }).returning({ id: schema.belscripts.id })
    return { id: n!.id }
  })
})
