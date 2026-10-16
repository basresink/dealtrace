// POST /api/afspraken/:id/afronden {uitkomst, verslag, agendapunten, laterOp?, reden?, ...}: "Rond af".
// 400 zonder reden bij nee; idempotent op afspraak en uitkomst.
import { rondAfAfspraak, type AfrondInvoer } from '../../../utils/agenda'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<AfrondInvoer>(event)
  if (!b?.uitkomst) throw createError({ statusCode: 400, statusMessage: 'Kies een uitkomst' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisAfspraak(tx, ctx, id)
    return rondAfAfspraak(tx, ctx.organisatie.id, id, ctx.gebruiker.id, b)
  })
})
