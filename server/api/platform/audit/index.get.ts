// GET /api/platform/audit?founder=&organisatie=&handeling=&van=&tot=: de platformaudit (alleen toevoegen),
// met actor, actieve organisatie, handeling, object, voor en na, reden, ip en tijd. Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const q = getQuery(event)
  const s = (k: string) => (typeof q[k] === 'string' && q[k] ? String(q[k]) : null)
  return alsPlatform(async (tx) => {
    const regels = (await tx.execute(sql`select a.*, u.name as actor, o.name as organisatie from platform_audit a left join users u on u.id = a.actor_id left join organisations o on o.id = a.actieve_organisatie
      where (${s('founder')}::text is null or a.actor_id = ${s('founder')}) and (${s('organisatie')}::text is null or a.actieve_organisatie = ${s('organisatie')})
        and (${s('handeling')}::text is null or a.handeling like ${`${s('handeling') ?? ''}%`}) and (${s('van')}::text is null or a.op >= ${s('van')}::date) and (${s('tot')}::text is null or a.op < (${s('tot')}::date + 1))
      order by a.op desc limit 300`)).rows as any[]
    const founders = (await tx.execute(sql`select id, name from users where role = 'founder'`)).rows as any[]
    const orgs = (await tx.execute(sql`select id, name from organisations where status <> 'systeem' order by name`)).rows as any[]
    return {
      regels: regels.map((r) => ({ id: r.id, actor: String(r.actor ?? r.actor_id).replace(/^Testfounder /, ''), organisatie: r.organisatie ?? null, handeling: r.handeling, object: r.object, voor: r.voor, na: r.na, reden: r.reden, ip: r.ip, op: new Date(r.op).toISOString() })),
      founders: founders.map((f) => ({ id: f.id, naam: f.name })), organisaties: orgs.map((o) => ({ id: o.id, naam: o.name })),
    }
  })
})
