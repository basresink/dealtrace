// PUT /api/accounts/:id/terug-op {datum, reden}: terugkomdatum aanpassen (Gevorderd), eigen
// accounts; de salesmanager en beheerder ook die van anderen. Binnen de afkoelperiode schuift hij op.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { alsHttpFout, zetTerugOp } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'account.terugOpAanpassen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ datum?: string; reden?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select({ ownerId: schema.accounts.ownerId }).from(schema.accounts).where(eq(schema.accounts.id, id))
    if (a && a.ownerId !== ctx.gebruiker.id && !['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol)) throw createError({ statusCode: 403, statusMessage: 'Je past alleen de terugkomdatum van je eigen accounts aan' })
    return zetTerugOp(tx, id, String(b?.datum ?? ''), String(b?.reden ?? ''), ctx.gebruiker.id).catch(alsHttpFout)
  })
})
