// POST /api/campagnes/:id/items/:accountId/kolom {kolom, uitkomst?, reden?, winpuntUitgevoerd?}: een
// kolomwissel op het bord. Naar Afspraak, Geparkeerd of Afgewezen vraagt de uitkomst (400 zonder); de
// open taak wordt afgerond met dezelfde uitkomst via rondAf (gat 38).
import { sql } from 'drizzle-orm'
import { KOLOMMEN } from '../../../../../../shared/campagnes'
import { kolomWissel, laad, magWijzigen } from '../../../../../utils/campagnes'
import { metOrganisatie } from '../../../../../utils/db'
import { vereisFunctie } from '../../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.meedoen')
  const id = getRouterParam(event, 'id')!
  const accountId = getRouterParam(event, 'accountId')!
  const b = await readBody<any>(event)
  if (!KOLOMMEN.includes(b?.kolom)) throw createError({ statusCode: 400, statusMessage: 'Onbekende kolom' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const c = await laad(tx, id)
    const [it] = (await tx.execute(sql`select eigenaar_id from campagne_items where campagne_id = ${id} and account_id = ${accountId}`)).rows as any[]
    if (it?.eigenaar_id !== ctx.gebruiker.id && !(await magWijzigen(tx, ctx.gebruiker, c))) throw createError({ statusCode: 403, statusMessage: 'Dit account is van een collega' })
    return kolomWissel(tx, ctx.organisatie.id, ctx.gebruiker.id, id, accountId, { kolom: b.kolom, uitkomst: b.uitkomst ?? null, reden: b.reden ?? null, toelichting: b.toelichting ?? null, laterOp: b.laterOp ?? null, winpuntUitgevoerd: typeof b.winpuntUitgevoerd === 'boolean' ? b.winpuntUitgevoerd : null })
  })
})
