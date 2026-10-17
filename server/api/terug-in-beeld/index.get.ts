// GET /api/terug-in-beeld: verloren prospects die terugkomen (accountmanager: eigen, salesmanager: zijn team), met
// terugkomdatum, regel, kanaal, wie het oppakt, aanpak en of het hercontact al loopt. Vooraf de terugkomcontrole.
import { metOrganisatie } from '../../utils/db'
import { terugkomControleLui } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'
import { terugInBeeld } from '../../utils/terugInBeeld'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.terugInBeeld')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await terugkomControleLui(tx, ctx.organisatie.id)
    return terugInBeeld(tx, ctx.gebruiker)
  })
})
