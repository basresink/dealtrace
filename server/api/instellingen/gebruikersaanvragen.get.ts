// GET /api/instellingen/gebruikersaanvragen: aanvragen van de eigen organisatie.
import { desc } from 'drizzle-orm'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisBeheerder(event, 'instellingen.gebruikersAanvragen')
  return metOrganisatie(organisatie.id, (tx) => tx.select().from(schema.gebruikersaanvragen).orderBy(desc(schema.gebruikersaanvragen.aangevraagdOp)).limit(50))
})
