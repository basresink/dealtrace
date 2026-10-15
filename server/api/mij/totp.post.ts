// POST /api/mij/totp {stap: 'start'|'bevestig'|'uit', code?}: de beheerder zet tweestapsverificatie
// aan (geheim tonen, met de eerste code bevestigen) of uit. De founder kan hem niet uitzetten.
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'
import { ontsleutel, versleutel } from '../../utils/geheimen'
import { maakSessie, vereisSessie } from '../../utils/sessie'
import { nieuwGeheim, otpauthUri, verifieerTotp } from '../../utils/totp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisSessie(event)
  if (!['beheerder', 'founder'].includes(ctx.echteRol)) throw createError({ statusCode: 403, statusMessage: 'Tweestapsverificatie is er voor de beheerder' })
  const b = await readBody<{ stap?: string; code?: string }>(event)
  if (b?.stap === 'start') {
    const geheim = nieuwGeheim()
    setCookie(event, 'dt_totp_nieuw', versleutel({ geheim }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 15 * 60 })
    return { geheim, uri: otpauthUri(geheim, ctx.gebruiker.email) }
  }
  if (b?.stap === 'bevestig') {
    const geheim = ontsleutel(getCookie(event, 'dt_totp_nieuw'))?.geheim
    if (!geheim || !verifieerTotp(geheim, String(b.code ?? ''))) throw createError({ statusCode: 401, statusMessage: 'Deze code klopt niet. Probeer de volgende code uit je authenticator.' })
    await gebruikDb().execute(sql`select dealtrace_zet_totp(${ctx.gebruiker.id}, ${JSON.stringify({ geheim: versleutel({ geheim }), aan: true, op: new Date().toISOString() })}::jsonb)`)
    deleteCookie(event, 'dt_totp_nieuw', { path: '/' })
    await maakSessie(event, ctx.gebruiker.id, { aal: 'aal2', tid: ctx.sessie.tid, act: Date.now() })
    return { aan: true }
  }
  if (b?.stap === 'uit') {
    if (ctx.echteRol === 'founder') throw createError({ statusCode: 422, statusMessage: 'Voor de founder is tweestapsverificatie verplicht' })
    await gebruikDb().execute(sql`select dealtrace_zet_totp(${ctx.gebruiker.id}, null)`)
    return { aan: false }
  }
  throw createError({ statusCode: 422, statusMessage: 'Onbekende stap' })
})
