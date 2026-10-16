// GET /api/coaching/:gebruiker: de coachingkaart (P21). 403 buiten de eigen teams.
import { kan } from '../../../utils/accounts'
import { coachingKaart } from '../../../utils/coaching'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.coaching')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({
    ...(await coachingKaart(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, getRouterParam(event, 'gebruiker')!)),
    kan: { coach: kan(ctx, 'coaching.coachVoorstel'), niveau: kan(ctx, 'gebruikers.niveau') },
  }))
})
