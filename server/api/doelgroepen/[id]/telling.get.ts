// GET /api/doelgroepen/:id/telling: {aantal, inAndereReis} (Expert, salesmanager).
import { eq } from 'drizzle-orm'
import { kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisOrganisatie } from '../../../utils/sessie'
import { telDoelgroep } from '../../../utils/doelgroepen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'doelgroepen.beheren') && !(kan(ctx, 'nav.reizen') && ctx.gebruiker.niveau === 'expert')) throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar' })
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [d] = await tx.select().from(schema.doelgroepen).where(eq(schema.doelgroepen.id, id))
    if (!d) throw createError({ statusCode: 404, statusMessage: 'Doelgroep onbekend' })
    return telDoelgroep(tx, d.data, d.id)
  })
})
