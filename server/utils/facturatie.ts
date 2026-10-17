// Factuurgegevens van de organisatie lezen en bewaren (org_settings.factuurgegevens), met audit.
import { sql } from 'drizzle-orm'
import { leesFactuurgegevens, valideerFactuurgegevens, type Factuurgegevens } from '../../shared/facturatie'
import { schrijfAudit } from './audit'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export async function leesFactuurInstelling(tx: Tx): Promise<Factuurgegevens | null> {
  const [r] = (await tx.execute(sql`select value from org_settings where key = 'factuurgegevens'`)).rows as any[]
  return r ? leesFactuurgegevens(r.value) : null
}

export async function bewaarFactuurgegevens(tx: Tx, org: string, actorId: string, invoer: unknown): Promise<Factuurgegevens> {
  const { waarde, fouten } = valideerFactuurgegevens(invoer)
  if (Object.keys(fouten).length) throw createError({ statusCode: 422, statusMessage: Object.values(fouten).join('; '), data: { fouten } })
  const oud = await leesFactuurInstelling(tx)
  await tx.execute(sql`insert into org_settings (organisation_id, key, value, updated_at) values (${org}, 'factuurgegevens', ${JSON.stringify(waarde)}::jsonb, now())
    on conflict (organisation_id, key) do update set value = excluded.value, updated_at = now()`)
  const gewijzigd = (Object.keys(waarde) as (keyof Factuurgegevens)[]).filter((k) => oud?.[k] !== waarde[k])
  await schrijfAudit(tx, { organisationId: org, actorId, action: 'abonnement.factuurgegevens', resourceType: 'org_settings', resourceId: 'factuurgegevens', changes: { velden: gewijzigd } })
  return waarde
}
