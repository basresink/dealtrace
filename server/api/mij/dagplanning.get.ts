// GET /api/mij/dagplanning: je voorkeur voor de automatische dagplanning ({automatisch, tijd}).
import { leesVoorkeur } from '../../utils/dagplanning'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  return metOrganisatie(ctx.organisatie!.id, (tx) => leesVoorkeur(tx, ctx.gebruiker.id))
})
