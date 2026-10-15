// PUT /api/instellingen/credits/dagplafonds {soort: aantal}: dagplafond per AI-soort voor de agents (11.4). Beheerder.
import { sql } from 'drizzle-orm'
import { AI_SOORTEN } from '../../../../shared/credits'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'credits.beheer')
  const b = (await readBody<Record<string, unknown>>(event)) ?? {}
  const uit: Record<string, number> = {}
  for (const [k, v] of Object.entries(b)) {
    if (!(AI_SOORTEN as readonly string[]).includes(k)) throw createError({ statusCode: 422, statusMessage: `Onbekende AI-soort: ${k}` })
    if (v === null || v === '') continue
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0) throw createError({ statusCode: 422, statusMessage: 'Een dagplafond is een heel getal van 0 of meer' })
    uit[k] = n
  }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ctx.organisatie.id}, 'agentCreditsPerSoort', ${JSON.stringify(uit)}::jsonb)
      on conflict (organisation_id, key) do update set value = excluded.value`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'credits.dagplafonds', resourceType: 'org_settings', resourceId: 'agentCreditsPerSoort', changes: uit })
    return uit
  })
})
