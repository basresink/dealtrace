// POST /api/motor/onderweg-meldingen: elke 5 minuten (geplande functie, x-motor-secret). Vertrek,
// briefing, verslag, hete aanleiding, dagstart en recap volgens de meldingsregels.
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { sweepOnderweg } from '../../utils/onderwegMeldingen'

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  if (!(geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim)))) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  const totaal: Record<string, number> = {}
  for (const o of orgs) {
    const t = await metOrganisatie(o.id, (tx) => sweepOnderweg(tx, o.id))
    for (const [k, v] of Object.entries(t)) totaal[k] = (totaal[k] ?? 0) + v
  }
  return totaal
})
