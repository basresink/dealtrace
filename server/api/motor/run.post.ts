// POST /api/motor/run {accountId?}: "Draai motor nu" (salesmanager, beheerder). 429 als er al een run loopt.
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { MotorBezig, draaiMotor } from '../../utils/motor'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'regels.team') && !kan(ctx, 'regels.beheer')) weigerFunctie('regels.beheer', 'rol')
  const b = await readBody<{ accountId?: string }>(event).catch(() => ({} as { accountId?: string }))
  try {
    return await metOrganisatie(ctx.organisatie.id, (tx) => draaiMotor(tx, ctx.organisatie.id, { soort: 'handmatig', door: ctx.gebruiker.id, accountIds: b?.accountId ? [b.accountId] : undefined }))
  } catch (e) {
    if (e instanceof MotorBezig) throw createError({ statusCode: 429, statusMessage: 'Er loopt al een motorrun; probeer het zo opnieuw' })
    throw e
  }
})
