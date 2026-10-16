// POST /api/accounts/verplaats {accountIds of van: {gebruiker, fase}, naarGebruiker, reden}: werk verplaatsen in Team (P21).
// Alleen accounts van de eigen teams naar iemand in de eigen teams; 422 zonder reden; een auditregel per account.
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { verplaatsAccounts } from '../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.team')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => verplaatsAccounts(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, b ?? {}))
})
