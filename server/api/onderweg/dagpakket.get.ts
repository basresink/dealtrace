// GET /api/onderweg/dagpakket?datum=&extra=: alles voor een dag offline (8.8) in één antwoord met
// versie; 304 als de telefoon die versie al heeft (If-None-Match). `extra`: accounts die de gebruiker
// met "Bewaar voor offline" toevoegde.
import { sql } from 'drizzle-orm'
import { nlMoment } from '../../../shared/datum'
import { metOrganisatie } from '../../utils/db'
import { dagpakket } from '../../utils/onderweg'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'onderweg.dagpakket')
  const q = getQuery(event)
  const datum = typeof q.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.datum) ? q.datum : nlMoment(new Date()).datum
  const extra = typeof q.extra === 'string' ? q.extra.split(',').filter(Boolean).slice(0, 50) : []
  const p = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [g] = (await tx.execute(sql`select id, name, werkplek, data from users where id = ${ctx.gebruiker.id}`)).rows as any[]
    return dagpakket(tx, ctx.organisatie.id, { id: g.id, naam: g.name, werkplek: g.werkplek, data: g.data ?? {}, niveau: ctx.gebruiker.niveau as any }, ctx, datum, extra)
  })
  setHeader(event, 'etag', `"${p.versie}"`)
  setHeader(event, 'cache-control', 'private, no-cache')
  if (getHeader(event, 'if-none-match') === `"${p.versie}"`) { setResponseStatus(event, 304); return null }
  return p
})
