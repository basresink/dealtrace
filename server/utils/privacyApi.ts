// Het antwoord van GET en PUT /api/instellingen/privacy: termijnen, wat er zou vervallen, de spraakinstelling
// (die staat bij Organisatie) en de laatste export. Alleen tellen; verwijderen doet nog geen enkele job.
import { sql } from 'drizzle-orm'
import { EXPORT_ONDERDELEN } from '../../shared/privacy'
import { EXPORT_TABELLEN, leesTermijnen, vervaltOverzicht } from './privacy'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export async function privacyOverzicht(tx: Tx, org: string, nu = new Date()) {
  const t = await leesTermijnen(tx)
  const [spraak] = (await tx.execute(sql`select value from org_settings where key = 'spraak'`)).rows as any[]
  const aantallen: Record<string, number> = {}
  for (const e of EXPORT_TABELLEN) aantallen[e.bestand] = Number(((await tx.execute(e.tel(org))).rows[0] as any)?.n ?? 0)
  const [laatste] = (await tx.execute(sql`select a.occurred_at, u.name from audit_events a left join users u on u.id = a.actor_id
    where a.organisation_id = ${org} and a.action = 'organisatie.export' order by a.occurred_at desc limit 1`)).rows as any[]
  return {
    ...t,
    verval: await vervaltOverzicht(tx, org, t.termijnen, nu),
    // Er is nog geen opschoonjob: het scherm toont wat er zou vervallen, er wordt niets verwijderd.
    opschoonjob: false,
    spraak: { opnamesBewaren: !!spraak?.value?.opnamesBewaren, bewaartermijnDagen: Number(spraak?.value?.bewaartermijnDagen) || 90 },
    export: {
      onderdelen: EXPORT_ONDERDELEN.map((o) => ({ ...o, rijen: aantallen[o.bestand] ?? null })),
      laatste: laatste ? { op: new Date(laatste.occurred_at).toISOString(), door: laatste.name ?? null } : null,
    },
  }
}
