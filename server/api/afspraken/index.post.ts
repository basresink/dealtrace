// POST /api/afspraken: een afspraak plannen (F09). Meetingsoort verplicht; "Voor wie" een collega vanaf
// Gevorderd; de taak waaruit je plant wordt gekoppeld; de eerste afspraak meldt eerste-afspraak-gepland.
import { kan } from '../../utils/accounts'
import { planAfspraak, type PlanInvoer } from '../../utils/agenda'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const b = await readBody<PlanInvoer>(event)
  if (!b?.meetingsoortId || !b?.start) throw createError({ statusCode: 422, statusMessage: 'Kies meetingsoort, datum en start' })
  return metOrganisatie(ctx.organisatie.id, (tx) => planAfspraak(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, rol: ctx.gebruiker.rol, mag: { voorCollega: kan(ctx, 'agenda.voorCollega') } }, b))
})
