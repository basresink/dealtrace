// POST /api/reizen/:id/droogloop: per fase hoeveel accounts er bij publicatie belanden en hoeveel taken de startactiviteiten maken.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { bewerker } from '../../../utils/reisApi'
import { droogloopVoor } from '../../../utils/reisEditor'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  bewerker(ctx)
  const b = await readBody<{ mapping?: Record<string, string | null> }>(event).catch(() => ({} as any))
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const d = await droogloopVoor(tx, getRouterParam(event, 'id')!, b?.mapping)
    const namen = new Map(((await tx.execute(sql`select id, name from users`)).rows as any[]).map((u) => [u.id, String(u.name).replace(/^Testgebruiker /, '')]))
    return { ...d, perPersoon: d.perPersoon.map((p) => ({ ...p, naam: namen.get(p.ownerId) ?? p.ownerId })) }
  })
})
