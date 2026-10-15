// GET /api/gebieden: regio's, synoniemen, de buitendienst en de week met tellingen per regio (F18).
import { sql } from 'drizzle-orm'
import { kan } from '../../utils/accounts'
import { gebiedenInstelling, geocodeerOntbrekend } from '../../utils/bezoeken'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'regio.analyse')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await geocodeerOntbrekend(tx)
    const g = await gebiedenInstelling(tx)
    const tel = (await tx.execute(sql`select gebied_id, count(*) filter (where account_kind = 'klant')::int as klanten, count(*) filter (where account_kind = 'prospect')::int as prospects,
      count(*) filter (where not exists (select 1 from activiteiten x where x.account_id = a.id and (x.kanaal = 'bezoek' or x.soort = 'bezoek')))::int as nooit,
      count(*) filter (where exists (select 1 from activiteiten x where x.account_id = a.id and (x.kanaal = 'bezoek' or x.soort = 'bezoek')) and not exists (select 1 from activiteiten x where x.account_id = a.id and (x.kanaal = 'bezoek' or x.soort = 'bezoek') and x.op > now() - interval '90 days'))::int as stil
      from accounts a group by 1`)).rows as any[]
    const gebruikers = (await tx.execute(sql`select id, name, werkplek from users where status = 'actief' and role <> 'founder' order by name`)).rows as any[]
    return { ...g, tellingen: tel, gebruikers: gebruikers.map((u) => ({ id: u.id, naam: u.name, werkplek: u.werkplek })), kan: { beheren: kan(ctx, 'instellingen.gebieden') } }
  })
})
