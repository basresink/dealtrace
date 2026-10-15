// POST /api/contacten/samenvoegen {behoudId, samenvoegenId} (Expert).
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { herbereken } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.samenvoegen')
  const { behoudId, samenvoegenId } = await readBody<{ behoudId?: string; samenvoegenId?: string }>(event)
  if (!behoudId || !samenvoegenId || behoudId === samenvoegenId) throw createError({ statusCode: 400, statusMessage: 'Kies twee verschillende contacten' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, behoudId))
    const [b] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, samenvoegenId))
    if (!a || !b) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const data = { ...(b.data ?? {}), ...(a.data ?? {}), customFields: { ...(b.data?.customFields ?? {}), ...(a.data?.customFields ?? {}) }, samengevoegdUit: [...new Set([...(a.data?.samengevoegdUit ?? []), b.id])] }
    await tx.update(schema.contacts).set({ data, email: a.email ?? b.email, firstName: a.firstName ?? b.firstName, rol: a.rol !== 'onbekend' ? a.rol : b.rol }).where(eq(schema.contacts.id, a.id))
    await tx.delete(schema.contacts).where(eq(schema.contacts.id, b.id))
    await herbereken(tx, a.accountId)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'contact.samenvoegen', resourceType: 'contacts', resourceId: a.id, changes: { samengevoegd: b.id } })
    return { id: a.id }
  })
})
