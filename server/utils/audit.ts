// Auditregels (bouwplan 15.3): elke wijziging van instellingen, gebruikers,
// niveaus en teams krijgt een regel in audit_events, in dezelfde transactie.

import { schema } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export async function schrijfAudit(
  tx: Tx,
  regel: {
    organisationId: string
    actorId: string
    action: string
    resourceType: string
    resourceId?: string | null
    changes?: unknown
    metadata?: unknown
  },
) {
  await tx.insert(schema.auditEvents).values({
    id: crypto.randomUUID(),
    organisationId: regel.organisationId,
    actorId: regel.actorId,
    action: regel.action,
    resourceType: regel.resourceType,
    resourceId: regel.resourceId ?? null,
    changes: regel.changes ?? null,
    metadata: regel.metadata ?? null,
    occurredAt: new Date().toISOString(),
  })
}
