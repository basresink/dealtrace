// POST /api/accountplannen/:id/acties {titel, datum?, contactId?}: een actie in het actieplan, als taak op het account.
import { voegActieToe } from '../../../../utils/accountplannen'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => voegActieToe(tx, ctx.organisatie.id, getRouterParam(event, 'id')!, ctx.gebruiker, b ?? {}))
})
