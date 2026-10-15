// GET /api/reis/instellingen: redenen voor nee (vast), afkoelperiode per kanaal,
// terugkomregels, redenmapping en concurrenten (Instellingen, Verkoop; Zet nee).
import { AFKOELING_STANDAARD, KANAAL_LABEL, KANALEN, NEE_REDENEN } from '../../../shared/nbStatus'
import { terugkomDatum } from '../../../shared/verkoopverhaal'
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { afkoelingInstelling, verkoopverhaal } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.zien')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const afkoeling = await afkoelingInstelling(tx)
    const vv = await verkoopverhaal(tx)
    const nu = new Date()
    return {
      redenen: NEE_REDENEN,
      kanalen: KANALEN.map((k) => ({ id: k, label: KANAAL_LABEL[k], dagen: afkoeling[k], standaard: AFKOELING_STANDAARD[k] })),
      // Voorstel per reden, zodat de flyout direct de datum toont (ook offline).
      voorstellen: Object.fromEntries(NEE_REDENEN.map((r) => [r, terugkomDatum(r, vv, nu, afkoeling, 'nee')])),
      terugkomregels: vv.terugkomregels,
      redenmapping: vv.redenmapping,
      concurrenten: vv.concurrenten,
      kan: { afkoeling: kan(ctx, 'instellingen.afkoeling') },
    }
  })
})
