// GET /api/contacten/:id/tabbladen: dezelfde tabbladen als de accountkaart, maar alleen wat bij dit contact
// hoort (taken, inzichten, afspraken, mails, verslagen, notities, documenten en campagnes van dit contact).
// Deals zijn de stand van het account. De opbouw staat in server/utils/kaartTabbladen.ts.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { kaartTabbladen } from '../../../utils/kaartTabbladen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = (await tx.execute(sql`select c.id, c.account_id, a.name, a.data from contacts c join accounts a on a.id = c.account_id where c.id = ${id}`)).rows as any[]
    if (!c) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const ids = [c.account_id, ...((c.data?.samengevoegdUit as string[] | undefined) ?? [])]
    return kaartTabbladen(tx, { account: { id: c.account_id, naam: c.name, ids }, contactId: id, gebruikerId: ctx.gebruiker.id })
  })
})
