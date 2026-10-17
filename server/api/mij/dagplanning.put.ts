// PUT /api/mij/dagplanning {automatisch, tijd}: "Plan mijn dag automatisch" (F3 Dagplanner). Uit: de
// dagstart blijft een voorstel dat pas na je akkoord in de agenda komt. Aan: de Dagplanner deelt elke
// werkdag op je tijdstip (standaard 07:00, na je stille uren) zelf in. Zet je hem aan terwijl het tijdstip
// van vandaag al voorbij is, dan plant hij de rest van vandaag meteen.
import { controleerPlanTijd, dagplanningVoorkeur, planAanDeBeurt } from '../../../shared/dagplanning'
import { planMijnDag } from '../../utils/agents/dagplanner'
import { leesVoorkeur, werkdagInstelling, zetVoorkeur } from '../../utils/dagplanning'
import { metOrganisatie } from '../../utils/db'
import { instellingVan } from '../../utils/onderwegMeldingen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  if (ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Je werkt in een organisatie: je eigen planning wijzig je daarbuiten.' })
  const b = await readBody<{ automatisch?: unknown; tijd?: unknown }>(event).catch(() => ({} as { automatisch?: unknown; tijd?: unknown }))
  if (b?.tijd !== undefined) { const f = controleerPlanTijd(b.tijd); if (f) throw createError({ statusCode: 422, statusMessage: f }) }
  if (b?.automatisch !== undefined && typeof b.automatisch !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Kies aan of uit' })
  const org = ctx.organisatie!.id
  const nu = new Date()
  return metOrganisatie(org, async (tx) => {
    const oud = await leesVoorkeur(tx, ctx.gebruiker.id)
    const v = dagplanningVoorkeur({ automatisch: b?.automatisch ?? oud.automatisch, tijd: b?.tijd ?? oud.tijd })
    await zetVoorkeur(tx, org, ctx.gebruiker.id, v)
    let plan = null
    if (v.automatisch && !oud.automatisch && planAanDeBeurt(v, nu, await instellingVan(tx, ctx.gebruiker.id), await werkdagInstelling(tx))) {
      plan = await planMijnDag(tx, org, ctx.gebruiker.id, nu, 'automatisch')
    }
    return { ...v, plan }
  })
})
