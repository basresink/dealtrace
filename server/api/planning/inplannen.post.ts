// POST /api/planning/inplannen {accountIds, doel, proef}: een achterstand verdelen over de koude
// belblokken (F13). Eigen accounts vanaf Gevorderd; de salesmanager ook die van zijn team.
// Met proef alleen de verdeling voor de bevestiging. Met doel 'campagne' en een campagneId gaan de
// accounts naar die campagne (P16), met dezelfde controles als + Accounts op het bord.
import { inArray } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { inplannen, teamLeden } from '../../utils/planning'
import { laad, magWijzigen, maakTaken, wijzig } from '../../utils/campagnes'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'planning.inplannen')
  const b = await readBody<{ accountIds?: string[]; doel?: string; campagneId?: string; proef?: boolean }>(event)
  if (b?.doel === 'campagne' && !b.campagneId) throw createError({ statusCode: 422, statusMessage: 'Kies een campagne' })
  const ids = [...new Set((b?.accountIds ?? []).map(String))].slice(0, 500)
  if (!ids.length) throw createError({ statusCode: 422, statusMessage: 'Kies wie je wilt inplannen' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const mag = new Set(['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol) ? await teamLeden(tx, ctx.gebruiker) : [ctx.gebruiker.id])
    const eigen = await tx.select({ id: schema.accounts.id, ownerId: schema.accounts.ownerId }).from(schema.accounts).where(inArray(schema.accounts.id, ids))
    if (eigen.some((a) => !a.ownerId || !mag.has(a.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Je plant alleen accounts van jezelf of je team in' })
    if (b?.doel === 'campagne') {
      const c = await laad(tx, b.campagneId!)
      if (!(await magWijzigen(tx, ctx.gebruiker, c))) throw createError({ statusCode: 403, statusMessage: 'Alleen de eigenaar of de salesmanager voegt accounts toe aan deze campagne' })
      if (b.proef) return { campagne: c.naam, aantal: ids.length }
      const r = await wijzig(tx, c.id, { accountIds: ids }, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, ctx.organisatie!.id)
      const t = r.status === 'actief' ? await maakTaken(tx, ctx.organisatie!.id, c.id, ids) : { aantal: 0 }
      return { campagne: c.naam, toegevoegd: r.toegevoegd, taken: t.aantal }
    }
    return inplannen(tx, ctx.organisatie!.id, ids, { proef: !!b?.proef, door: ctx.gebruiker.id })
  })
})
