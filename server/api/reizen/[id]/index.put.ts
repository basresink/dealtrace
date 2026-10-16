// PUT /api/reizen/:id {fases: [{id, accent}]}: accenten van de standaardreis bijstellen
// (salesmanager, beheerder). Andere wijzigingen aan de standaardreis geven 422;
// een maatwerkconcept bewaart de reiseditor (P22). Een nieuwe versie zonder fasemapping (de fases blijven gelijk).
import { eq } from 'drizzle-orm'
import { pasAccentenToe } from '../../../../shared/reis'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie, vereisOrganisatie } from '../../../utils/sessie'
import { bewerker } from '../../../utils/reisApi'
import { bewaarConcept } from '../../../utils/reisEditor'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const b = await readBody<Record<string, any>>(event)
  // P22: een concept bewaar je in de editor; een actieve maatwerkreis wijzig je niet (409, maak een concept).
  const ctx0 = await vereisOrganisatie(event)
  const concept = await metOrganisatie(ctx0.organisatie!.id, async (tx) => (await tx.select({ isStandaard: schema.reistemplates.isStandaard, status: schema.reistemplates.status }).from(schema.reistemplates).where(eq(schema.reistemplates.id, id)))[0])
  if (concept && !concept.isStandaard) {
    if (concept.status !== 'concept') throw createError({ statusCode: 409, statusMessage: 'Een actieve versie wijzig je niet. Maak een concept.' })
    const g = bewerker(ctx0)
    return metOrganisatie(ctx0.organisatie!.id, (tx) => bewaarConcept(tx, ctx0.organisatie!.id, g, id, b ?? {}))
  }
  const ctx = await vereisFunctie(event, 'reis.accentBijstellen')
  const andere = Object.keys(b ?? {}).filter((k) => k !== 'fases')
  if (andere.length) throw createError({ statusCode: 422, statusMessage: 'Op de standaardreis stel je alleen de accenten bij; maatwerk maak je als nieuwe reis' })
  const fases = Array.isArray(b.fases) ? b.fases : []
  if (fases.some((f: any) => Object.keys(f ?? {}).some((k) => k !== 'id' && k !== 'accent'))) throw createError({ statusCode: 422, statusMessage: 'Alleen het accent per fase is te wijzigen' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Reis onbekend' })
    const data = pasAccentenToe(r.data, fases)
    await tx.update(schema.reistemplates).set({ data, versie: r.versie + 1, updatedAt: new Date().toISOString() }).where(eq(schema.reistemplates.id, id))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'reis.accenten', resourceType: 'reistemplates', resourceId: id, changes: { versie: r.versie + 1, fases } })
    return { id, versie: r.versie + 1 }
  })
})
