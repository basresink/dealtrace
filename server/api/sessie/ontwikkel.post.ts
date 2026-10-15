// Inloggen als testgebruiker; alleen in AUTH_MODUS=ontwikkel (tot P27 inloggen met code bouwt).
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'
import { maakSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  if (useRuntimeConfig().authModus !== 'ontwikkel') throw createError({ statusCode: 404 })
  const { gebruikerId } = await readBody<{ gebruikerId?: string }>(event)
  if (!gebruikerId) throw createError({ statusCode: 400, statusMessage: 'gebruikerId ontbreekt' })
  const res = await gebruikDb().execute(sql`select id from dealtrace_sessie_gebruiker(${gebruikerId})`)
  if (!res.rows.length) throw createError({ statusCode: 404, statusMessage: 'Gebruiker onbekend' })
  await maakSessie(event, gebruikerId)
  return { ok: true }
})
