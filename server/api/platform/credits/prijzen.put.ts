// PUT /api/platform/credits/prijzen {soort, credits}: de prijs per handeling aanpassen zonder release. Founder.
import { sql } from 'drizzle-orm'
import { AI_SOORTEN } from '../../../../shared/credits'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ soort?: string; credits?: number }>(event)
  if (!(AI_SOORTEN as readonly string[]).includes(b?.soort ?? '')) throw createError({ statusCode: 422, statusMessage: 'Onbekende AI-soort' })
  const credits = Number(b!.credits)
  if (!Number.isInteger(credits) || credits < 0 || credits > 1000) throw createError({ statusCode: 422, statusMessage: 'Een prijs is een heel getal van 0 tot 1000' })
  return alsPlatform(async (tx) => {
    await tx.execute(sql`insert into credit_instellingen (sleutel, waarde, gewijzigd_door) values (${`prijs:${b!.soort}`}, ${credits}, ${ctx.gebruiker.id})
      on conflict (sleutel) do update set waarde = excluded.waarde, gewijzigd_door = excluded.gewijzigd_door, gewijzigd_op = now()`)
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'credits.prijs', object: b!.soort, na: { credits } })
    return { soort: b!.soort, credits }
  })
})
