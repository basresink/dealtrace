// POST /api/auth/verifieer {email, code}: na een geldige code een sessie op dit toestel (30 dagen).
// Founder (en beheerder met TOTP aan): eerst een halve sessie tot de TOTP-stap.
import { sql } from 'drizzle-orm'
import { CODE_FOUT_TEKST, GEARCHIVEERD_TEKST } from '../../../shared/inloggen'
import { gebruikDb } from '../../utils/db'
import { controleerCode, gebruikerOpEmail, totpNodig } from '../../utils/inloggen'
import { maakSessie, maakToestel } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { email, code } = await readBody<{ email?: string; code?: string }>(event)
  if (!email || !code || !(await controleerCode(email, String(code).replace(/\s/g, '')))) throw createError({ statusCode: 401, statusMessage: CODE_FOUT_TEKST })
  const g = await gebruikerOpEmail(email)
  if (!g) throw createError({ statusCode: 401, statusMessage: CODE_FOUT_TEKST })
  if (g.status === 'gearchiveerd') throw createError({ statusCode: 403, statusMessage: GEARCHIVEERD_TEKST })
  const tid = await maakToestel(event, { id: g.id, organisationId: g.organisation_id })
  const half = totpNodig(g)
  await maakSessie(event, g.id, { aal: 'aal1', tid, ...(half ? { half: true } : {}) })
  if (!half) await gebruikDb().execute(sql`select dealtrace_inlog_geslaagd(${g.id})`)
  deleteCookie(event, 'dt_werkin', { path: '/' })
  return { totpNodig: half, totpInstellen: half && !g.totp?.geheim }
})
