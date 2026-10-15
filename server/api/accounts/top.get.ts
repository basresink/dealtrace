// GET /api/accounts/top: "Top deze week", de zes belangrijkste eigen prospects op score.
import { and, desc, eq, notInArray } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.lijst')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await tx.select().from(schema.accounts)
      .where(and(eq(schema.accounts.accountKind, 'prospect'), eq(schema.accounts.ownerId, ctx.gebruiker.id), notInArray(schema.accounts.nbStatus, ['nee', 'overgedragen'])))
      .orderBy(desc(schema.accounts.score)).limit(6)
    return rijen.map((a, i) => ({ rang: i + 1, id: a.id, naam: a.name, klasse: a.klasse, plaats: a.city, branche: a.data?.branche ?? null, aanleiding: a.data?.aanleiding ?? null, status: a.nbStatus, score: a.score }))
  })
})
