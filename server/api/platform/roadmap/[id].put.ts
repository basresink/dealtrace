// PUT /api/platform/roadmap/:id {status?, prioriteit?}: status en prioriteit van een wens. "gestart" zet
// alleen Maak issue. Founder, platformaudit.
import { sql } from 'drizzle-orm'
import { WENS_STATUS } from '../../../../shared/platform'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ status?: string; prioriteit?: string }>(event)
  if (b?.status && (!(WENS_STATUS as readonly string[]).includes(b.status) || b.status === 'gestart')) throw createError({ statusCode: 422, statusMessage: 'Onbekende status' })
  if (b?.prioriteit && !['hoog', 'middel', 'laag'].includes(b.prioriteit)) throw createError({ statusCode: 422, statusMessage: 'Kies hoog, middel of laag' })
  return alsPlatform(async (tx) => {
    const [r] = (await tx.execute(sql`select dealtrace_platform_roadmap_zet(${id}, ${b.status ?? null}, ${b.prioriteit ?? null}, ${null}) as s`)).rows as any[]
    if (!r?.s) throw createError({ statusCode: 404, statusMessage: 'Wens niet gevonden' })
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'roadmap.wijzigen', object: id, na: b })
    return { status: r.s }
  })
})
