// GET /api/organisatie/logo: het logo van de eigen organisatie, voor iedereen in de organisatie (zijbalk).
// Een svg krijgt een strikte CSP en nosniff, zodat hij ook los geopend nooit iets uitvoert.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { leesLogo } from '../../utils/organisatieLogo'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const b = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const l = await leesLogo(tx)
    if (!l) return null
    const [r] = (await tx.execute(sql`select mime, inhoud from bijlagen where id = ${l.bijlageId} and organisation_id = ${ctx.organisatie.id} and record_soort = 'organisatie' and soort = 'logo'`)).rows as any[]
    return r ?? null
  })
  if (!b?.inhoud) throw createError({ statusCode: 404, statusMessage: 'Geen logo' })
  setResponseHeader(event, 'content-type', b.mime)
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  setResponseHeader(event, 'cache-control', 'private, max-age=86400')
  return b.inhoud as Buffer
})
