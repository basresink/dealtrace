// POST /api/reizen/:id/standaard-terug {bevestigd: true}: fases, accenten, overgangen en
// startactiviteiten van deze reis samen terug naar de standaard (gat 41). Andere
// reizen blijven ongemoeid. Zonder bevestiging 428.
import { and, eq } from 'drizzle-orm'
import { STANDAARD_ACTIVITEITEN, standaardReisData } from '../../../../shared/reis'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.standaardTerug')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ bevestigd?: boolean }>(event)
  if (b?.bevestigd !== true) throw createError({ statusCode: 428, statusMessage: 'Bevestig dat fases, accenten, overgangen en startactiviteiten teruggaan naar de standaard' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Reis onbekend' })
    const data = standaardReisData()
    // Accounts in een fase die niet meer bestaat, kunnen niet; de standaardfases blijven altijd bestaan.
    await tx.update(schema.reistemplates).set({ data, versie: r.versie + 1, updatedAt: new Date().toISOString() }).where(eq(schema.reistemplates.id, id))
    await tx.delete(schema.activiteitstemplates).where(and(eq(schema.activiteitstemplates.reistemplateId, id)))
    await tx.insert(schema.activiteitstemplates).values(STANDAARD_ACTIVITEITEN.map((a) => ({ organisationId: ctx.organisatie.id, reistemplateId: id, faseId: a.faseId, versie: r.versie + 1, data: a })))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'reis.standaardTerug', resourceType: 'reistemplates', resourceId: id, changes: { van: r.data, versie: r.versie + 1 } })
    return { id, versie: r.versie + 1 }
  })
})
