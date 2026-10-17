// De automatische dagplanning (F3 Dagplanner) op databaseniveau, elk geval in een transactie die wordt
// teruggedraaid: plannen schrijft echte belblokken en taken met herkomst dagplanner, één keer per dag;
// herplannen na een geannuleerde of uitgelopen afspraak met "Wat schoof" en een melding; ongedaan maken
// per blok en voor de hele dag; de geplande taak op het tijdstip; de Bewaker; gedeactiveerde prospects;
// RLS op dagplanningen. Fictieve data op een vaste werkdag na vandaag.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { planMijnDag, herplanDag, dagplanningSweep } = await import('../../server/utils/agents/dagplanner')
const { maakOngedaan } = await import('../../server/utils/dagplanning')
const { zetAfspraakStatus, verplaatsAfspraak } = await import('../../server/utils/agenda')
const { laadDagstart } = await import('../../server/utils/dagritmeWeek')

const ORG = 'org-voltvast'
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

/** Een werkdag minstens twee dagen na vandaag (geen weekend), zodat de seed van vandaag niet meedoet. */
function werkdag(): string {
  let d = plusDagen(nlMoment(new Date()).datum, 2)
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = plusDagen(d, 1)
  return d
}
const DAG = werkdag()
const om = (u: number, m = 0) => nlTijdstip(DAG, u, m)
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const alle = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]

/** Een afspraak en drie belacties op DAG voor een gebruiker. */
async function fixture(tx: any, gebruiker: string, accounts: string[]) {
  const ms = await rij(tx, sql`select id from meetingsoorten where slug = 'kennismaking' limit 1`)
  await tx.execute(sql`insert into appointments (id, organisation_id, owner_id, gepland_door, account_id, meetingsoort_id, vorm, status, start_at, end_at, data)
    values (${'dp-a1-' + gebruiker}, ${ORG}, ${gebruiker}, ${gebruiker}, ${accounts[0]}, ${ms.id}, 'online', 'gepland', ${om(13).toISOString()}, ${om(14).toISOString()}, '{}'::jsonb)`)
  for (const [i, a] of accounts.entries()) {
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date) values (${`dp-t${i}-${gebruiker}`}, ${ORG}, ${gebruiker}, ${a}, 'bellen', ${`Dagplanner bel ${i}`}, 'open', 'hoog', ${om(9).toISOString()})`)
  }
}
const accountsVan = async (tx: any, gebruiker: string) => (await alle(tx, sql`select id from accounts where owner_id = ${gebruiker} and account_kind = 'prospect' and gedeactiveerd_op is null order by id limit 3`)).map((r) => r.id as string)

describe('Dagplanner: plannen', () => {
  it('schrijft belblokken met belacties en een voorbereiding met herkomst dagplanner, één keer per dag', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      const p1 = await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'automatisch')
      const p2 = await planMijnDag(tx, ORG, 'u-03', om(7, 45), 'automatisch')
      const dp = await rij(tx, sql`select * from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      const sessies = await alle(tx, sql`select id, status, data from belblok_sessies where gebruiker_id = 'u-03' and data ? 'dagplanner'`)
      const gehangen = await alle(tx, sql`select id, belblok_id from tasks where id like 'dp-t%-u-03'`)
      const voorb = await alle(tx, sql`select id, title, data from tasks where owner_id = 'u-03' and data->'herkomst'->>'bron' = 'dagplanner'`)
      const melding = await rij(tx, sql`select soort, titel, link from notificaties where gebruiker_id = 'u-03' and data->>'bron' = 'dagplanner' order by op desc limit 1`)
      const run = await rij(tx, sql`select count(*)::int as n from agent_runs where agent = 'planner' and handeling = 'dagplanning' and gebruiker_id = 'u-03' and uitkomst = 'uitgevoerd'`)
      return { p1, p2, dp, sessies, gehangen, voorb, melding, run }
    })
    expect(r.p1.status).toBe('gepland')
    expect(r.p2.status).toBe('al-gepland')
    expect(r.dp).toMatchObject({ status: 'gepland', modus: 'binnen' })
    expect(r.sessies.length).toBeGreaterThan(0)
    expect(r.gehangen.every((t: any) => r.sessies.some((s: any) => s.id === t.belblok_id))).toBe(true)
    expect(r.voorb.some((t: any) => t.title.startsWith('Voorbereiding'))).toBe(true)
    expect(r.dp.data.items.some((i: any) => i.soort === 'lunch')).toBe(true)
    expect(r.melding).toMatchObject({ soort: 'dagstart', titel: 'Je dag staat klaar', link: '/dagstart' })
    expect(r.run.n).toBe(1)
  })

  it('een gedeactiveerde prospect komt niet in een belblok', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const acc = await accountsVan(tx, 'u-03')
      await fixture(tx, 'u-03', acc)
      await tx.execute(sql`update accounts set gedeactiveerd_op = now() where id = ${acc[1]}`)
      await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'handmatig')
      return rij(tx, sql`select belblok_id from tasks where id = 'dp-t1-u-03'`)
    })
    expect(r.belblok_id).toBeNull()
  })

  it('de Bewaker: met mandaat C voor de Planner blijft het bij een voorstel', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ORG}, 'agentmandaten', ${JSON.stringify({ planner: { mandaat: 'C' } })}::jsonb)
        on conflict (organisation_id, key) do update set value = excluded.value`)
      const p = await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'automatisch')
      const dp = await rij(tx, sql`select status from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      const sessies = await rij(tx, sql`select count(*)::int as n from belblok_sessies where gebruiker_id = 'u-03' and data ? 'dagplanner'`)
      return { p, dp, sessies }
    })
    expect(r.p.status).toBe('voorstel')
    expect(r.dp.status).toBe('voorstel')
    expect(r.sessies.n).toBe(0)
  })
})

describe('Dagplanner: herplannen en ongedaan maken', () => {
  it('een geannuleerde afspraak: de dag wordt opnieuw ingedeeld, met Wat schoof en een melding', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'automatisch')
      await zetAfspraakStatus(tx, ORG, 'dp-a1-u-03', 'u-03', 'geannuleerd', om(9, 0))
      const dp = await rij(tx, sql`select * from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      const melding = await rij(tx, sql`select titel, tekst from notificaties where gebruiker_id = 'u-03' and titel = 'Je dag is opnieuw ingedeeld' limit 1`)
      const voorb = await rij(tx, sql`select status from tasks where owner_id = 'u-03' and data->'herkomst'->>'bron' = 'dagplanner' and title like 'Voorbereiding%'`)
      const d = await laadDagstart(tx, 'u-03', om(9, 1), { org: ORG, dag: DAG })
      return { dp, melding, voorb, d }
    })
    const regels = r.dp.data.wijzigingen.flatMap((w: any) => w.regels)
    expect(r.dp.herpland_op).not.toBeNull()
    expect(regels.some((x: string) => x.endsWith('is geannuleerd.'))).toBe(true)
    expect(regels.some((x: string) => x.includes('vervalt'))).toBe(true)
    expect(r.voorb.status).toBe('geannuleerd')
    expect(r.melding.tekst).toContain('is geannuleerd.')
    expect(r.d.titel).toBe('Je dag is opnieuw ingedeeld.')
    expect(r.d.schoof.length).toBeGreaterThan(0)
  })

  it('een uitlopende afspraak schuift wat erna kwam; ongedaan per blok zet de belacties terug', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'automatisch')
      await verplaatsAfspraak(tx, ORG, 'dp-a1-u-03', 'u-03', { start: om(13).toISOString(), duurMin: 180 }, om(13, 30))
      const na = await rij(tx, sql`select data from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      const bel = (na.data.items as any[]).find((i) => i.soort === 'belblok' && i.status === 'actief' && Date.parse(i.start) > om(13, 30).getTime())
      const ongedaan = bel ? await maakOngedaan(tx, ORG, 'u-03', bel.sleutel, om(13, 31)) : null
      const sessie = bel ? await rij(tx, sql`select status from belblok_sessies where id = ${bel.sessieId}`) : null
      const vrij = bel ? await rij(tx, sql`select count(*)::int as n from tasks where belblok_id = ${bel.sessieId}`) : null
      const heel = await maakOngedaan(tx, ORG, 'u-03', null, om(13, 32))
      const dp = await rij(tx, sql`select status from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      const opnieuw = await planMijnDag(tx, ORG, 'u-03', om(13, 40), 'automatisch')
      return { na, bel, ongedaan, sessie, vrij, heel, dp, opnieuw }
    })
    const regels = r.na.data.wijzigingen.flatMap((w: any) => w.regels)
    expect(regels.some((x: string) => x.includes('loopt uit tot 16:00'))).toBe(true)
    if (r.bel) {
      expect(r.ongedaan!.ongedaan).toBe(1)
      expect(r.sessie.status).toBe('geannuleerd')
      expect(r.vrij.n).toBe(0)
    }
    expect(r.heel.dag).toBe(true)
    expect(r.dp.status).toBe('ongedaan')
    expect(r.opnieuw.status).toBe('al-gepland')
  })

  it('herplannen zonder wijziging laat alles staan', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'automatisch')
      const voor = await rij(tx, sql`select data from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      const h = await herplanDag(tx, ORG, 'u-03', om(7, 35), 'agenda')
      const na = await rij(tx, sql`select data, herpland_op from dagplanningen where gebruiker_id = 'u-03' and datum = ${DAG}`)
      return { voor, h, na }
    })
    expect(r.h!.regels).toEqual([])
    expect(r.na.herpland_op).toBeNull()
    expect(r.na.data.items.map((i: any) => i.start)).toEqual(r.voor.data.items.map((i: any) => i.start))
  })
})

describe('Dagplanner: geplande taak en RLS', () => {
  it('plant op het tijdstip na de stille uren, één keer per dag', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      await tx.execute(sql`insert into persoonlijke_instellingen (id, organisation_id, data) values ('u-03', ${ORG}, ${JSON.stringify({ dagplanning: { automatisch: true, tijd: '07:15' } })}::jsonb)
        on conflict (id) do update set data = persoonlijke_instellingen.data || excluded.data`)
      const mag = () => true
      const voor = await dagplanningSweep(tx, ORG, om(7, 0), mag)
      const op = await dagplanningSweep(tx, ORG, om(7, 15), mag)
      const nogmaals = await dagplanningSweep(tx, ORG, om(7, 30), mag)
      const uit = await dagplanningSweep(tx, ORG, om(7, 45), () => false)
      return { voor, op, nogmaals, uit }
    })
    expect(r.voor.gepland).toBe(0)
    expect(r.op.gepland).toBe(1)
    expect(r.nogmaals.gepland).toBe(0)
    expect(r.uit.overgeslagen).toBeGreaterThan(0)
  })

  it('RLS: een andere organisatie ziet de dagplanning niet en FORCE staat aan', async () => {
    const n = await inOrg(ORG, async (tx) => {
      await fixture(tx, 'u-03', await accountsVan(tx, 'u-03'))
      await planMijnDag(tx, ORG, 'u-03', om(7, 30), 'automatisch')
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      return rij(tx, sql`select count(*)::int as n from dagplanningen`)
    })
    expect(n.n).toBe(0)
    const c = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL })
    await c.connect()
    const f = await c.query(`select relforcerowsecurity from pg_class where relname = 'dagplanningen'`)
    await c.end()
    expect(f.rows[0].relforcerowsecurity).toBe(true)
  })
})
