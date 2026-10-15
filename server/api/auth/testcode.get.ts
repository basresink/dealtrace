// GET /api/auth/testcode?email=: alleen in de ontwikkelmodus met de mail-mock; de laatst
// verstuurde code, voor lokaal inloggen en de e2e-tests. Online en met echte mail bestaat hij niet.
import { laatsteTestcode } from '../../utils/mailer'

export default defineEventHandler((event) => {
  if (useRuntimeConfig().authModus !== 'ontwikkel' || process.env.RESEND_API_KEY || useRuntimeConfig().online) throw createError({ statusCode: 404 })
  const code = laatsteTestcode(String(getQuery(event).email ?? ''))
  if (!code) throw createError({ statusCode: 404, statusMessage: 'Geen code' })
  return { code }
})
