// GET /api/bellen/taak/:id: het belpaneel bij één beltaak (taakflyout): scriptvoorstel,
// variabelen en bezwaren uit het verhaal.
import { metOrganisatie } from '../../../utils/db'
import { kan } from '../../../utils/accounts'
import { zichtbareScripts } from '../../../../shared/belscripts'
import { belmodusItems, laadBelKandidaten, laadScripts } from '../../../utils/bellen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const k = (await laadBelKandidaten(tx, ctx.gebruiker.id)).find((x) => x.taskId === id)
    if (!k) return { item: null }
    const scripts = zichtbareScripts(await laadScripts(tx), { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId })
    const [item] = await belmodusItems(tx, { gebruiker: { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId }, organisatie: ctx.organisatie }, [k], { scripts })
    return { item, scripts, kan: { ai: kan(ctx, 'belscript.ai') } }
  })
})
