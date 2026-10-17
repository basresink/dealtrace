// POST /api/terug-in-beeld/:id/start {soort: reeks|taak|belblok}: hercontact starten. De prospect gaat terug in de
// reis en krijgt poging 1 van het ritme van de regel, één taak of een beltaak in het eerstvolgende koude belblok.
// 422 binnen de afkoeling of bij belblok zonder bellen; 409 als het hercontact al loopt; 403 buiten je team.
import { metOrganisatie } from '../../../utils/db'
import { alsHttpFout } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'
import { startHercontact } from '../../../utils/terugInBeeld'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.terugInBeeld')
  const b = await readBody<{ soort?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => startHercontact(tx, ctx.organisatie.id, ctx.gebruiker, getRouterParam(event, 'id')!, String(b?.soort ?? '') as any).catch(alsHttpFout))
})
