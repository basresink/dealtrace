// PUT /api/belscripts/:id {naam?, doel?, data}: de werkkopie opslaan. Wie belt, ziet pas iets
// na "Activeer". Beheer: salesmanager en beheerder; een variant: de eigenaar.
import { eq } from 'drizzle-orm'
import { SCRIPT_DOELEN } from '../../../../shared/belscripts'
import { metOrganisatie, schema } from '../../../utils/db'
import { kan } from '../../../utils/accounts'
import { schoonData, valideerVoorOrg } from '../../../utils/belscripts'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.belscripts).where(eq(schema.belscripts.id, id))
    if (!r || (r.isPersoonlijk && r.gebruikerId !== ctx.gebruiker.id)) throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
    if (r.isPersoonlijk ? !kan(ctx, 'belscript.variant') : !kan(ctx, 'belscript.beheer')) throw createError({ statusCode: 403, statusMessage: 'Je mag dit script niet wijzigen' })
    const naam = b?.naam !== undefined ? String(b.naam).trim().slice(0, 120) : r.naam
    // Een variant erft doel, fases en koppelingen van het origineel.
    const doel = r.isPersoonlijk ? r.doel : SCRIPT_DOELEN.includes(b?.doel) ? b.doel : r.doel
    const data = schoonData(r.isPersoonlijk ? { ...b?.data, reisfaseIds: r.data.reisfaseIds, doelgroepIds: r.data.doelgroepIds, teamIds: r.data.teamIds, contactRollen: r.data.contactRollen, standaardVoor: r.data.standaardVoor } : b?.data ?? {}, r.data)
    const v = await valideerVoorOrg(tx, { naam, doel: doel as any, data })
    if (v.fouten.length) throw createError({ statusCode: 422, statusMessage: v.fouten[0]!, data: v })
    await tx.update(schema.belscripts).set({ naam, doel, data, updatedAt: new Date().toISOString() }).where(eq(schema.belscripts.id, id))
    return { id, waarschuwingen: v.waarschuwingen, woorden: v.woorden }
  })
})
