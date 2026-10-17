// POST /api/signals/:id/omzetten {patch?}: "Maak taak". De taak erft titel, prioriteit,
// actiesoort, broninzicht en regel, met het label "Uit inzicht". 409 als al omgezet.
import { eq } from 'drizzle-orm'
import { volgendWerkmoment } from '../../../../shared/datum'
import { voorinvullingUitInzicht } from '../../../../shared/taken'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const patch = await readBody<any>(event).catch(() => ({}))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select().from(schema.signals).where(eq(schema.signals.id, id))
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Inzicht onbekend' })
    if (s.status === 'omgezet') throw createError({ statusCode: 409, statusMessage: 'Dit inzicht is al omgezet in een taak' })
    const [a] = s.accountId ? await tx.select({ naam: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.id, s.accountId)) : []
    const v = voorinvullingUitInzicht({ ...s, accountNaam: a?.naam ?? null, data: s.data as any })
    const nu = new Date()
    const [t] = await tx.insert(schema.tasks).values({
      organisationId: ctx.organisatie.id, ownerId: s.ownerId ?? ctx.gebruiker.id, accountId: s.accountId, contactId: s.contactId, signalId: s.id, ruleId: s.ruleId,
      onderwerp: s.onderwerp, title: String(patch?.title ?? v.title).slice(0, 200), priority: patch?.priority ?? v.priority, actionType: patch?.actionType ?? v.actionType,
      dueDate: patch?.dueDate ?? volgendWerkmoment(nu).toISOString(), executor: 'mens',
      data: { herkomst: { bron: 'inzicht', inzichtId: s.id, regelId: s.ruleId, actiesoort: v.actionType, uitvoerder: s.ownerId }, waarom: s.data?.waarom, bewijs: s.data?.bewijs, aanleiding: s.title, ...((s.data as any)?.winpunt ? { winpunt: (s.data as any).winpunt } : {}) },
    }).returning()
    await tx.update(schema.signals).set({ status: 'omgezet', updatedAt: nu.toISOString() }).where(eq(schema.signals.id, id))
    return t
  })
})
