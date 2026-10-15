// POST /api/doelgroepen/telling {data, id?}: live teller "214 accounts vallen in deze
// doelgroep, waarvan 37 al in een andere reis" voor een doelgroep in bewerking.
// Ook GET /api/doelgroepen/:id/telling voor een bewaarde doelgroep.
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'
import { kan } from '../../utils/accounts'
import { schoonDoelgroep } from '../../utils/doelgroepen'
import { telDoelgroep } from '../../utils/doelgroepen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'doelgroepen.beheren') && !(kan(ctx, 'nav.reizen') && ctx.gebruiker.niveau === 'expert')) throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar' })
  const b = await readBody<any>(event)
  const d = schoonDoelgroep({ naam: 'telling', ...b, data: b?.data })
  return metOrganisatie(ctx.organisatie.id, (tx) => telDoelgroep(tx, d.data, b?.id ?? null))
})
