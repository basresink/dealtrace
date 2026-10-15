// Build op Netlify: eerst de database bijwerken, dan de app bouwen.
// - Migraties zijn idempotent en draaien bij elke deploy.
// - De fictieve testdata komt er alleen in als de database nog leeg is, zodat
//   wat je online wijzigt bij een volgende deploy blijft staan.
import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { migreer } from '../../server/db/migreer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seed } from '../../server/db/seed'
import { seedAccounts } from '../../server/db/seedAccounts'
import { seedReis } from '../../server/db/seedReis'
import { normaliseerUrl, verbindingsopties } from '../../shared/verbinding'

const beheer = process.env.DATABASE_URL_BEHEER
if (!beheer) {
  console.error('DATABASE_URL_BEHEER ontbreekt. Zet hem bij Netlify onder Environment variables.')
  process.exit(1)
}
if (!process.env.DATABASE_APP_WACHTWOORD || process.env.DATABASE_APP_WACHTWOORD === 'dealtrace_app') {
  console.error('Zet DATABASE_APP_WACHTWOORD bij Netlify op een eigen, sterk wachtwoord.')
  process.exit(1)
}

// Controleer beide regels vooraf, met een duidelijke melding zonder wachtwoord.
try {
  normaliseerUrl(beheer, 'DATABASE_URL_BEHEER')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ontbreekt. Zet hem bij Netlify onder Environment variables.')
  normaliseerUrl(process.env.DATABASE_URL, 'DATABASE_URL')
} catch (e) {
  console.error(`\n${(e as Error).message}\n`)
  process.exit(1)
}

await migreer(beheer)
const c = new pg.Client(verbindingsopties(beheer))
await c.connect()
const { rows } = await c.query(`select count(*)::int as n from organisations where id = 'org-voltvast'`)
await c.end()
if (rows[0].n === 0) await seed(beheer)
else {
  // Latere prompts voegen testdata toe; vul aan waar die nog ontbreekt.
  const c2 = new pg.Client(verbindingsopties(beheer))
  await c2.connect()
  const { rows: acc } = await c2.query(`select count(*)::int as n from accounts where organisation_id = 'org-voltvast'`)
  if (acc[0].n === 0) {
    const bron = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/voltvast.json'), 'utf8'))
    await c2.query('begin')
    const r = await seedAccounts(c2, { id: 'org-voltvast' }, bron)
    await c2.query('commit')
    console.log(`Testdata aangevuld: ${r.accounts} accounts en ${r.contacten} contacten.`)
  } else console.log('Testdata staat er al; seed overgeslagen.')
  // P05: verkoopverhaal, afkoeling en fases aanvullen (idempotent).
  await seedReis(c2, 'org-voltvast', JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/voltvast.json'), 'utf8')))
  await c2.end()
}

const r = spawnSync('pnpm', ['exec', 'nuxt', 'build'], { stdio: 'inherit', env: process.env })
process.exit(r.status ?? 1)
