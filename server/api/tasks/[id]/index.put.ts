// PUT /api/tasks/:id: bewerkstand (klant, contactpersoon, titel, prioriteit, vervaldatum, actiesoort, toegewezen aan,
// aanleiding, herinnering en beschrijving). Een contactpersoon hoort bij de klant van de taak.
import { eq } from 'drizzle-orm'
import { ACTIETYPES, isPrioriteit } from '../../../../shared/taken'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    if (b.ownerId && b.ownerId !== t.ownerId && !(await magTaak(tx, ctx, b.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Je wijst alleen taken toe binnen je team' })
    const set: Partial<typeof schema.tasks.$inferInsert> = { updatedAt: new Date().toISOString() }
    if (typeof b.title === 'string') { if (b.title.trim().length < 3) throw createError({ statusCode: 422, statusMessage: 'Geef een titel van minstens 3 tekens' }); set.title = b.title.trim().slice(0, 200) }
    if (isPrioriteit(b.priority)) set.priority = b.priority
    // Klant en contact: een ander account wist een contact dat er niet bij hoort.
    let accountId = t.accountId
    if ('accountId' in b) {
      accountId = b.accountId ? String(b.accountId) : null
      if (accountId) { const [a] = await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, accountId)); if (!a) throw createError({ statusCode: 422, statusMessage: 'Account onbekend' }) }
      set.accountId = accountId
      if (!('contactId' in b) && t.contactId) set.contactId = null
    }
    if ('contactId' in b) {
      if (!b.contactId) set.contactId = null
      else {
        const [c] = await tx.select({ id: schema.contacts.id, accountId: schema.contacts.accountId }).from(schema.contacts).where(eq(schema.contacts.id, String(b.contactId)))
        if (!c || (accountId && c.accountId !== accountId)) throw createError({ statusCode: 422, statusMessage: 'Contact hoort niet bij dit account' })
        set.contactId = c.id
        if (!accountId) set.accountId = c.accountId
      }
    }
    if ((ACTIETYPES as readonly string[]).includes(b.actionType)) set.actionType = b.actionType
    if (b.dueDate && !Number.isNaN(Date.parse(b.dueDate))) set.dueDate = new Date(b.dueDate).toISOString()
    if (b.ownerId) set.ownerId = b.ownerId
    if ('beschrijving' in b || 'aanleiding' in b || 'herinnering' in b) {
      const d: Record<string, unknown> = { ...(t.data ?? {}) }
      if ('beschrijving' in b) d.beschrijving = String(b.beschrijving ?? '').slice(0, 2000)
      if ('aanleiding' in b) d.aanleiding = String(b.aanleiding ?? '').slice(0, 500)
      if ('herinnering' in b) {
        if (b.herinnering?.minuten) d.herinnering = { minuten: Math.min(2880, Math.max(5, Number(b.herinnering.minuten))), kanaal: ['in-app', 'email', 'beide'].includes(b.herinnering.kanaal) ? b.herinnering.kanaal : 'in-app', verstuurd: false }
        else delete d.herinnering
      }
      set.data = d
    }
    const [na] = await tx.update(schema.tasks).set(set).where(eq(schema.tasks.id, id)).returning()
    return na
  })
})
