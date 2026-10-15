// Lijst testgebruikers voor de inlogpagina; alleen in AUTH_MODUS=ontwikkel (tot P27).
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'

export default defineEventHandler(async () => {
  if (useRuntimeConfig().authModus !== 'ontwikkel') throw createError({ statusCode: 404 })
  const res = await gebruikDb().execute(sql`select * from dealtrace_ontwikkel_gebruikers()`)
  return res.rows
})
