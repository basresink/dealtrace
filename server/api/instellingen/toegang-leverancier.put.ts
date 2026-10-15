// PUT /api/instellingen/toegang-leverancier {stand}: "altijd" of "na_toestemming" (open vraag 4).
import { eq, sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisBeheerder(event, 'instellingen.audit', { nietDoorLeverancier: true })
  const { stand } = await readBody<{ stand?: string }>(event)
  if (stand !== 'altijd' && stand !== 'na_toestemming') throw createError({ statusCode: 400, statusMessage: 'Kies altijd of na_toestemming' })
  return metOrganisatie(organisatie.id, async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, organisatie.id))
    await tx.execute(sql`update organisations set data = data || jsonb_build_object('toegangLeverancier', ${stand}::text), updated_at = now() where id = ${organisatie.id}`)
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'toegangLeverancier.wijzigen', resourceType: 'organisations', resourceId: organisatie.id, changes: { van: o?.data?.toegangLeverancier ?? 'altijd', naar: stand } })
    return { stand }
  })
})
