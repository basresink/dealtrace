// POST /api/eigen-velden/:id/archiveer {gearchiveerd}: verbergt het veld; ingevulde waarden blijven bewaard.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'eigenVelden.beheren')
  const id = getRouterParam(event, 'id')!
  const { gearchiveerd = true } = await readBody<{ gearchiveerd?: boolean }>(event) ?? {}
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [v] = await tx.update(schema.eigenVelden).set({ gearchiveerd, updatedAt: new Date().toISOString() }).where(eq(schema.eigenVelden.id, id)).returning()
    if (!v) throw createError({ statusCode: 404, statusMessage: 'Veld onbekend' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: gearchiveerd ? 'eigenVeld.archiveren' : 'eigenVeld.terugzetten', resourceType: 'eigen_velden', resourceId: id })
    return v
  })
})
