// POST /api/accounts/:id/committee: "Stel voor met AI" (P19, F04). De Profielbouwer stelt per functie
// een rol voor met bron en zekerheid; onder 60 is het vermoedelijk. Het voorstel blijft in accounts.data.committee
// staan voor de invloedskaart (F8). 3 credits (brief); 402 zonder credits.
import { sql } from 'drizzle-orm'
import { stelCommitteeVoor } from '../../../utils/agents/profielbouwer'
import { metOrganisatie } from '../../../utils/db'
import { magAccount } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is niet van jou' })
    const r = await stelCommitteeVoor(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, id)
    // F8: het laatste voorstel blijft op het account, zodat de invloedskaart de rollen zonder naam toont.
    if (r.voorstellen.length) {
      const committee = { voorstellen: r.voorstellen.map((v: any) => ({ functie: v.functie, rol: v.rol, bron: v.bron, zekerheid: v.zekerheid })), op: new Date().toISOString(), door: ctx.gebruiker.id }
      await tx.execute(sql`update accounts set data = jsonb_set(data, '{committee}', ${JSON.stringify(committee)}::jsonb) where id = ${id}`)
    }
    return r
  })
})
