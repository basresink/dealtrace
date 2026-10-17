// PUT /api/instellingen/abonnement/factuurgegevens {gegevens}: naam, adres, KvK, btw-nummer en het e-mailadres
// voor facturen. 422 met {fouten} per veld. Alleen de beheerder; een auditregel met de gewijzigde velden.
import { metOrganisatie } from '../../../utils/db'
import { vereisBeheerder } from '../../../utils/beheerder'
import { bewaarFactuurgegevens } from '../../../utils/facturatie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'instellingen.abonnement')
  const b = await readBody<{ gegevens?: unknown }>(event).catch(() => null)
  const gegevens = await metOrganisatie(ctx.organisatie.id, (tx) => bewaarFactuurgegevens(tx, ctx.organisatie.id, ctx.gebruiker.id, b?.gegevens))
  return { gegevens }
})
