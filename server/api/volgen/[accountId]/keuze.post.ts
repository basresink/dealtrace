// POST /api/volgen/:accountId/keuze {sleutel, keuze: nu|plan|niet-nu|alternatief, reden?, contactId?}: Doe het nu
// (taak nu), Plan in (het volgende belblok of werkmoment), een alternatief kiezen, of Niet nu met een reden (al gedaan,
// klopt niet, later). De server rekent de stap opnieuw uit; een tegengehouden stap geeft 409.
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { kiesStap } from '../../../utils/volgen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => kiesStap(tx, ctx.organisatie.id, g, getRouterParam(event, 'accountId')!, {
    sleutel: typeof b?.sleutel === 'string' ? b.sleutel : undefined, keuze: typeof b?.keuze === 'string' ? b.keuze : undefined,
    reden: typeof b?.reden === 'string' ? b.reden : null, contactId: typeof b?.contactId === 'string' ? b.contactId : null,
  }))
})
