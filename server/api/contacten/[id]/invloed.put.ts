// PUT /api/contacten/:id/invloed {houding?, rapporteertAan?, rol?, bevestigRol?, voorstel?}: de invloedskaart
// (F8). Houding (voor, neutraal, tegen, onbekend) en rapporteert-aan (een ander actief contact van hetzelfde
// account, zonder kring) staan in contacts.data.invloed. Rol wijzigen of bevestigen zet de rol als bevestigd door
// jou. Een voorstel van de Notulist bevestig of verwerp je; bevestigen neemt houding en citaat over.
import { eq, sql } from 'drizzle-orm'
import { ROLLEN_CONTACT } from '../../../../shared/contactgegevens'
import { geenKring, isHouding, type InvloedData } from '../../../../shared/invloed'
import { herbereken } from '../../../utils/accounts'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<Record<string, any>>(event)
  if ('houding' in b && !isHouding(b.houding)) throw createError({ statusCode: 400, statusMessage: 'Houding is voor, neutraal, tegen of onbekend' })
  if ('rol' in b && !(ROLLEN_CONTACT as readonly string[]).includes(b.rol)) throw createError({ statusCode: 400, statusMessage: 'Onbekende rol' })
  if ('voorstel' in b && !['bevestig', 'verwerp'].includes(b.voorstel)) throw createError({ statusCode: 400, statusMessage: 'Een voorstel bevestig of verwerp je' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, id))
    if (!c) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const nu = new Date().toISOString()
    const inv: InvloedData = { ...((c.data as any)?.invloed ?? {}) }
    const set: Partial<typeof schema.contacts.$inferInsert> = { updatedAt: nu }
    if ('voorstel' in b) {
      if (!inv.voorstel) throw createError({ statusCode: 409, statusMessage: 'Er is geen voorstel meer' })
      if (b.voorstel === 'bevestig') Object.assign(inv, { houding: inv.voorstel.houding, houdingCitaat: inv.voorstel.citaat, houdingDoor: ctx.gebruiker.id, houdingOp: nu })
      inv.voorstel = null
    }
    if ('houding' in b) Object.assign(inv, { houding: b.houding, houdingCitaat: null, houdingDoor: ctx.gebruiker.id, houdingOp: nu, voorstel: null })
    if ('rapporteertAan' in b) {
      const aan = b.rapporteertAan ? String(b.rapporteertAan) : null
      if (aan) {
        const lijst = (await tx.execute(sql`select id, data->'invloed'->>'rapporteertAan' as "rapporteertAan" from contacts where account_id = ${c.accountId} and status <> 'vertrokken'`)).rows as { id: string; rapporteertAan: string | null }[]
        if (!lijst.some((x) => x.id === aan)) throw createError({ statusCode: 422, statusMessage: 'Rapporteert aan iemand van hetzelfde account' })
        if (!geenKring(lijst, id, aan)) throw createError({ statusCode: 422, statusMessage: 'Dan rapporteren ze aan elkaar; kies iemand anders' })
      }
      inv.rapporteertAan = aan
    }
    if ('rol' in b || b.bevestigRol) {
      if ('rol' in b) set.rol = b.rol
      Object.assign(inv, { rolBevestigdDoor: ctx.gebruiker.id, rolBevestigdOp: nu })
    }
    set.data = { ...(c.data ?? {}), invloed: inv }
    await tx.update(schema.contacts).set(set).where(eq(schema.contacts.id, id))
    if ('rol' in b) await herbereken(tx, c.accountId)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'contact.invloed', resourceType: 'contacts', resourceId: id, changes: { houding: b.houding, rapporteertAan: b.rapporteertAan, rol: b.rol, bevestigRol: !!b.bevestigRol, voorstel: b.voorstel } })
    return { ok: true, rol: set.rol ?? c.rol, invloed: inv }
  })
})
