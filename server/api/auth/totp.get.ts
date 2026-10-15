// GET /api/auth/totp: bij de eerste keer (founder zonder geheim) een nieuw geheim met de
// otpauth-link voor de authenticator-app. Het geheim staat versleuteld in een cookie tot de
// eerste geldige code het bevestigt.
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'
import { versleutel } from '../../utils/geheimen'
import { leesSessieInhoud } from '../../utils/sessie'
import { nieuwGeheim, otpauthUri } from '../../utils/totp'

export default defineEventHandler(async (event) => {
  const s = await leesSessieInhoud(event)
  if (!s?.half) throw createError({ statusCode: 401, statusMessage: 'Log eerst in met je code' })
  const [g] = (await gebruikDb().execute(sql`select u.email, u.data->'totp' as totp from dealtrace_sessie_gebruiker(${s.sub}) u`)).rows as { email: string; totp: any }[]
  if (g?.totp?.geheim) return { instellen: false }
  const geheim = nieuwGeheim()
  setCookie(event, 'dt_totp_nieuw', versleutel({ geheim }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 15 * 60 })
  return { instellen: true, geheim, uri: otpauthUri(geheim, g!.email) }
})
