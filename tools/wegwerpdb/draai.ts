// Databasetests op een wegwerpdatabase: maakt naast je ontwikkeldatabase een lege
// database dealtrace_test_<nummer>, migreert en seedt die, draait tests/db en ruimt
// hem daarna op. Je eigen ontwikkeldata blijft onaangeroerd.
import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { migreer } from '../../server/db/migreer'
import { seed } from '../../server/db/seed'
import { APP_URL, BEHEER_URL, isLokaal } from '../../server/db/omgeving'

function metDatabase(url: string, naam: string) {
  const u = new URL(url)
  u.pathname = `/${naam}`
  return u.toString()
}

if (!isLokaal(BEHEER_URL)) {
  console.error('test:db draait alleen tegen een lokale database.')
  process.exit(1)
}
const naam = `dealtrace_test_${process.pid}`
const beheer = new pg.Client({ connectionString: BEHEER_URL })
await beheer.connect()
await beheer.query(`create database ${naam}`)
let code = 1
try {
  const testBeheer = metDatabase(BEHEER_URL, naam)
  await migreer(testBeheer, { stil: true })
  await seed(testBeheer, { stil: true })
  const r = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    stdio: 'inherit',
    env: { ...process.env, TEST_BEHEER_URL: testBeheer, TEST_APP_URL: metDatabase(APP_URL, naam) },
  })
  code = r.status ?? 1
} finally {
  await beheer.query(`drop database if exists ${naam} with (force)`)
  await beheer.end()
}
process.exit(code)
