// GET /api/instellingen/bel-me-niet?zoek=&formaat=csv (beheerder): de bel-me-niet-lijst, nieuwste eerst;
// met formaat=csv als export.
import { sql } from 'drizzle-orm'
import { schrijfCsv } from '../../../../shared/csv'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.kanalen')
  const q = getQuery(event)
  const zoek = typeof q.zoek === 'string' ? q.zoek.replace(/\D/g, '') : ''
  const rows = await metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.execute(sql`select b.telefoon_e164 as nummer, b.reden, b.op, coalesce(u.name, b.door) as door from bel_me_niet b left join users u on u.id = b.door
    ${zoek ? sql`where regexp_replace(b.telefoon_e164, '\D', '', 'g') like ${`%${zoek.replace(/^0/, '')}%`}` : sql``} order by b.op desc limit 1000`)).rows as any[])
  const lijst = rows.map((r) => ({ nummer: r.nummer, reden: r.reden ?? null, door: r.door ?? null, op: r.op instanceof Date ? r.op.toISOString() : String(r.op) }))
  if (q.formaat === 'csv') {
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(event, 'content-disposition', 'attachment; filename="bel-me-niet.csv"')
    return schrijfCsv([['Nummer', 'Reden', 'Door', 'Datum'], ...lijst.map((x) => [x.nummer, x.reden ?? '', x.door ?? '', x.op.slice(0, 10)])])
  }
  return lijst
})
