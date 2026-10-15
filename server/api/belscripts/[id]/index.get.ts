// GET /api/belscripts/:id: het script (werkkopie) met zijn versies.
import { desc, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { kan } from '../../../utils/accounts'
import { naarScript } from '../../../utils/belscripts'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.belscripts).where(eq(schema.belscripts.id, id))
    if (!r || (r.isPersoonlijk && r.gebruikerId !== ctx.gebruiker.id)) throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
    const versies = await tx.select({ versie: schema.belscriptVersies.versie, op: schema.belscriptVersies.geactiveerdOp, data: schema.belscriptVersies.data }).from(schema.belscriptVersies).where(eq(schema.belscriptVersies.belscriptId, id)).orderBy(desc(schema.belscriptVersies.versie))
    const origineel = r.basisScriptId ? (await tx.select().from(schema.belscriptVersies).where(eq(schema.belscriptVersies.belscriptId, r.basisScriptId)).orderBy(desc(schema.belscriptVersies.versie)).limit(1))[0] : undefined
    return { ...naarScript(r), versies: versies.map((v) => ({ versie: v.versie, op: v.op })), origineel: origineel ? { versie: origineel.versie, data: origineel.data } : null, kan: { bewerken: r.isPersoonlijk ? r.gebruikerId === ctx.gebruiker.id : kan(ctx, 'belscript.beheer') } }
  })
})
