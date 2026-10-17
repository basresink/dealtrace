// PUT /api/instellingen/terugkomen/regels/:id (id "nieuw" maakt een regel) {reden, termijnDagen, kanaal, oppakker,
// hercontactritmeId, aanpak, redenen?}: de regel en de redenen die naar deze regel wijzen in één transactie. Wordt
// meteen een nieuwe bevestigde versie met audit; wachtende prospects die nog niet gestart zijn en geen aangepaste
// datum hebben, verschuiven. Salesmanager en beheerder; redenen koppelen alleen de beheerder (403). Uit SalesDNA:
// reden, termijn, kanaal en aanpak alleen lezen (409).
import { kan } from '../../../../utils/accounts'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'
import { bewaarRegel, terugkomRedenenUitBody, terugkomRegelUitBody } from '../../../../utils/terugkomBeheer'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!id) throw createError({ statusCode: 404, statusMessage: 'Regel onbekend' })
  const b = await readBody<any>(event)
  const invoer = terugkomRegelUitBody(b)
  const redenen = terugkomRedenenUitBody(b?.redenen)
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarRegel(tx, ctx.organisatie.id, ctx.gebruiker.id, id, invoer, redenen, kan(ctx, 'verkoopverhaal.mappings')))
})
