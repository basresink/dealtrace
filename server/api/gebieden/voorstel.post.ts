// POST /api/gebieden/voorstel: een voorstel voor regio's uit de portefeuille (eerste cijfer van de postcode).
import { sql } from 'drizzle-orm'
import { voorstelUitAccounts } from '../../../shared/gebieden'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.gebieden')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ regios: voorstelUitAccounts(((await tx.execute(sql`select postcode, city from accounts`)).rows as any[]).map((a) => ({ postcode: a.postcode, plaats: a.city }))) }))
})
