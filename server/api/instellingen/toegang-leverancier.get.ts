// GET /api/instellingen/toegang-leverancier: stand en openstaande verzoeken.
import { desc, eq } from 'drizzle-orm'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisBeheerder(event, 'instellingen.audit')
  return metOrganisatie(organisatie.id, async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, organisatie.id))
    const verzoeken = await tx.select().from(schema.toegangsverzoeken).orderBy(desc(schema.toegangsverzoeken.aangevraagdOp)).limit(20)
    const nu = Date.now()
    return {
      stand: o?.data?.toegangLeverancier ?? 'altijd',
      verzoeken: verzoeken.map((v) => ({ ...v, verlopen: v.status === 'open' && Date.parse(v.geldigTot) < nu })),
    }
  })
})
