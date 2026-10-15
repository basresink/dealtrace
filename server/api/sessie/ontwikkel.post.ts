// Inloggen als testgebruiker; alleen in AUTH_MODUS=ontwikkel. Buiten de ontwikkelmodus log je in met een code (P27).
import { sql } from 'drizzle-orm'
import { gebruikDb } from '../../utils/db'
import { maakSessie, maakToestel } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  if (useRuntimeConfig().authModus !== 'ontwikkel') throw createError({ statusCode: 404 })
  const { gebruikerId } = await readBody<{ gebruikerId?: string }>(event)
  if (!gebruikerId) throw createError({ statusCode: 400, statusMessage: 'gebruikerId ontbreekt' })
  const res = await gebruikDb().execute(sql`select id, role, organisation_id from dealtrace_sessie_gebruiker(${gebruikerId})`)
  if (!res.rows.length) throw createError({ statusCode: 404, statusMessage: 'Gebruiker onbekend' })
  const g = res.rows[0] as any
  // Ontwikkelmodus: de founder geldt als geverifieerd (aal2) zonder TOTP-stap. Gevaarlijke
  // acties vragen nog steeds herbevestiging.
  const tid = await maakToestel(event, { id: gebruikerId, organisationId: g.organisation_id })
  await maakSessie(event, gebruikerId, { aal: g.role === 'founder' ? 'aal2' : 'aal1', tid })
  deleteCookie(event, 'dt_werkin', { path: '/' })
  return { ok: true }
})
