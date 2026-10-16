// GET /api/accounts/:id/invloed: de invloedskaart (F8). Personen met rol, houding, contactmomenten,
// rapporteert-aan, citaten en een voorstel van de Notulist; de rollen zonder naam uit de Profielbouwer; de
// dekking (beslisser en minstens één beïnvloeder gesproken), het grootste risico en één voorgestelde stap.
import { metOrganisatie } from '../../../utils/db'
import { laadInvloed } from '../../../utils/invloed'
import { kan } from '../../../utils/accounts'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({
    ...(await laadInvloed(tx, id)),
    kan: { bewerken: kan(ctx, 'contacten.basis'), taak: kan(ctx, 'taken.basis'), houdingVoorstel: kan(ctx, 'contacten.basis'), profielbouwer: kan(ctx, 'contacten.basis') },
  }))
})
