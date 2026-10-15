// GET /api/reizen/:id: fases, overgangen, startactiviteiten, validatie en aantallen per fase.
import { eq, sql } from 'drizzle-orm'
import { valideerReis } from '../../../../shared/reis'
import { kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.overzicht')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Reis onbekend' })
    const acts = await tx.select().from(schema.activiteitstemplates).where(eq(schema.activiteitstemplates.reistemplateId, id))
    const tellingen = (await tx.execute(sql`select fase_id, count(*)::int as n from accounts where reis_id = ${id} group by fase_id`)).rows as { fase_id: string; n: number }[]
    return {
      id: r.id, naam: r.naam, status: r.status, versie: r.versie, isStandaard: r.isStandaard, bijgewerkt: r.updatedAt,
      fases: r.data.fases.map((f) => ({ ...f, aantal: tellingen.find((t) => t.fase_id === f.id)?.n ?? 0 })),
      overgangen: r.data.overgangen,
      activiteiten: acts.map((a) => ({ id: a.id, ...a.data })),
      validatie: valideerReis(r.data),
      kan: { accent: kan(ctx, 'reis.accentBijstellen') && r.isStandaard, standaardTerug: kan(ctx, 'reis.standaardTerug') && r.isStandaard, bewerken: kan(ctx, 'nav.reizen') },
    }
  })
})
