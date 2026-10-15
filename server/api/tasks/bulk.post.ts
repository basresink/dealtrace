// POST /api/tasks/bulk {ids, actie, ownerId?, uitkomst?}: Gevorderd en hoger. Afronden gaat
// per taak door rondAf (gat 11). 403 buiten scope.
import { inArray } from 'drizzle-orm'
import { uitstellen } from '../../../shared/taken'
import { metOrganisatie, schema } from '../../utils/db'
import { alsHttpFout } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'
import { magTaak, rondAf } from '../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.bulk')
  const b = await readBody<{ ids?: string[]; actie?: string; ownerId?: string; uitkomst?: string }>(event)
  const ids = [...new Set(b?.ids ?? [])].slice(0, 200)
  if (!ids.length) throw createError({ statusCode: 422, statusMessage: 'Kies taken' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const taken = await tx.select().from(schema.tasks).where(inArray(schema.tasks.id, ids))
    for (const t of taken) if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Een van de taken valt buiten je team' })
    if (b.actie === 'toewijzen' && (!b.ownerId || !(await magTaak(tx, ctx, b.ownerId)))) throw createError({ statusCode: 403, statusMessage: 'Je wijst alleen toe binnen je team' })
    const nu = new Date()
    let aantal = 0
    for (const t of taken) {
      if (b.actie === 'uitstellen-werkdag' || b.actie === 'uitstellen-week') {
        await tx.update(schema.tasks).set({ dueDate: uitstellen(t, b.actie === 'uitstellen-week' ? 'week' : 'werkdag', nu), updatedAt: nu.toISOString() }).where(inArray(schema.tasks.id, [t.id]))
      } else if (b.actie === 'toewijzen') {
        await tx.update(schema.tasks).set({ ownerId: b.ownerId!, updatedAt: nu.toISOString() }).where(inArray(schema.tasks.id, [t.id]))
      } else if (b.actie === 'afronden') {
        await rondAf(tx, t.id, { uitkomst: (b.uitkomst as any) ?? null }, ctx.gebruiker.id, nu).catch(alsHttpFout)
      } else throw createError({ statusCode: 422, statusMessage: 'Onbekende actie' })
      aantal++
    }
    return { aantal }
  })
})
