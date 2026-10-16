// POST /api/tasks: nieuwe taak ("Wat moet er gebeuren?"). Beginner: klant, contactpersoon, titel,
// actiesoort en vervaldatum. Gevorderd ook prioriteit (laag, middel, hoog, urgent), toegewezen aan,
// aanleiding, herhaling, herinnering en beschrijving. Standaard het volgende hele werkuur. Een
// contactpersoon zonder klant neemt de klant van het contact mee.
import { eq } from 'drizzle-orm'
import { volgendWerkmoment } from '../../../shared/datum'
import { ACTIETYPES, isPrioriteit } from '../../../shared/taken'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { magTaak } from '../../utils/taken'

const HERHALING = ['werkdag', 'wekelijks', 'omdeweek', 'maandelijks']

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const b = await readBody<any>(event)
  const title = String(b?.title ?? '').trim()
  if (title.length < 3) throw createError({ statusCode: 422, statusMessage: 'Geef een titel van minstens 3 tekens' })
  const actionType = (ACTIETYPES as readonly string[]).includes(b?.actionType) ? b.actionType : 'taak'
  const gevorderd = kan(ctx, 'taken.herhaling')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
    const ownerId = gevorderd && b?.ownerId ? String(b.ownerId) : ctx.gebruiker.id
    if (ownerId !== ctx.gebruiker.id && !(await magTaak(tx, ctx, ownerId))) throw createError({ statusCode: 403, statusMessage: 'Je wijst alleen taken toe binnen je team' })
    let accountId: string | null = b?.accountId ? String(b.accountId) : null
    if (accountId) { const [a] = await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, accountId)); if (!a) throw createError({ statusCode: 422, statusMessage: 'Account onbekend' }) }
    const due = b?.dueDate && !Number.isNaN(Date.parse(b.dueDate)) ? new Date(b.dueDate).toISOString() : volgendWerkmoment(new Date(), werkdagen).toISOString()
    const data: Record<string, unknown> = { herkomst: { bron: b?.signalId ? 'inzicht' : b?.herkomst === 'assistent' ? 'AI-assistent' : 'handmatig', actiesoort: actionType, uitvoerder: ownerId } }
    if (gevorderd && HERHALING.includes(b?.herhaling)) data.herhaling = { soort: b.herhaling, teller: 1, max: Math.min(52, Math.max(1, Number(b.herhalingMax) || 52)) }
    if (gevorderd && b?.herinnering?.minuten) data.herinnering = { minuten: Math.min(2880, Math.max(5, Number(b.herinnering.minuten))), kanaal: ['in-app', 'email', 'beide'].includes(b.herinnering.kanaal) ? b.herinnering.kanaal : 'in-app', verstuurd: false }
    if (gevorderd && b?.beschrijving) data.beschrijving = String(b.beschrijving).slice(0, 2000)
    if (b?.aanleiding) data.aanleiding = String(b.aanleiding).slice(0, 500)
    // De contactpersoon (vanaf de contactkaart voor iedereen) moet bij het account horen.
    let contactId: string | null = null
    if (b?.contactId) {
      const [c] = await tx.select({ id: schema.contacts.id, accountId: schema.contacts.accountId }).from(schema.contacts).where(eq(schema.contacts.id, String(b.contactId)))
      if (!c || (accountId && c.accountId !== accountId)) throw createError({ statusCode: 422, statusMessage: 'Contact hoort niet bij dit account' })
      contactId = c.id
      accountId ??= c.accountId
    }
    const [t] = await tx.insert(schema.tasks).values({
      organisationId: ctx.organisatie.id, ownerId, accountId, contactId, title: title.slice(0, 200),
      actionType, priority: gevorderd && isPrioriteit(b?.priority) ? b.priority : 'middel', dueDate: due, executor: 'mens', data,
    }).returning()
    return t
  })
})
