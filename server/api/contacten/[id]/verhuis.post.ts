// POST /api/contacten/:id/verhuis {accountId}: contact naar een ander bedrijf (Expert).
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { herbereken } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.verhuizen')
  const id = getRouterParam(event, 'id')!
  const { accountId } = await readBody<{ accountId?: string }>(event)
  if (!accountId) throw createError({ statusCode: 400, statusMessage: 'Kies een bedrijf' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, id))
    const [a] = await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, accountId))
    if (!c || !a) throw createError({ statusCode: 404, statusMessage: 'Contact of bedrijf onbekend' })
    const op = new Date().toISOString().slice(0, 10)
    await tx.update(schema.contacts).set({ accountId, data: { ...c.data, verhuisd: [...((c.data as any)?.verhuisd ?? []), { van: c.accountId, op }] }, updatedAt: new Date().toISOString() }).where(eq(schema.contacts.id, id))
    await herbereken(tx, c.accountId)
    await herbereken(tx, accountId)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'contact.verhuizen', resourceType: 'contacts', resourceId: id, changes: { van: c.accountId, naar: accountId } })
    return { id, accountId, op }
  })
})
