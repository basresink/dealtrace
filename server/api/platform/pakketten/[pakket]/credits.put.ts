// PUT /api/platform/pakketten/:pakket/credits {perGebruiker}: credits per gebruiker per maand voor een pakket. Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const pakket = getRouterParam(event, 'pakket')
  if (!['starter', 'plus', 'compleet'].includes(pakket ?? '')) throw createError({ statusCode: 404, statusMessage: 'Onbekend pakket' })
  const n = Number((await readBody<{ perGebruiker?: number }>(event))?.perGebruiker)
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw createError({ statusCode: 422, statusMessage: 'Een heel getal van 0 of meer' })
  return alsPlatform(async (tx) => {
    await tx.execute(sql`insert into credit_instellingen (sleutel, waarde, gewijzigd_door) values (${`pot:${pakket}`}, ${n}, ${ctx.gebruiker.id})
      on conflict (sleutel) do update set waarde = excluded.waarde, gewijzigd_door = excluded.gewijzigd_door, gewijzigd_op = now()`)
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'credits.pakket', object: pakket, na: { perGebruiker: n } })
    return { pakket, perGebruiker: n }
  })
})
