// P14 op databaseniveau: de bezoekdag van Lieke (u-05) uit de seed, kansen uit alle open
// bezoektaken (gat 31), de bellijst naast de bezoeken (gat 30), klaarzetten (+90 en melding),
// overslaan, regio's met synoniemen, "Gat in je agenda" met kansen en RLS op de nieuwe tabellen.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { bezoekDag, klaarzetten, wijsRegiosToe, regioAnalyse } = await import('../../server/utils/bezoeken')
const { zetAfspraakStatus, planAfspraak } = await import('../../server/utils/agenda')

let pool: pg.Pool
class Terug extends Error {}
async function inOrg<T>(org: string, werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const ORG = 'org-voltvast'
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const nu = new Date()
const vandaag = nlMoment(nu).datum
const lieke = async (tx: any) => { const u = await rij(tx, sql`select id, name, werkplek, data from users where id = 'u-05'`); return { id: u.id, naam: u.name, werkplek: u.werkplek, data: u.data, niveau: 'gevorderd' as const } }
const F = { alleenMijn: true, alleenProspects: true, maxOmrij: 30, aantal: null, ongepland: false }

describe('bezoekdag', () => {
  it('de route van vandaag met drie stops, kansen uit alle open bezoektaken en de klaargezette kans (+90)', async () => {
    await inOrg(ORG, async (tx) => {
      const d = await bezoekDag(tx, await lieke(tx), vandaag, F, nu)
      expect(d.stops).toHaveLength(3)
      expect(d.punten.length).toBe(5)
      const ids = d.kansen.map((k) => k.id)
      expect(ids).toEqual(expect.arrayContaining(['pr-g29', 'pr-12', 'pr-08']))
      const kz = d.kansen.find((k) => k.id === 'pr-08')!
      expect(kz.bronnen[0]!.label).toMatch(/^Klaargezet door Sanne/)
      expect(kz.opbouw.find((o) => o.label === 'klaargezet')?.punten).toBe(90)
      expect(d.kansen.some((k) => d.stops.some((s) => s.accountId === k.id))).toBe(false)
      expect(d.schatting).toBe(true)
    })
  })
  it('gat 30: de bellijst sluit alleen de accounts van de bezoeken van die dag uit', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values ('t-bel-g39', ${ORG}, 'u-05', 'pr-g39', 'bellen', 'Bel Leidingdal', 'open', 'hoog', now(), 'mens', '{}'), ('t-bel-g34', ${ORG}, 'u-05', 'pr-g34', 'bellen', 'Bel Krachtstroom', 'open', 'hoog', now(), 'mens', '{}')`)
      const d = await bezoekDag(tx, await lieke(tx), vandaag, F, nu)
      const bel = d.bellijst.map((b: any) => b.accountId)
      expect(bel).not.toContain('pr-g39') // vandaag een bezoek
      expect(bel).toContain('pr-g34') // later in de week, dus wel
    })
  })
  it('overslaan: de kans komt 7 dagen niet terug', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into kans_overslaan (organisation_id, gebruiker_id, account_id, tot, reden) values (${ORG}, 'u-05', 'pr-12', ${plusDagen(vandaag, 7)}, 'Geen tijd')`)
      const d = await bezoekDag(tx, await lieke(tx), vandaag, F, nu)
      expect(d.kansen.map((k) => k.id)).not.toContain('pr-12')
    })
  })
  it('met de mock van de routedienst geen schattingslabel', async () => {
    process.env.ROUTEDIENST_MODUS = 'mock'
    try {
      await inOrg(ORG, async (tx) => {
        const d = await bezoekDag(tx, await lieke(tx), vandaag, F, nu)
        expect(d.kansen.every((k) => !k.schatting)).toBe(true)
      })
    } finally { delete process.env.ROUTEDIENST_MODUS }
  })
})

describe('klaarzetten', () => {
  it('voor de eerstvolgende regiodag in de regio, met melding; 400 zonder regiodag of voor de binnendienst', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await klaarzetten(tx, ORG, { id: 'u-03', naam: 'Testgebruiker Sanne Belhuis' }, 'pr-g19', { voorGebruiker: 'u-02', regioId: null, datum: null, reden: 'Belde zelf' }, nu)
      expect(r.regioId).toBe('regio-midden')
      expect(new Date(`${r.datum}T12:00:00Z`).getUTCDay()).toBe(1) // Bram is op maandag in Regio Midden
      expect((await rij(tx, sql`select titel from notificaties where gebruiker_id = 'u-02' order by op desc limit 1`)).titel).toBe('Klaargezet voor je regiodag')
      await expect(klaarzetten(tx, ORG, { id: 'u-03', naam: 'Sanne' }, 'pr-g19', { voorGebruiker: 'u-01', regioId: null, datum: null, reden: '' }, nu)).rejects.toMatchObject({ statusCode: 400 })
      await expect(klaarzetten(tx, ORG, { id: 'u-03', naam: 'Sanne' }, 'pr-g19', { voorGebruiker: 'u-07', regioId: null, datum: null, reden: '' }, nu)).rejects.toMatchObject({ statusCode: 400 })
    })
  })
})

describe('gebieden', () => {
  it('regio op postcode, anders plaats met synoniem; nieuwe prospect zonder eigenaar krijgt de eigenaar van de regio', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await rij(tx, sql`select gebied_id from accounts where id = 'pr-08'`)).gebied_id).toBe('regio-noord')
      await tx.execute(sql`update org_settings set value = jsonb_set(value, '{2,plaatsen}', (value->2->'plaatsen') || '["Den Bosch"]'::jsonb) where key = 'gebieden'`)
      await tx.execute(sql`insert into accounts (id, organisation_id, name, account_kind, city) values ('acc-bosch', ${ORG}, 'Testbedrijf Bossche Bol', 'prospect', '''s-Hertogenbosch')`)
      await wijsRegiosToe(tx)
      expect(await rij(tx, sql`select gebied_id, owner_id from accounts where id = 'acc-bosch'`)).toMatchObject({ gebied_id: 'regio-midden', owner_id: 'u-02' })
    })
  })
  it('regio-analyse met een rij Zonder regio', async () => {
    await inOrg(ORG, async (tx) => {
      const a = await regioAnalyse(tx, ['u-05'])
      expect(a.regios.at(-1)!.naam).toBe('Zonder regio')
      expect(a.cijfers.inBeeld).toBeGreaterThan(5)
    })
  })
})

describe('gat in je agenda', () => {
  it('een vervallen afspraak geeft het inzicht met de top drie kansen rond die plek', async () => {
    await inOrg(ORG, async (tx) => {
      const ms = (await rij(tx, sql`select id from meetingsoorten where slug = 'inventarisatie'`)).id
      const a = await planAfspraak(tx, ORG, { id: 'u-05', naam: 'Lieke', rol: 'accountmanager', mag: { voorCollega: false } }, { accountId: 'pr-g34', meetingsoortId: ms, start: nlTijdstip(plusDagen(vandaag, 1), 10).toISOString() }, nu)
      await zetAfspraakStatus(tx, ORG, a.id, 'u-05', 'geannuleerd', nu)
      const s = await rij(tx, sql`select data from signals where type = 'gat-in-agenda' and data->>'afspraakId' = ${a.id}`)
      expect(s.data.kansen.length).toBeGreaterThan(0)
      expect(s.data.kansen.length).toBeLessThanOrEqual(3)
      expect(s.data.waarom).toMatch(/In de buurt/)
    })
  })
})

describe('RLS en cache', () => {
  it('kans_overslaan en klaargezet_voor van Voltvast zijn onzichtbaar voor Tweede; de cache heeft geen organisatie', async () => {
    const n = await inOrg('org-tweede', async (tx) => ({ k: (await rij(tx, sql`select count(*)::int as n from klaargezet_voor`)).n, o: (await rij(tx, sql`select count(*)::int as n from kans_overslaan`)).n }))
    expect(n).toEqual({ k: 0, o: 0 })
    const kol = await inOrg(ORG, async (tx) => (await tx.execute(sql`select column_name from information_schema.columns where table_name = 'routedienst_cache'`)).rows.map((r: any) => r.column_name))
    expect(kol).not.toContain('organisation_id')
  })
})
