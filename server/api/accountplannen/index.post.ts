// POST /api/accountplannen {accountId, titel, eigenaarId?, geldigVan?, geldigTot?, contactIds?, secties?, velden?,
// acties?: [{titel, datum?, contactId?}]}: een nieuw plan in één keer; elke actie wordt meteen een taak op het account.
import { effectiefNiveau } from '../../utils/accounts'
import { maakAccountplan } from '../../utils/accountplannen'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => maakAccountplan(tx, ctx.organisatie.id, { ...ctx.gebruiker, niveau: effectiefNiveau(ctx) }, b ?? {}))
})
