// POST /api/auth/totp {code}: de tweede stap. Zonder geheim (eerste keer, founder) eerst
// GET /api/auth/totp voor het geheim; de eerste geldige code bevestigt en bewaart het.
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'
import { ontsleutel, versleutel } from '../../utils/geheimen'
import { leesSessieInhoud, maakSessie } from '../../utils/sessie'
import { verifieerTotp } from '../../utils/totp'

export default defineEventHandler(async (event) => {
  const s = await leesSessieInhoud(event)
  if (!s?.half) throw createError({ statusCode: 401, statusMessage: 'Log eerst in met je code' })
  const { code } = await readBody<{ code?: string }>(event)
  const [g] = (await gebruikDb().execute(sql`select u.email, u.data->'totp' as totp from dealtrace_sessie_gebruiker(${s.sub}) u`)).rows as { email: string; totp: any }[]
  if (!g) throw createError({ statusCode: 401, statusMessage: 'Log opnieuw in' })
  let geheim = ontsleutel(g.totp?.geheim)?.geheim
  const nieuw = !geheim
  if (!geheim) geheim = ontsleutel(getCookie(event, 'dt_totp_nieuw'))?.geheim
  if (!geheim || !verifieerTotp(geheim, String(code ?? ''))) throw createError({ statusCode: 401, statusMessage: 'Deze code klopt niet. Probeer de volgende code uit je authenticator.' })
  if (nieuw) {
    await gebruikDb().execute(sql`select dealtrace_zet_totp(${s.sub}, ${JSON.stringify({ geheim: versleutel({ geheim }), aan: true, op: new Date().toISOString() })}::jsonb)`)
    deleteCookie(event, 'dt_totp_nieuw', { path: '/' })
  }
  await gebruikDb().execute(sql`select dealtrace_inlog_geslaagd(${s.sub})`)
  await maakSessie(event, s.sub, { aal: 'aal2', tid: s.tid, act: Date.now() })
  return { ok: true }
})
