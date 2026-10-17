// GET /api/instellingen/terugkomen: regels, verliesredenen, afkoeling en hercontactritmes in één
// keer, met per tabblad wie mag schrijven (kan) en of de regels uit SalesDNA komen (bron).
// Lezen mag wie één van de vier tabbladen beheert: salesmanager en beheerder.
import { kan } from '../../../utils/accounts'
import { metOrganisatie } from '../../../utils/db'
import { vereisOrganisatie, weigerFunctie } from '../../../utils/sessie'
import { leesTerugkomen } from '../../../utils/terugkomBeheer'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const k = { regels: kan(ctx, 'verkoopverhaal.inrichten'), redenen: kan(ctx, 'verkoopverhaal.mappings'), afkoeling: kan(ctx, 'instellingen.afkoeling'), ritme: kan(ctx, 'ritme.beheer'), startset: ctx.gebruiker.rol === 'beheerder' }
  if (!k.regels && !k.redenen && !k.afkoeling && !k.ritme) weigerFunctie('verkoopverhaal.inrichten', 'rol')
  return metOrganisatie(ctx.organisatie.id, (tx) => leesTerugkomen(tx, k))
})
