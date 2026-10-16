// GET /api/bezoek-analyse?scope=eigen|team&persoon=&venster=week|maand|kwartaal|periode&van=&tot=&soort=
// De bezoekanalyse (F10, F18) in de opzet van DealDrive /bezoek-analyse: dekking per regio in het
// venster, bezoeken met uitkomst, verslag en vervolg, regiodagen en routes, kansen langs de route.
// Functie regio.analyse (Gevorderd); het teambeeld alleen voor de salesmanager en de beheerder.
import { bezoekAnalyse } from '../utils/afspraakAnalyse'
import { metOrganisatie } from '../utils/db'
import { vereisFunctie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'regio.analyse')
  const q = getQuery(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => bezoekAnalyse(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, q))
})
