// POST /api/sessie/herbevestig {code}: herbevestiging voor gevaarlijke acties (15 minuten geldig).
// Echte TOTP komt met P27. In de ontwikkelmodus geldt elke code van 6 cijfers.
import { maakSessie, vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisSessie(event)
  const { code } = await readBody<{ code?: string }>(event)
  if (useRuntimeConfig().authModus !== 'ontwikkel') throw createError({ statusCode: 501, statusMessage: 'Tweestapsverificatie komt met P27' })
  if (!/^\d{6}$/.test(code ?? '')) throw createError({ statusCode: 400, statusMessage: 'Vul de 6 cijfers uit je authenticator in' })
  const hb = new Date().toISOString()
  await maakSessie(event, ctx.gebruiker.id, { aal: ctx.sessie.aal, hb, act: Date.now() })
  return { herbevestigdTot: new Date(Date.parse(hb) + 15 * 60_000).toISOString() }
})
