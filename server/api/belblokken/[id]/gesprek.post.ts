// POST /api/belblokken/:id/gesprek {taskId, knop, ...}: één gesprek afronden via rondTaakAf;
// idempotent op taak en sleutel.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { GesprekFout, verwerkGesprek } from '../../../utils/bellen'
import { ReisFout } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  if (!b?.taskId || !b?.knop) throw createError({ statusCode: 400, statusMessage: 'taskId en knop zijn verplicht' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select({ ownerId: schema.tasks.ownerId, belblokId: schema.tasks.belblokId }).from(schema.tasks).where(eq(schema.tasks.id, b.taskId))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (!(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    try {
      return await verwerkGesprek(tx, ctx.gebruiker.id, b, id)
    } catch (e) {
      if (e instanceof GesprekFout || e instanceof ReisFout) throw createError({ statusCode: (e as any).statusCode, statusMessage: e.message })
      throw e
    }
  })
})
