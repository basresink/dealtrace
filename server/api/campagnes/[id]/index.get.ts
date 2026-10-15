// GET /api/campagnes/:id: het bord. Kop met tempo, items per kolom, "Begin hier" (uitgerekend, geen AI)
// en bij een afgeronde campagne de samenvatting.
import { kan } from '../../../utils/accounts'
import { bord, laad, magWijzigen } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.meedoen')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const b = await bord(tx, id)
    const mag = kan(ctx, 'campagnes.maken') && (await magWijzigen(tx, ctx.gebruiker, await laad(tx, id)))
    return { ...b, kan: { wijzigen: mag, slepen: mag || b.items.some((i) => i.eigenaarId === ctx.gebruiker.id), verdelen: kan(ctx, 'campagnes.team'), boodschapAI: kan(ctx, 'campagnes.boodschapAI') } }
  })
})
