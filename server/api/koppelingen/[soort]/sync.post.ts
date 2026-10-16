// POST /api/koppelingen/:soort/sync: "Synchroniseer nu" (Expert en beheerder). 409 als er al een run loopt.
import { syncCrm } from '../../../utils/crm'
import { crmSoortUit } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crmSync')
  const soort = crmSoortUit(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => syncCrm(tx, ctx.organisatie.id, { soort, door: ctx.gebruiker.id }))
})
