// GET /api/reizen: reizen met aantallen per fase (lezen vanaf Gevorderd; 403 Beginner).
import { sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { kan } from '../../utils/accounts'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.overzicht')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const reizen = await tx.select().from(schema.reistemplates).orderBy(sql`${schema.reistemplates.isStandaard} desc`, schema.reistemplates.naam)
    const tellingen = (await tx.execute(sql`select reis_id, fase_id, count(*)::int as n from accounts where account_kind = 'prospect' and reis_id is not null group by reis_id, fase_id`)).rows as { reis_id: string; fase_id: string; n: number }[]
    const doelgroepen = (await tx.execute(sql`select d.id, d.naam, d.status, d.prioriteit, d.data, (select count(*)::int from accounts a where a.doelgroep_id = d.id) as accounts from doelgroepen d order by d.prioriteit, d.naam`)).rows as any[]
    return {
      doelgroepen,
      kan: { maatwerk: ['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol) || kan(ctx, 'reizen.maatwerk'), publiceren: kan(ctx, 'reizen.publiceren'), doelgroepen: kan(ctx, 'doelgroepen.beheren'), voorstel: kan(ctx, 'reizen.voorstelAI') },
      reizen: reizen.map((r) => ({
        id: r.id, naam: r.naam, status: r.status, versie: r.versie, isStandaard: r.isStandaard, doelgroepId: r.doelgroepId, basisId: (r.data as any).basisId ?? null, publicatieAangevraagd: (r.data as any).publicatieAangevraagd ?? null, eigenaarId: r.eigenaarId,
        fases: r.data.fases.map((f) => ({ id: f.id, label: f.label, hoofdfase: f.hoofdfase, kleur: f.kleur, aantal: tellingen.find((t) => t.reis_id === r.id && t.fase_id === f.id)?.n ?? 0 })),
        hoofdfasen: Object.fromEntries(['vinden', 'bewerken', 'verbinden', 'overgedragen', 'verloren'].map((h) => [h, r.data.fases.filter((f) => f.hoofdfase === h).reduce((s, f) => s + (tellingen.find((t) => t.reis_id === r.id && t.fase_id === f.id)?.n ?? 0), 0)])),
        totaal: tellingen.filter((t) => t.reis_id === r.id).reduce((s, t) => s + t.n, 0),
      })),
    }
  })
})
