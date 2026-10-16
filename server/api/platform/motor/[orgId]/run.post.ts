// POST /api/platform/motor/:orgId/run: "Draai opnieuw voor deze klant" als de app binnen die organisatie (RLS). Founder.
import { metOrganisatie } from '../../../../utils/db'
import { MotorBezig, draaiMotor } from '../../../../utils/motor'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const org = getRouterParam(event, 'orgId')!
  try {
    const r: any = await metOrganisatie(org, (tx) => draaiMotor(tx, org, { soort: 'handmatig', door: ctx.gebruiker.id }))
    await alsPlatform((tx) => platformAudit(tx, event, ctx, { organisatieId: org, handeling: 'motor.draaien', object: org }))
    return { ok: true, tekst: `De motor draaide: ${r?.taken ?? 0} taken, ${r?.inzichten ?? 0} inzichten.` }
  } catch (e) {
    if (e instanceof MotorBezig) throw createError({ statusCode: 409, statusMessage: 'De motor draait al voor deze klant' })
    throw e
  }
})
