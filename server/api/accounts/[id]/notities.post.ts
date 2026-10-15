// POST /api/accounts/:id/notities {tekst, contactId?}: notitie in de activiteitenlog.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const { tekst, contactId } = await readBody<{ tekst?: string; contactId?: string }>(event)
  if (!tekst?.trim()) throw createError({ statusCode: 400, statusMessage: 'Een notitie heeft tekst' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const [n] = await tx.insert(schema.activiteiten).values({ organisationId: ctx.organisatie.id, accountId: id, contactId: contactId ?? null, soort: 'notitie', door: ctx.gebruiker.id, data: { tekst: tekst.trim().slice(0, 5000) } }).returning()
    return { id: n!.id }
  })
})
