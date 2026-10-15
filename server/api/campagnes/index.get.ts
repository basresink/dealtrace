// GET /api/campagnes?status=&soort=&eigenaar=mij|<id>: de campagnes met tempo (F12). Lezen kan iedereen
// met "meedoen"; het tempo komt uit de ene functie in shared/campagnes.ts.
import { lijst } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.meedoen')
  const q = getQuery(event)
  const tekst = (v: unknown) => (typeof v === 'string' && v && v !== 'alle' ? v : null)
  const eigenaar = q.eigenaar === 'mij' ? ctx.gebruiker.id : tekst(q.eigenaar)
  return metOrganisatie(ctx.organisatie.id, (tx) => lijst(tx, { status: tekst(q.status), soort: tekst(q.soort), eigenaar }))
})
