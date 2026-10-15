// POST /api/campagnes/voorbereid: de wizard rekent mee. Aantal, overgeslagen met reden, kanaaldekking,
// branchemelding (F25), omvang en capaciteit. Schrijft niets.
import { voorbereid } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.maken')
  const b = await readBody<any>(event)
  if (!b?.bron?.soort) throw createError({ statusCode: 400, statusMessage: 'Kies een doelgroep' })
  return metOrganisatie(ctx.organisatie.id, (tx) => voorbereid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, b))
})
