// De auditlijst voor /audit (salesmanager: handelingen van en op zijn teams) en /instellingen/audit
// (beheerder: alles, ook wat de leverancier deed). Filters op wie, soort en periode; paging met een
// cursor (`voor`, tijdstip en id van de laatste regel) en CSV met dezelfde filters.
import type { H3Event } from 'h3'
import { sql } from 'drizzle-orm'
import { AUDIT_CSV_MAX, AUDIT_PAGINA, AUDIT_SOORTEN, auditCsv, auditCursor, leesCursor, type AuditRegel } from '../../shared/audit'
import { gebruikDb, metOrganisatie } from './db'
import type { Context } from './sessie'
import { ledenVan, zichtbareTeams } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
const DATUM = /^\d{4}-\d{2}-\d{2}$/

export interface AuditFilters { persoon?: string; soort?: string; van?: string; tot?: string; voor?: string; leverancier?: boolean }

export function leesAuditFilters(event: H3Event): AuditFilters & { csv: boolean } {
  const q = getQuery(event) as Record<string, string | undefined>
  return {
    persoon: q.persoon || undefined,
    soort: q.soort && AUDIT_SOORTEN[q.soort] ? q.soort : undefined,
    van: q.van && DATUM.test(q.van) ? q.van : undefined,
    tot: q.tot && DATUM.test(q.tot) ? q.tot : undefined,
    voor: q.voor || undefined,
    leverancier: q.leverancier === '1',
    csv: q.formaat === 'csv',
  }
}

/** Wie de kijker mag zien: null is iedereen (beheerder), anders de leden van zijn teams en hijzelf. */
async function scopeVan(tx: Tx, ctx: Context): Promise<string[] | null> {
  if (ctx.gebruiker.rol === 'beheerder') return null
  const teams = await zichtbareTeams(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol })
  return [...(await ledenVan(tx, teams.map((t) => t.id))).map((l) => l.id as string), ctx.gebruiker.id]
}

export async function leesAudit(tx: Tx, ctx: Context, f: AuditFilters, limiet = AUDIT_PAGINA) {
  const leden = await scopeVan(tx, ctx)
  const lijst = leden?.join(',') ?? ''
  const patronen = f.leverancier ? AUDIT_SOORTEN.leverancier! : f.soort ? AUDIT_SOORTEN[f.soort]! : null
  const cursor = leesCursor(f.voor)
  const rows = (await tx.execute(sql`select e.id, e.occurred_at, e.action, e.resource_type, e.resource_id, e.metadata, e.actor_id, u.name as door
    from audit_events e left join users u on u.id = e.actor_id
    where true
    ${leden ? sql`and (e.actor_id = any(string_to_array(${lijst}, ',')) or (e.resource_type = 'accounts' and e.resource_id in (select id from accounts where owner_id = any(string_to_array(${lijst}, ',')))) or (e.resource_type = 'users' and e.resource_id = any(string_to_array(${lijst}, ','))))` : sql``}
    ${f.persoon ? sql`and e.actor_id = ${f.persoon}` : sql``}
    ${patronen ? sql`and (${sql.join(patronen.map((p) => sql`e.action like ${p}`), sql` or `)})` : sql``}
    ${f.van ? sql`and e.occurred_at >= (${f.van}::date at time zone 'Europe/Amsterdam')` : sql``}
    ${f.tot ? sql`and e.occurred_at < ((${f.tot}::date + 1) at time zone 'Europe/Amsterdam')` : sql``}
    ${cursor ? sql`and (e.occurred_at, e.id) < (${cursor.op}::timestamptz, ${cursor.id})` : sql``}
    order by e.occurred_at desc, e.id desc limit ${limiet + 1}`)).rows as any[]
  const meer = rows.length > limiet
  const regels: AuditRegel[] = rows.slice(0, limiet).map((r) => ({
    id: r.id, op: new Date(r.occurred_at).toISOString(), actie: r.action, object: r.resource_type ?? null, objectId: r.resource_id ?? null,
    door: String(r.door ?? r.metadata?.door ?? r.actor_id ?? '').replace(/^Testgebruiker /, ''), doorId: r.actor_id ?? null,
    leverancier: String(r.action).startsWith('leverancier.'), reden: r.metadata?.reden ?? null,
  }))
  return { regels, volgende: meer && regels.length ? auditCursor(regels[regels.length - 1]!) : null }
}

/** De personen voor het filter Wie: wie de kijker mag zien, op naam. */
export async function auditPersonen(tx: Tx, ctx: Context) {
  const leden = await scopeVan(tx, ctx)
  const rows = (await tx.execute(sql`select id, name from users where role <> 'founder' ${leden ? sql`and id = any(string_to_array(${leden.join(',')}, ','))` : sql``} order by name`)).rows as any[]
  return rows.map((r) => ({ id: r.id as string, naam: String(r.name).replace(/^Testgebruiker /, '') }))
}

/** Het antwoord voor beide endpoints: een pagina JSON of de hele selectie als CSV-download. */
export async function auditAntwoord(event: H3Event, ctx: Context & { organisatie: NonNullable<Context['organisatie']> }) {
  const f = leesAuditFilters(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (f.csv) {
      const { regels } = await leesAudit(tx, ctx, { ...f, voor: undefined }, AUDIT_CSV_MAX)
      const datum = new Date().toISOString().slice(0, 10)
      setHeader(event, 'content-type', 'text/csv; charset=utf-8')
      setHeader(event, 'content-disposition', `attachment; filename="audit-${datum}.csv"`)
      setHeader(event, 'cache-control', 'no-store')
      return auditCsv(regels)
    }
    const pagina = await leesAudit(tx, ctx, f)
    return { ...pagina, soorten: Object.keys(AUDIT_SOORTEN), personen: f.voor ? [] : await auditPersonen(tx, ctx) }
  })
}
