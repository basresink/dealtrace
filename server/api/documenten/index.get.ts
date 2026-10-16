// GET /api/documenten?zoek=&type=&eigen=1&koppeling=met|zonder: de kennisbank, nieuwste eerst (hooguit 200),
// met tellers per type die het zoeken en de andere filters meetellen. Alleen met de functie Kennisbank.
import { metOrganisatie } from '../../utils/db'
import { kennisbankLijst } from '../../utils/kennisbank'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.kennisbank')
  const q = getQuery(event)
  const s = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : null)
  const koppeling = s('koppeling')
  return metOrganisatie(ctx.organisatie.id, (tx) => kennisbankLijst(tx, ctx.gebruiker, {
    zoek: s('zoek'), type: s('type'), eigen: s('eigen') === '1', koppeling: koppeling === 'met' || koppeling === 'zonder' ? koppeling : null,
  }))
})
