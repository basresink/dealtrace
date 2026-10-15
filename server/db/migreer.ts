// Migraties toepassen: pnpm db:migrate   (met --opnieuw: lokaal alles wissen en opnieuw)
//
// 1. Elke migratie in server/db/migrations wordt één keer toegepast (tabel schema_migraties).
// 2. rollen.sql zet de beperkte rol dealtrace_app en de rechten (idempotent).
// 3. functies_per_niveau krijgt de startindeling uit shared/functies.ts voor functies
//    die nog geen regel hebben; bestaande regels (door de founder gewijzigd) blijven staan.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { APP_WACHTWOORD, BEHEER_URL, isLokaal } from './omgeving'
import { startindeling } from '../../shared/functies'

const MAP = join(import.meta.dirname, 'migrations')

export async function migreer(url = BEHEER_URL, opties: { opnieuw?: boolean; stil?: boolean } = {}) {
  const log = (t: string) => { if (!opties.stil) console.log(t) }
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    if (opties.opnieuw) {
      if (!isLokaal(url)) throw new Error('--opnieuw mag alleen op een lokale database.')
      await client.query('drop schema public cascade; create schema public; grant all on schema public to public;')
      log('Database gewist.')
    }
    await client.query('create table if not exists schema_migraties (naam text primary key, op timestamptz not null default now())')
    const gedaan = new Set((await client.query('select naam from schema_migraties')).rows.map((r) => r.naam))
    for (const bestand of readdirSync(MAP).filter((f) => f.endsWith('.sql')).sort()) {
      if (gedaan.has(bestand)) continue
      await client.query('begin')
      try {
        await client.query(readFileSync(join(MAP, bestand), 'utf8'))
        await client.query('insert into schema_migraties (naam) values ($1)', [bestand])
        await client.query('commit')
        log(`Toegepast: ${bestand}`)
      } catch (e) {
        await client.query('rollback')
        throw e
      }
    }
    await client.query(`select set_config('dealtrace.app_wachtwoord', $1, false)`, [APP_WACHTWOORD])
    await client.query(readFileSync(join(import.meta.dirname, 'rollen.sql'), 'utf8'))
    let nieuw = 0
    for (const r of startindeling()) {
      const res = await client.query(
        `insert into functies_per_niveau (functie, niveau, aan, organisation_id, gewijzigd_door)
         values ($1, $2, $3, null, 'startindeling') on conflict do nothing`,
        [r.functie, r.niveau, r.aan],
      )
      nieuw += res.rowCount ?? 0
    }
    log(`Features per niveau: ${nieuw} nieuwe startregels.`)
  } finally {
    await client.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migreer(BEHEER_URL, { opnieuw: process.argv.includes('--opnieuw') }).catch((e) => {
    console.error('Migratie mislukt:', e.message)
    process.exit(1)
  })
}
