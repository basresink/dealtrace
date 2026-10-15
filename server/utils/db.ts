// Databaseverbinding van de app als dealtrace_app (valt onder RLS, bouwplan 10.1).
//
// Elke query die organisatiedata raakt, loopt via metOrganisatie(): één transactie
// waarin app.organisation_id op de organisatie uit de sessie staat. De organisatie
// komt nooit uit de payload.

import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema'

export type Db = NodePgDatabase<typeof schema>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

let pool: pg.Pool | undefined
let db: Db | undefined

export function gebruikDb(): Db {
  if (!db) {
    const url = useRuntimeConfig().databaseUrl as string
    pool = new pg.Pool({ connectionString: url, max: 10 })
    db = drizzle(pool, { schema })
  }
  return db
}

/** Voer werk uit binnen één transactie met de organisatie gezet voor RLS. */
export async function metOrganisatie<T>(organisationId: string, werk: (tx: Tx) => Promise<T>): Promise<T> {
  return gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${organisationId}, true)`)
    return werk(tx)
  })
}

export { schema }
