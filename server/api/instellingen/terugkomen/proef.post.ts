// POST /api/instellingen/terugkomen/proef {regel?, redenen?, reden?, afkoeling?}: droogloop. Welke wachtende
// prospects (op nee, nog niet gestart, geen aangepaste datum) een andere terugkomdatum, een ander kanaal of
// een andere regel krijgen als je dit bewaart. Rekent met terugkomDatum; bewaart niets.
import { kan } from '../../../utils/accounts'
import { metOrganisatie } from '../../../utils/db'
import { vereisOrganisatie, weigerFunctie } from '../../../utils/sessie'
import { proef, terugkomWijzigingUitBody } from '../../../utils/terugkomBeheer'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!['verkoopverhaal.inrichten', 'verkoopverhaal.mappings', 'instellingen.afkoeling', 'ritme.beheer'].some((f) => kan(ctx, f))) weigerFunctie('verkoopverhaal.inrichten', 'rol')
  const w = terugkomWijzigingUitBody(await readBody<any>(event))
  return metOrganisatie(ctx.organisatie.id, (tx) => proef(tx, w))
})
