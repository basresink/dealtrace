// POST /api/agent/prepare {taskId|appointmentId}: de Pitstop (Schrijver, mandaat A). Een concept per
// actiesoort ter goedkeuring; 2 credits (soort concept); 402 als de credits op zijn. Opnieuw maken
// terwijl er al een concept klaarstaat, kan vanaf Gevorderd.
import { sql } from 'drizzle-orm'
import { kan } from '../../utils/accounts'
import { bereidVoor } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'pitstop.maken')
  const b = await readBody<any>(event)
  const o = b?.appointmentId ? { soort: 'afspraak' as const, id: String(b.appointmentId) } : b?.taskId ? { soort: 'taak' as const, id: String(b.taskId) } : null
  if (!o) throw createError({ statusCode: 400, statusMessage: 'Kies een taak of afspraak' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [al] = (await tx.execute(sql`select id from concepten where status in ('klaar', 'goedgekeurd') and ${o.soort === 'afspraak' ? sql`appointment_id = ${o.id}` : sql`task_id = ${o.id}`} limit 1`)).rows as any[]
    if (al && !kan(ctx, 'pitstop.opnieuw')) throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar', data: { functie: 'pitstop.opnieuw', reden: 'niveau' } })
    return bereidVoor(tx, ctx.organisatie.id, ctx.gebruiker, o)
  })
})
