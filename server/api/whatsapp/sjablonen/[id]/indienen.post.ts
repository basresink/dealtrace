// POST /api/whatsapp/sjablonen/:id/indienen (beheerder): naar de provider ter goedkeuring (de mock keurt direct).
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'
import { dienIn } from '../../../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.whatsapp')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = await dienIn(tx, ctx.organisatie.id, getRouterParam(event, 'id')!)
    return { ...r, tekst: r.status === 'goedgekeurd' ? 'Sjabloon goedgekeurd.' : r.status === 'afgewezen' ? `Afgewezen: ${r.reden ?? 'zonder reden'}` : 'Ingediend. Je ziet de status hier zodra de provider besluit.' }
  })
})
