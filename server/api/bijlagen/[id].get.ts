// GET /api/bijlagen/:id: de bijlage zelf, voor wie in de organisatie zit.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id')!
  const [b] = await metOrganisatie(ctx.organisatie!.id, async (tx) => (await tx.execute(sql`select mime, inhoud from bijlagen where id = ${id}`)).rows as any[])
  if (!b?.inhoud) throw createError({ statusCode: 404, statusMessage: 'Bijlage niet gevonden' })
  setHeader(event, 'content-type', b.mime)
  setHeader(event, 'cache-control', 'private, max-age=86400')
  return b.inhoud as Buffer
})
