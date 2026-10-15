// POST /api/motor/run-all: de geplande run (elk uur) voor alle organisaties, met de
// header x-motor-secret. De lijst organisaties komt via de platformrol; elke run zelf
// loopt als de app binnen die ene organisatie (RLS).
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { MotorBezig, draaiMotor } from '../../utils/motor'

import { ruimOp } from '../../utils/credits'
import { draaiWaarnemer } from '../../utils/agents/waarnemer'

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  const ok = geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim))
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  const uit: Record<string, unknown> = {}
  for (const o of orgs) {
    try { uit[o.id] = await metOrganisatie(o.id, (tx) => draaiMotor(tx, o.id, { soort: 'uur' })) } catch (e) { uit[o.id] = { fout: e instanceof MotorBezig ? 'bezig' : (e as Error).message } }
    // P19: de Waarnemer; de cadans per account (minimaal wekelijks) bepaalt wie aan de beurt is.
    try { await metOrganisatie(o.id, (tx) => draaiWaarnemer(tx, o.id)) } catch (e) { console.error('waarnemer', o.id, (e as Error).message) }
    // P33: vervallen reserveringen vrijgeven en gesprekken ouder dan 30 dagen verwijderen.
    try { await metOrganisatie(o.id, (tx) => ruimOp(tx)) } catch { /* volgende ronde opnieuw */ }
  }
  return uit
})
