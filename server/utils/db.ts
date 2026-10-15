// Databaseverbinding van de app als dealtrace_app (valt onder RLS, bouwplan 10.1).
//
// Elke query die organisatiedata raakt, loopt via metOrganisatie(): één transactie
// waarin app.organisation_id op de organisatie uit de sessie staat. De organisatie
// komt nooit uit de payload.

import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema'
import { isLokaleUrl, verbindingsopties } from '../../shared/verbinding'

export type Db = NodePgDatabase<typeof schema>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

let pool: pg.Pool | undefined
let db: Db | undefined

export function gebruikDb(): Db {
  if (!db) {
    const url = useRuntimeConfig().databaseUrl as string
    // Online (Netlify) draait elke functie kort: weinig verbindingen per functie,
    // via de pooler van Supabase.
    pool = new pg.Pool({ ...verbindingsopties(url), max: isLokaleUrl(url) ? 10 : 2, idleTimeoutMillis: 10_000 })
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
