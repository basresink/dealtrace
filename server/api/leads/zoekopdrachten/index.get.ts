// GET /api/leads/zoekopdrachten: je opgeslagen zoekopdrachten (Expert).
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.opgeslagen')
  return metOrganisatie(ctx.organisatie!.id, (tx) => tx.select().from(schema.leadZoekopdrachten).where(eq(schema.leadZoekopdrachten.gebruikerId, ctx.gebruiker.id)))
})
