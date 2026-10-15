// POST /api/tasks/:id/goedkeuren {concept?}: de mens keurt een concept van een agent goed
// (executor_status concept-klaar → goedgekeurd). Een mail van de Verzender gaat daarna
// via de Bewaker de deur uit (uitgevoerd), of blijft goedgekeurd tot het weer mag.
import { and, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { verstuurGoedgekeurd } from '../../../utils/agents/verzender'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ concept?: { onderwerp?: string; tekst?: string } }>(event).catch(() => ({} as any))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    if (t.executorStatus !== 'concept-klaar') throw createError({ statusCode: 409, statusMessage: 'Er staat geen concept klaar' })
    const oud = (t.data as any)?.concept
    const concept = b?.concept ? { ...oud, ...b.concept } : oud
    // Meting van overname (11.2): ongewijzigd of aangepast.
    const overname = JSON.stringify(concept) === JSON.stringify(oud) ? 'ongewijzigd' : 'aangepast'
    await tx.update(schema.tasks).set({ executorStatus: 'goedgekeurd', data: { ...(t.data as any), concept, overname, goedgekeurd: { door: ctx.gebruiker.id, op: new Date().toISOString() } }, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.executorStatus, 'concept-klaar')))
    const afloop = await verstuurGoedgekeurd(tx, ctx.organisatie.id, id)
    return { id, executorStatus: afloop?.uitkomst === 'uitgevoerd' ? 'uitgevoerd' : 'goedgekeurd', reden: afloop?.uitkomst === 'geblokkeerd' ? afloop.toets.reden : undefined }
  })
})
