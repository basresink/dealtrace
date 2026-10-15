// POST /api/auth/code {email}: stuurt een code van zes cijfers (10 minuten geldig). Altijd dezelfde
// bevestiging, ook voor een onbekend adres; 429 bij de zesde aanvraag binnen een uur.
import { BEVESTIG_TEKST, geldigEmailadres, LIMIET_TEKST } from '../../../shared/inloggen'
import { vraagCodeAan } from '../../utils/inloggen'

export default defineEventHandler(async (event) => {
  const { email } = await readBody<{ email?: string }>(event)
  if (!email || !geldigEmailadres(email)) throw createError({ statusCode: 422, statusMessage: 'Vul een geldig e-mailadres in' })
  if ((await vraagCodeAan(email)) === 'limiet') throw createError({ statusCode: 429, statusMessage: LIMIET_TEKST })
  setResponseStatus(event, 202)
  return { tekst: BEVESTIG_TEKST }
})
