// GET /api/agenda/collegas: de actieve collega's in de organisatie om uit te nodigen voor een afspraak
// (Plan een afspraak). Alleen naam en werkplek; jezelf en de founder niet.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ((await tx.execute(sql`select id, name, werkplek from users where status = 'actief' and role <> 'founder' and id <> ${ctx.gebruiker.id} order by name`)).rows as any[])
    .map((u) => ({ id: u.id, naam: String(u.name).replace(/^Testgebruiker /, ''), werkplek: u.werkplek ?? null })))
})
