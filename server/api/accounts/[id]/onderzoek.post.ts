// POST /api/accounts/:id/onderzoek: "Laat opnieuw onderzoeken" (P19). De Verrijker ververst het dossier;
// 10 credits (dossier). 402 als de credits op zijn, 409 als de Bewaker de Verrijker tegenhoudt.
import { onderzoekAccount } from '../../../utils/agents/verrijker'
import { metOrganisatie } from '../../../utils/db'
import { magAccount } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'account.opnieuwOnderzoeken')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is niet van jou' })
    const r = await onderzoekAccount(tx, ctx.organisatie.id, id, { gebruiker: { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data } })
    if (!r.ok) throw createError({ statusCode: 409, statusMessage: r.reden ?? 'De Verrijker kon niet draaien' })
    return r
  })
})
