// DELETE /api/accountplannen/:id: het plan weg; de acties blijven als taak op het account staan.
import { verwijder } from '../../../utils/accountplannen'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  return metOrganisatie(ctx.organisatie.id, (tx) => verwijder(tx, ctx.organisatie.id, getRouterParam(event, 'id')!, ctx.gebruiker))
})
