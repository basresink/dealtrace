// PUT /api/ritmes/:id {naam?, stappen, parkeerDagen}: salesmanager en beheerder. 422 bij een stap zonder kanaal.
import { eq } from 'drizzle-orm'
import { valideerRitme } from '../../../../shared/hercontact'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'ritme.beheer')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.hercontactritmes).where(eq(schema.hercontactritmes.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Ritme onbekend' })
    const stappen = (Array.isArray(b?.stappen) ? b.stappen : r.data.stappen).map((s: any, i: number) => ({ volgnummer: i + 1, dagOffset: Number(s.dagOffset), kanaal: s.kanaal, ...(s.instructie ? { instructie: String(s.instructie).slice(0, 200) } : {}) }))
    const nieuw = { naam: String(b?.naam ?? r.naam).trim(), stappen, parkeerDagen: Number(b?.parkeerDagen ?? r.data.parkeerDagen) }
    const fouten = valideerRitme(nieuw)
    if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
    await tx.update(schema.hercontactritmes).set({ naam: nieuw.naam, versie: r.versie + 1, data: { ...r.data, stappen, parkeerDagen: nieuw.parkeerDagen }, updatedAt: new Date().toISOString() }).where(eq(schema.hercontactritmes.id, id))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'ritme.wijzigen', resourceType: 'hercontactritmes', resourceId: id, changes: { van: r.data, naar: nieuw } })
    return { id, versie: r.versie + 1 }
  })
})
