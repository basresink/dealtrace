// GET /api/meetingsoorten: alle meetingsoorten met agendapunten en uitkomsten (iedereen leest).
import { meetingsoorten } from '../../utils/agenda'
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ soorten: await meetingsoorten(tx), kan: { beheren: kan(ctx, 'instellingen.meetingsoorten') } }))
})
