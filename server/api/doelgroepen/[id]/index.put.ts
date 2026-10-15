// PUT /api/doelgroepen/:id: wijzigen maakt een nieuwe versie (salesmanager, beheerder).
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { schoonDoelgroep } from '../../../utils/doelgroepen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'doelgroepen.beheren')
  const id = getRouterParam(event, 'id')!
  const d = schoonDoelgroep(await readBody(event))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [oud] = await tx.select().from(schema.doelgroepen).where(eq(schema.doelgroepen.id, id))
    if (!oud) throw createError({ statusCode: 404, statusMessage: 'Doelgroep onbekend' })
    const [rij] = await tx.update(schema.doelgroepen).set({ ...d, versie: oud.versie + 1, updatedAt: new Date().toISOString() }).where(eq(schema.doelgroepen.id, id)).returning()
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'doelgroep.wijzigen', resourceType: 'doelgroepen', resourceId: id, changes: { van: { naam: oud.naam, status: oud.status, prioriteit: oud.prioriteit, data: oud.data }, naar: d } })
    return rij
  })
})
