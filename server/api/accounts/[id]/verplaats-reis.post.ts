// POST /api/accounts/:id/verplaats-reis {reisId, reden}: Gevorderd voor eigen accounts,
// salesmanager en beheerder voor alle (F05).
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { alsHttpFout, verplaatsNaarReis } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.verplaatsen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ reisId?: string; reden?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select({ ownerId: schema.accounts.ownerId }).from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const alle = ctx.gebruiker.rol === 'salesmanager' || ctx.gebruiker.rol === 'beheerder'
    if (!alle && a.ownerId !== ctx.gebruiker.id) throw createError({ statusCode: 403, statusMessage: 'Je verplaatst alleen je eigen accounts; vraag je salesmanager' })
    return verplaatsNaarReis(tx, id, String(b?.reisId ?? ''), String(b?.reden ?? ''), ctx.gebruiker.id).catch(alsHttpFout)
  })
})
