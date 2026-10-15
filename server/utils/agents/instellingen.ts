// Lezen en schrijven van de agentinstellingen (alleen via /api/agents). Schrijft geen
// klantdata over accounts of contacten; daarom geen toets nodig.
import { eq } from 'drizzle-orm'
import { schema } from '../db'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]

export async function zetAgentInstelling(tx: Tx, org: string, key: 'agentmandaten' | 'agentCreditsPerSoort' | 'agentenGepauzeerd', value: unknown) {
  const tijd = new Date().toISOString()
  const [oud] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, key))
  // null (bijvoorbeeld "Hervat") haalt de instelling weg.
  if (value === null) {
    await tx.delete(schema.orgSettings).where(eq(schema.orgSettings.key, key))
    return oud?.value ?? null
  }
  await tx.insert(schema.orgSettings).values({ organisationId: org, key, value: value as any, updatedAt: tijd })
    .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value: value as any, updatedAt: tijd } })
  return oud?.value ?? null
}
