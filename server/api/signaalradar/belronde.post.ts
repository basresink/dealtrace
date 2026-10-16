// POST /api/signaalradar/belronde { reikwijdte, branche, soort }: Start belronde. Maakt een campagneconcept
// (koude belcampagne) met de accounts uit de golf en het winpunt dat past, via de campagnelogica. Een
// accountmanager neemt alleen zijn eigen accounts mee; de salesmanager alle accounts. Activeren doe je zelf.
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { leesRadarCel, radarBelronde } from '../../utils/signaalradar'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.signaalradar')
  await vereisFunctie(event, 'campagnes.maken')
  const p = leesRadarCel((await readBody<any>(event)) ?? {})
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const r = await radarBelronde(tx, ctx.organisatie!.id, ctx.gebruiker, p)
    await schrijfAudit(tx, { organisationId: ctx.organisatie!.id, actorId: ctx.gebruiker.id, action: 'campagne.maken', resourceType: 'campagnes', resourceId: r.id, changes: { bron: 'signaalradar', branche: p.brancheId, signaalsoort: p.soort, accounts: r.accounts } })
    return r
  })
})
