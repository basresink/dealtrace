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
    const data = r.data as any
    const versies = (await tx.execute(sql`select versie, gepubliceerd_op, door from reisversies where reis_id = ${data.basisId ?? id} order by versie desc limit 10`)).rows as any[]
    const [concept] = r.status !== 'concept' ? (await tx.execute(sql`select id from reistemplates where status = 'concept' and data->>'basisId' = ${id}`)).rows as any[] : []
    const doelgroepen = (await tx.execute(sql`select id, naam, status, prioriteit, data from doelgroepen order by prioriteit, naam`)).rows as any[]
    const manager = ['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol)
    const magConcept = manager || kan(ctx, 'reizen.maatwerk')
    return {
      id: r.id, naam: r.naam, status: r.status, versie: r.versie, isStandaard: r.isStandaard, bijgewerkt: r.updatedAt, doelgroepId: r.doelgroepId, eigenaarId: r.eigenaarId,
      basisId: data.basisId ?? null, publicatieAangevraagd: data.publicatieAangevraagd ?? null, conceptId: concept?.id ?? null, overschrijvingen: data.overschrijvingen ?? {},
      versies: versies.map((v) => ({ versie: v.versie, op: new Date(v.gepubliceerd_op).toISOString() })), doelgroepen,
      fases: r.data.fases.map((f) => ({ ...f, aantal: tellingen.find((t) => t.fase_id === f.id)?.n ?? 0 })),
      overgangen: r.data.overgangen,
      activiteiten: acts.map((a) => ({ id: a.id, ...a.data })),
      validatie: valideerReis(r.data),
      kan: {
        accent: kan(ctx, 'reis.accentBijstellen') && r.isStandaard, standaardTerug: kan(ctx, 'reis.standaardTerug') && r.isStandaard,
        bewerken: r.status === 'concept' && magConcept && (manager || r.eigenaarId === ctx.gebruiker.id), concept: magConcept && !r.isStandaard && r.status !== 'concept',
        publiceren: kan(ctx, 'reizen.publiceren'), voorstel: kan(ctx, 'reizen.voorstelAI'), beheer: kan(ctx, 'reizen.publiceren') && !r.isStandaard && r.status !== 'concept',
      },
    }
  })
})
