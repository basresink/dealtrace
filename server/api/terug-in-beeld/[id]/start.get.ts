// GET /api/terug-in-beeld/:id/start: de drie manieren om het hercontact te starten (opvolgreeks met het ritme van de
// regel, één taak, belblok bij bellen) met de datums vooraf, en of starten mag (afkoeling).
import { metOrganisatie } from '../../../utils/db'
import { alsHttpFout } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'
import { startVoorbeeld } from '../../../utils/terugInBeeld'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.terugInBeeld')
  return metOrganisatie(ctx.organisatie.id, (tx) => startVoorbeeld(tx, ctx.gebruiker, getRouterParam(event, 'id')!).catch(alsHttpFout))
})
