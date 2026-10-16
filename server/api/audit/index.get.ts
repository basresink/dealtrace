// GET /api/audit?persoon=&soort=&van=&tot=: wie veranderde wat (P21). Salesmanager: handelingen van en op de
// eigen teams; beheerder alles. Filters op persoon, soort en periode.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { ledenVan, zichtbareTeams } from '../../utils/team'

const AUDIT_SOORTEN: Record<string, string[]> = {
  fase: ['reis.%', 'account.fase%'], eigenaar: ['account.eigenaar'], niveau: ['gebruiker.niveau%', 'gebruikers.niveau%'], regels: ['regel%'], scripts: ['belscript%'], reizen: ['reis%'],
  verwijderingen: ['%verwijder%', '%.archiveer%'], leverancier: ['leverancier.%'],
}
export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.audit')
  const q = getQuery(event) as Record<string, string | undefined>
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const beheer = ctx.gebruiker.rol === 'beheerder'
    const leden = beheer ? null : [...(await ledenVan(tx, (await zichtbareTeams(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol })).map((t) => t.id))).map((l) => l.id as string), ctx.gebruiker.id]
    const patronen = q.soort && AUDIT_SOORTEN[q.soort] ? AUDIT_SOORTEN[q.soort]! : null
    const rows = (await tx.execute(sql`select e.id, e.occurred_at, e.action, e.resource_type, e.resource_id, e.changes, e.metadata, e.actor_id, u.name as door from audit_events e left join users u on u.id = e.actor_id
      where true ${leden ? sql`and (e.actor_id = any(string_to_array(${leden.join(',')}, ',')) or (e.resource_type = 'accounts' and e.resource_id in (select id from accounts where owner_id = any(string_to_array(${leden.join(',')}, ',')))) or (e.resource_type = 'users' and e.resource_id = any(string_to_array(${leden.join(',')}, ','))))` : sql``}
      ${q.persoon ? sql`and e.actor_id = ${q.persoon}` : sql``}
      ${patronen ? sql`and (${sql.join(patronen.map((p) => sql`e.action like ${p}`), sql` or `)})` : sql``}
      ${q.van ? sql`and e.occurred_at >= ${q.van}` : sql``} ${q.tot ? sql`and e.occurred_at < (${q.tot}::date + 1)` : sql``}
      order by e.occurred_at desc limit 300`)).rows as any[]
    return { soorten: Object.keys(AUDIT_SOORTEN), regels: rows.map((r) => ({ id: r.id, op: new Date(r.occurred_at).toISOString(), actie: r.action, object: r.resource_type, objectId: r.resource_id, wijziging: r.changes, reden: r.metadata?.reden ?? null, door: String(r.door ?? r.actor_id ?? '').replace(/^Testgebruiker /, ''), doorId: r.actor_id })) }
  })
})
