// GET /api/reeksen?wie=mij|team|org&stand=concept|open|loopt|raak|gestopt&sjabloon=&q=: het overzicht van de
// opvolgreeksen. Kop ("11 reeksen lopen, 2 wachten op jou."), de weekregel, tellers per stand en de lijst met wat op
// jou wacht bovenaan. Een accountmanager ziet zijn eigen reeksen, de salesmanager ook die van zijn team, de beheerder
// ook de hele organisatie.
import { metOrganisatie } from '../../utils/db'
import { reeksOverzicht } from '../../utils/opvolgreeksOverzicht'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.opvolgreeksen')
  const q = getQuery(event)
  const tekst = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 100) : undefined)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => reeksOverzicht(tx, ctx.organisatie.id, g, { wie: tekst(q.wie), stand: tekst(q.stand), sjabloon: tekst(q.sjabloon), q: tekst(q.q) }))
})
