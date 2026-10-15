// POST /api/tasks/:id/afronden {uitkomst, laterOp?, reden?, toelichting?, idempotentieSleutel}:
// het afrondpad voor flyout, lijst en vegen (gat 11). 422 zonder uitkomst bij een contacttaak.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { alsHttpFout } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak, rondAf } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select({ ownerId: schema.tasks.ownerId }).from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    return rondAf(tx, id, { uitkomst: b?.uitkomst ?? null, laterOp: b?.laterOp ?? null, reden: b?.reden ?? null, toelichting: b?.toelichting ?? null, sleutel: b?.idempotentieSleutel ?? null }, ctx.gebruiker.id).catch(alsHttpFout)
  })
})
