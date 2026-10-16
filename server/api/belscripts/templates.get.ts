// GET /api/belscripts/templates: de zes templates van Belscript Studio met lengte en het resultaat uit
// de eigen gesprekken (onder 30 gesprekken geen percentage). Iedereen die scripts kiest mag kijken;
// "Gebruik als basis" is voor wie beheert.
import { SCRIPT_TEMPLATES, templateLengte } from '../../../shared/belscripts'
import { metOrganisatie } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { templateResultaten } from '../../utils/belscriptStudio'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const res = await templateResultaten(tx)
    return {
      templates: SCRIPT_TEMPLATES.map((t) => ({ ...t, lengte: templateLengte(t), resultaat: res.find((r) => r.id === t.id)!.resultaat })),
      kan: { gebruiken: kan(ctx, 'belscript.beheer') },
    }
  })
})
