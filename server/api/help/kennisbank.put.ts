// PUT /api/help/kennisbank {aan}: de eigen artikelen als bron voor de AI-assistent (beheerder vanaf Plus).
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'help.kennisbankBron')
  const { aan } = await readBody<{ aan?: boolean }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ctx.organisatie.id}, 'helpKennisbank', ${JSON.stringify(!!aan)}::jsonb) on conflict (organisation_id, key) do update set value = excluded.value`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'help.kennisbank', resourceType: 'org_settings', resourceId: 'helpKennisbank', changes: { aan: !!aan } })
    return { aan: !!aan, tekst: aan ? 'De AI-assistent gebruikt nu ook jullie eigen artikelen.' : 'De AI-assistent gebruikt alleen de artikelen van Dealtrace.' }
  })
})
