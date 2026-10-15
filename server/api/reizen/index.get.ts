// GET /api/reizen: reizen met aantallen per fase (lezen vanaf Gevorderd; 403 Beginner).
import { sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.overzicht')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const reizen = await tx.select().from(schema.reistemplates).orderBy(sql`${schema.reistemplates.isStandaard} desc`, schema.reistemplates.naam)
    const tellingen = (await tx.execute(sql`select reis_id, fase_id, count(*)::int as n from accounts where account_kind = 'prospect' and reis_id is not null group by reis_id, fase_id`)).rows as { reis_id: string; fase_id: string; n: number }[]
    return {
      reizen: reizen.map((r) => ({
        id: r.id, naam: r.naam, status: r.status, versie: r.versie, isStandaard: r.isStandaard, doelgroepId: r.doelgroepId,
        fases: r.data.fases.map((f) => ({ id: f.id, label: f.label, hoofdfase: f.hoofdfase, kleur: f.kleur, aantal: tellingen.find((t) => t.reis_id === r.id && t.fase_id === f.id)?.n ?? 0 })),
        totaal: tellingen.filter((t) => t.reis_id === r.id).reduce((s, t) => s + t.n, 0),
      })),
    }
  })
})
