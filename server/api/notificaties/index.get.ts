// GET /api/notificaties?soort=&ongelezen=1: eigen meldingen, nieuwste eerst, zonder verborgen. Tijdens een
// belblok met "meldingen stil" of de rijmodus blijven nieuwe meldingen vastgehouden tot het einde (gat 37,
// P26); daarna komen ze gebundeld. Een soort die in de app uit staat, verschijnt hier niet.
import { sql } from 'drizzle-orm'
import { kanalenVoor, MELDING_SOORTEN } from '../../../shared/kanalen'
import { metOrganisatie } from '../../utils/db'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  // Meldingen zijn van de gebruiker zelf: altijd in de eigen organisatie, ook als
  // de founder in een andere organisatie werkt.
  const { gebruiker } = await vereisSessie(event)
  const org = gebruiker.organisationId!
  const q = getQuery(event)
  const data = (gebruiker.data ?? {}) as any
  const stil = data.stil as { vanaf: string; tot: string } | undefined
  const vanaf = data.rijmodus?.aan ? data.rijmodus.sinds : stil && Date.parse(stil.tot) > Date.now() ? stil.vanaf : null
  const soort = typeof q.soort === 'string' && (MELDING_SOORTEN as readonly string[]).includes(q.soort) ? q.soort : null
  return metOrganisatie(org, async (tx) => {
    const [p] = (await tx.execute(sql`select data from persoonlijke_instellingen where id = ${gebruiker.id}`)).rows as any[]
    const uit = MELDING_SOORTEN.filter((s) => !kanalenVoor(s, p?.data?.kanalen, p?.data?.meldingen).inApp)
    const rows = (await tx.execute(sql`select id, soort, titel, tekst, link, gelezen_op, op from notificaties
      where gebruiker_id = ${gebruiker.id} and verborgen_op is null
        ${vanaf ? sql`and op < ${vanaf}` : sql``} ${soort ? sql`and soort = ${soort}` : sql``} ${q.ongelezen === '1' ? sql`and gelezen_op is null` : sql``}
        ${uit.length ? sql`and soort <> all(string_to_array(${uit.join(',')}, ','))` : sql``}
      order by op desc limit 100`)).rows as any[]
    const iso = (v: any) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))
    return rows.map((r) => ({ id: r.id, soort: r.soort, titel: r.titel, tekst: r.tekst, link: r.link, gelezenOp: iso(r.gelezen_op), op: iso(r.op) }))
  })
})
