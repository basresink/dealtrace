// GET /api/briefing/overzicht?dagen=7&soort=: briefings van je komende afspraken en open taken, ook
// achterstallige (gat 34), met de soort die elke ingang ook kiest (Gevorderd).
import { sql } from 'drizzle-orm'
import { briefing } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'briefing.bewerken')
  const q = getQuery(event)
  const dagen = Math.min(30, Math.max(1, Number(q.dagen) || 7))
  const tot = new Date(Date.now() + dagen * 864e5).toISOString()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const afs = (await tx.execute(sql`select id from appointments where owner_id = ${ctx.gebruiker.id} and status = 'gepland' and account_id is not null and start_at <= ${tot} and start_at >= now() - interval '1 day' order by start_at limit 20`)).rows as any[]
    const taken = (await tx.execute(sql`select id from tasks where owner_id = ${ctx.gebruiker.id} and status in ('open', 'bezig') and account_id is not null and (due_date is null or due_date <= ${tot}) order by due_date nulls last limit 20`)).rows as any[]
    const uit = []
    for (const a of afs) uit.push({ onderwerp: 'afspraak', id: a.id, ...(await briefing(tx, { soort: 'afspraak', id: a.id })) })
    for (const t of taken) uit.push({ onderwerp: 'taak', id: t.id, ...(await briefing(tx, { soort: 'taak', id: t.id })) })
    const soort = typeof q.soort === 'string' && q.soort ? q.soort : null
    return { briefings: uit.filter((b) => !soort || b.soort === soort).sort((a, b) => String(a.wanneer ?? '9').localeCompare(String(b.wanneer ?? '9'))).map(({ blokken, ...b }) => b) }
  })
})
