// GET /api/briefing/overzicht?periode=week|alle|vandaag|morgen|volgende|vantot&van=&tot=&wie=team (Gevorderd):
// je afspraken, beltaken en bezoektaken met een account, ook achterstallige (gat 34), met de soort die elke ingang
// ook kiest, de compleetheid, het eerste gat, de Pitstop-status en het contact; belblokken als één kaart. De tellers
// per periode gaan over de hele horizon. wie=team alleen voor salesmanager en beheerder (anders telt alleen jezelf).
import { PERIODES, STANDAARD_PERIODE, type Periode } from '../../../shared/briefingOverzicht'
import { briefingOverzicht } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const DATUM = /^\d{4}-\d{2}-\d{2}$/
export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'briefing.bewerken')
  const q = getQuery(event)
  const periode = (PERIODES.some(([k]) => k === q.periode) ? q.periode : STANDAARD_PERIODE) as Periode
  const van = typeof q.van === 'string' && DATUM.test(q.van) ? q.van : null
  const tot = typeof q.tot === 'string' && DATUM.test(q.tot) ? q.tot : null
  return metOrganisatie(ctx.organisatie.id, (tx) => briefingOverzicht(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, { periode, van, tot, team: q.wie === 'team' }))
})
