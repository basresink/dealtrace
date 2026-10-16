// POST /api/dagstart/belblokken: zet de voorgestelde belblokken van vandaag in je agenda (na je akkoord)
// (of van een gekozen dag) en hangt de belacties tot die dag eraan. Zonder starts alle voorstellen.
import { metOrganisatie } from '../../utils/db'
import { zetBelblokken } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  const b = await readBody<{ starts?: string[]; modus?: string; dag?: string }>(event).catch(() => ({} as { starts?: string[]; modus?: string; dag?: string }))
  const dag = typeof b?.dag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dag) ? b.dag : null
  const starts = Array.isArray(b?.starts) ? b!.starts.filter((s) => typeof s === 'string').slice(0, 5) : []
  return metOrganisatie(ctx.organisatie!.id, (tx) => zetBelblokken(tx, ctx.organisatie!.id, ctx.gebruiker.id, starts, new Date(), b?.modus === 'buiten' || b?.modus === 'binnen' ? b.modus : null, dag))
})
