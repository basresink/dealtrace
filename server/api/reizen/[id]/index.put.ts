// PUT /api/reizen/:id {fases: [{id, accent}]}: accenten van de standaardreis bijstellen
// (salesmanager, beheerder). Andere wijzigingen aan de standaardreis geven 422;
// maatwerk bewerken is P22. Een nieuwe versie zonder fasemapping (de fases blijven gelijk).
import { eq } from 'drizzle-orm'
import { pasAccentenToe } from '../../../../shared/reis'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.accentBijstellen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<Record<string, any>>(event)
  const andere = Object.keys(b ?? {}).filter((k) => k !== 'fases')
  if (andere.length) throw createError({ statusCode: 422, statusMessage: 'Op de standaardreis stel je alleen de accenten bij; maatwerk maak je als nieuwe reis' })
  const fases = Array.isArray(b.fases) ? b.fases : []
  if (fases.some((f: any) => Object.keys(f ?? {}).some((k) => k !== 'id' && k !== 'accent'))) throw createError({ statusCode: 422, statusMessage: 'Alleen het accent per fase is te wijzigen' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Reis onbekend' })
    if (!r.isStandaard) throw createError({ statusCode: 422, statusMessage: 'Maatwerkreizen bewerk je in de reiseditor (volgt later)' })
    const data = pasAccentenToe(r.data, fases)
    await tx.update(schema.reistemplates).set({ data, versie: r.versie + 1, updatedAt: new Date().toISOString() }).where(eq(schema.reistemplates.id, id))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'reis.accenten', resourceType: 'reistemplates', resourceId: id, changes: { versie: r.versie + 1, fases } })
    return { id, versie: r.versie + 1 }
  })
})
