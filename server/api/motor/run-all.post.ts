// POST /api/motor/run-all: de geplande run (elk uur) voor alle organisaties, met de
// header x-motor-secret. De lijst organisaties komt via de platformrol; elke run zelf
// loopt als de app binnen die ene organisatie (RLS).
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { MotorBezig, draaiMotor } from '../../utils/motor'

import { ruimOp } from '../../utils/credits'
import { draaiWaarnemer } from '../../utils/agents/waarnemer'
import { actieveCrm, syncCrm } from '../../utils/crm'
import { herberekenKpi } from '../../utils/team'
import { maandVerbetervoorstel } from '../../utils/agents/coach'
import { maakBundel } from '../../utils/suggesties'
import { proefControle, synchroniseerMoneybird } from '../../utils/platformBeheer'
import { nlMoment, plusDagen } from '../../../shared/datum'

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  const ok = geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim))
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  // P24: de proefperiode (melding 7 dagen vooraf, op de einddatum terug naar Starter) als platformjob.
  try {
    await gebruikDb().transaction(async (tx) => { await tx.execute(sql`set local role dealtrace_platform`); await proefControle(tx) })
  } catch (e) { console.error('proef', (e as Error).message) }
  const uit: Record<string, unknown> = {}
  for (const o of orgs) {
    try { uit[o.id] = await metOrganisatie(o.id, (tx) => draaiMotor(tx, o.id, { soort: 'uur' })) } catch (e) { uit[o.id] = { fout: e instanceof MotorBezig ? 'bezig' : (e as Error).message } }
    // P19: de Waarnemer; de cadans per account (minimaal wekelijks) bepaalt wie aan de beurt is.
    try { await metOrganisatie(o.id, (tx) => draaiWaarnemer(tx, o.id)) } catch (e) { console.error('waarnemer', o.id, (e as Error).message) }
    // P20: de CRM-synchronisatie elk uur per organisatie (dezelfde code als Synchroniseer nu).
    try { await metOrganisatie(o.id, async (tx) => { if (await actieveCrm(tx)) await syncCrm(tx, o.id, { handeling: 'uur' }) }) } catch (e) { console.error('crm', o.id, (e as Error).message) }
    // P21: nb_kpi_dag voor gisteren en vandaag (herberekenbaar) en op de eerste van de maand het verbetervoorstel.
    try {
      await metOrganisatie(o.id, async (tx) => {
        const vandaag = nlMoment(new Date()).datum
        await herberekenKpi(tx, o.id, { van: plusDagen(vandaag, -1), tot: vandaag })
        if (vandaag.endsWith('-01')) await maandVerbetervoorstel(tx, o.id)
      })
    } catch (e) { console.error('kpi', o.id, (e as Error).message) }
    // P23: op maandag de wekelijkse bundel suggesties naar SalesDNA (idempotent per kwartaal en sleutel).
    try {
      const m = nlMoment(new Date())
      if (new Date(`${m.datum}T12:00:00Z`).getUTCDay() === 1 && m.uur >= 6) await metOrganisatie(o.id, (tx) => maakBundel(tx, o.id))
    } catch (e) { console.error('suggesties', o.id, (e as Error).message) }
    // P24: betaalde facturen naar Moneybird (lokaal de mock).
    try { await metOrganisatie(o.id, (tx) => synchroniseerMoneybird(tx, o.id)) } catch (e) { console.error('moneybird', o.id, (e as Error).message) }
    // P33: vervallen reserveringen vrijgeven en gesprekken ouder dan 30 dagen verwijderen.
    try { await metOrganisatie(o.id, (tx) => ruimOp(tx)) } catch { /* volgende ronde opnieuw */ }
  }
  return uit
})
