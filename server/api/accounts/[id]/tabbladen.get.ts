// GET /api/accounts/:id/tabbladen: wat de tabbladen van de accountkaart tonen (opzet uit DealDrive):
// taken, inzichten, afspraken, e-mails, gespreksverslagen, deals (overdracht en stand in DealDrive),
// campagnes, documenten en de momenten (tijdlijn en notities). Van alle contacten van het account;
// elk item draagt contactId en contactNaam. De opbouw staat in server/utils/kaartTabbladen.ts.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { kaartTabbladen } from '../../../utils/kaartTabbladen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [acc] = (await tx.execute(sql`select id, name, data from accounts where id = ${id}`)).rows as any[]
    if (!acc) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const ids = [id, ...((acc.data?.samengevoegdUit as string[] | undefined) ?? [])]
    return kaartTabbladen(tx, { account: { id, naam: acc.name, ids }, gebruikerId: ctx.gebruiker.id })
  })
})
