// POST /api/sessie/herbevestig {code}: herbevestiging voor gevaarlijke acties (15 minuten geldig).
// Met een TOTP-geheim geldt de code uit de authenticator; zonder geheim alleen in de
// ontwikkelmodus elke code van 6 cijfers.
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'
import { ontsleutel } from '../../utils/geheimen'
import { maakSessie, vereisSessie } from '../../utils/sessie'
import { verifieerTotp } from '../../utils/totp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisSessie(event)
  const { code } = await readBody<{ code?: string }>(event)
  if (!/^\d{6}$/.test(code ?? '')) throw createError({ statusCode: 400, statusMessage: 'Vul de 6 cijfers uit je authenticator in' })
  const [g] = (await gebruikDb().execute(sql`select totp from dealtrace_gebruiker_op_email(${ctx.gebruiker.email})`)).rows as { totp: any }[]
  const geheim = ontsleutel(g?.totp?.geheim)?.geheim
  if (geheim ? !verifieerTotp(geheim, code!) : useRuntimeConfig().authModus !== 'ontwikkel') throw createError({ statusCode: 401, statusMessage: 'Deze code klopt niet. Probeer de volgende code uit je authenticator.' })
  const hb = new Date().toISOString()
  await maakSessie(event, ctx.gebruiker.id, { aal: ctx.sessie.aal, hb, act: Date.now(), tid: ctx.sessie.tid })
  return { herbevestigdTot: new Date(Date.parse(hb) + 15 * 60_000).toISOString() }
})
