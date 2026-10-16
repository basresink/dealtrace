// POST /api/roadmap/:id/stem: stemmen of je stem intrekken, alleen op wensen van de eigen organisatie (RLS). Iedereen.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'roadmap')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [w] = (await tx.execute(sql`select id from feature_requests where id = ${id}`)).rows
    if (!w) throw createError({ statusCode: 404, statusMessage: 'Wens niet gevonden' })
    const weg = (await tx.execute(sql`delete from roadmap_stemmen where wens_id = ${id} and gebruiker_id = ${ctx.gebruiker.id} returning wens_id`)).rows.length
    if (!weg) await tx.execute(sql`insert into roadmap_stemmen (organisation_id, wens_id, gebruiker_id) values (${ctx.organisatie.id}, ${id}, ${ctx.gebruiker.id})`)
    return { gestemd: !weg }
  })
})
