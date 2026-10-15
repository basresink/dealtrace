// POST /api/planning/inplannen {accountIds, doel, proef}: een achterstand verdelen over de koude
// belblokken (F13). Eigen accounts vanaf Gevorderd; de salesmanager ook die van zijn team.
// Met proef alleen de verdeling voor de bevestiging. Campagnes komen met P16.
import { inArray } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { inplannen, teamLeden } from '../../utils/planning'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'planning.inplannen')
  const b = await readBody<{ accountIds?: string[]; doel?: string; proef?: boolean }>(event)
  if (b?.doel === 'campagne') throw createError({ statusCode: 422, statusMessage: 'Campagnes komen in een volgende versie' })
  const ids = [...new Set((b?.accountIds ?? []).map(String))].slice(0, 500)
  if (!ids.length) throw createError({ statusCode: 422, statusMessage: 'Kies wie je wilt inplannen' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const mag = new Set(['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol) ? await teamLeden(tx, ctx.gebruiker) : [ctx.gebruiker.id])
    const eigen = await tx.select({ id: schema.accounts.id, ownerId: schema.accounts.ownerId }).from(schema.accounts).where(inArray(schema.accounts.id, ids))
    if (eigen.some((a) => !a.ownerId || !mag.has(a.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Je plant alleen accounts van jezelf of je team in' })
    return inplannen(tx, ctx.organisatie!.id, ids, { proef: !!b?.proef, door: ctx.gebruiker.id })
  })
})
