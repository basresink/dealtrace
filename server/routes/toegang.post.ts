// Controleert het toegangswachtwoord en zet het toegangscookie (30 dagen).
import { STANDAARD_GEHEIM, TOEGANG_COOKIE, gelijk, toegangsPagina, toegangsbewijs } from '../utils/toegang'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const wachtwoord = config.toegangswachtwoord as string
  const b = await readBody<{ wachtwoord?: string; naar?: string }>(event)
  const naar = b?.naar && b.naar.startsWith('/') && !b.naar.startsWith('//') ? b.naar : '/'
  if (!wachtwoord) return sendRedirect(event, naar, 303)
  const geheim = (config.sessieGeheim as string) || STANDAARD_GEHEIM
  if (!gelijk(toegangsbewijs(b?.wachtwoord ?? '', geheim), toegangsbewijs(wachtwoord, geheim))) {
    await new Promise((r) => setTimeout(r, 800)) // raden vertragen
    setResponseStatus(event, 401)
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return toegangsPagina({ naar, fout: 'Dat wachtwoord klopt niet.' })
  }
  setCookie(event, TOEGANG_COOKIE, toegangsbewijs(wachtwoord, geheim), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    secure: getRequestURL(event).protocol === 'https:',
  })
  return sendRedirect(event, naar, 303)
})
