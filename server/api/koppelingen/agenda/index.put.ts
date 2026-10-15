// PUT /api/koppelingen/agenda {aan}: de beheerder zet de agendakoppeling aan of uit voor de organisatie.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder zet de agendakoppeling aan' })
  const aan = !!(await readBody<{ aan?: boolean }>(event))?.aan
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ctx.organisatie!.id}, 'agendaKoppeling', ${JSON.stringify({ aan })}::jsonb)
      on conflict (organisation_id, key) do update set value = excluded.value`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie!.id, actorId: ctx.gebruiker.id, action: 'koppeling.agenda', resourceType: 'org_settings', resourceId: 'agendaKoppeling', changes: { aan } })
    return { aan }
  })
})
