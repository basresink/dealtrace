// GET /api/planning/terugkomregels: de regels in twee lijsten, de KPI "Hercontact op tijd",
// de opbrengst per regel (Expert) en wie in de komende 30 dagen terugkomt.
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { terugkomOverzicht } from '../../utils/planning'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'terugkomen.lezen')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const r = await terugkomOverzicht(tx, ctx.gebruiker.id)
    const opbrengst = kan(ctx, 'terugkomen.koppelenEnOpbrengst')
    const zonder = (l: any[]) => l.map(({ opbrengst: o, ...rest }) => (opbrengst ? { ...rest, opbrengst: o } : rest))
    return { ...r, verloren: zonder(r.verloren), slapend: zonder(r.slapend), kan: { opbrengst, aanpassen: kan(ctx, 'account.terugOpAanpassen'), inrichten: ctx.gebruiker.rol === 'beheerder', voorstellen: opbrengst } }
  })
})
