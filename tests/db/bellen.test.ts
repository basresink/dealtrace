// P10 op databaseniveau: startset van belscripts, RLS op scripts en sessies, versies alleen
// toevoegen, en het hele pad van plannen, vullen, gesprek en versie vastzetten op een echte database.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { bouwBellijst } from '../../shared/belblokken'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { laadBelKandidaten, laadScripts, planBlok, verwerkGesprek, vulBelblokken } = await import('../../server/utils/bellen')
const { activeer } = await import('../../server/utils/belscripts')

let app: pg.Client
let beheer: pg.Client
let pool: pg.Pool
class Terug extends Error {}
async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
async function inVoltvast<T>(werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', 'org-voltvast', true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
/** De eerstvolgende maandag tot en met donderdag, 09:00 in Nederland (de dagen van het ochtendblok). */
const morgen9 = () => { const d = new Date(Date.now() + 864e5); d.setUTCHours(7, 0, 0, 0); while (![1, 2, 3, 4].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString() }
/** Beltaken voor drie prospects van u-03 (poging 1, koud); de motor draait hier niet. */
async function beltaken(tx: any) {
  const acc = (await tx.execute(sql`select id from accounts where owner_id = 'u-03' and account_kind = 'prospect' and nb_status in ('nieuw', 'in reis') order by id limit 3`)).rows as { id: string }[]
  for (const a of acc) await tx.execute(sql`insert into tasks (organisation_id, owner_id, account_id, action_type, title, due_date, data) values ('org-voltvast', 'u-03', ${a.id}, 'bellen', 'Bellen', now(), '{"poging": {"n": 1, "van": 5}}'::jsonb)`)
  return acc.map((a) => a.id)
}

beforeAll(async () => {
  app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect()
  beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect()
  pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 })
})
afterAll(async () => { await app.end(); await beheer.end(); await pool.end() })

describe('belscripts en sessies', () => {
  it('elke klantorganisatie heeft de zes scripts van de startset, actief in versie 1 met een versierij', async () => {
    const r = await beheer.query(`select b.organisation_id, count(*)::int n, bool_and(b.status = 'actief' and b.versie = 1) actief, count(v.id)::int versies from belscripts b left join belscript_versies v on v.belscript_id = b.id and v.versie = 1 where b.startset is not null group by 1 order by 1`)
    expect(r.rows).toEqual([{ organisation_id: 'org-tweede', n: 6, actief: true, versies: 6 }, { organisation_id: 'org-voltvast', n: 6, actief: true, versies: 6 }])
  })
  it('scripts, versies en sessies van A zijn onzichtbaar voor B', async () => {
    await beheer.query(`insert into belblok_sessies (organisation_id, gebruiker_id, start_op, eind_op) values ('org-voltvast', 'u-03', now() + interval '3 days', now() + interval '3 days 1 hour')`)
    const n = await alsOrg('org-tweede', async () => (await app.query(`select (select count(*) from belscripts where organisation_id = 'org-voltvast')::int a, (select count(*) from belblok_sessies)::int b, (select count(*) from belscript_versies where organisation_id = 'org-voltvast')::int c`)).rows[0])
    expect(n).toEqual({ a: 0, b: 0, c: 0 })
    await expect(alsOrg('org-tweede', () => app.query(`insert into belscripts (organisation_id, naam, doel, data) values ('org-voltvast', 'x', 'koud', '{}')`))).rejects.toThrow(/row-level security/)
  })
  it('versies zijn alleen toevoegen; nooit twee blokken op hetzelfde moment', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`update belscript_versies set naam = 'x'`))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', async () => {
      await app.query(`insert into belblok_sessies (organisation_id, gebruiker_id, start_op, eind_op) values ('org-voltvast', 'u-03', '2030-01-07T08:00:00Z', '2030-01-07T09:00:00Z')`)
      await app.query(`insert into belblok_sessies (organisation_id, gebruiker_id, start_op, eind_op) values ('org-voltvast', 'u-03', '2030-01-07T08:00:00Z', '2030-01-07T09:30:00Z')`)
    })).rejects.toThrow(/duplicate key/)
  })
})

describe('plannen, gesprek en versies (acceptatie 2, 6, 10)', () => {
  it('een gepland blok: taken hangen via belblok_id aan het blok; wat niet past schuift', async () => {
    const r = await inVoltvast(async (tx) => {
      const u = (await tx.execute(sql`select id, werkplek, data from users where id = 'u-03'`)).rows[0]
      await beltaken(tx)
      const lijst = bouwBellijst(await laadBelKandidaten(tx, 'u-03'), new Date())
      const p = await planBlok(tx, 'org-voltvast', u, { start: morgen9(), minuten: 30, accountIds: lijst.map((k) => k.accountId) })
      const gekoppeld = (await tx.execute(sql`select count(*)::int n from tasks where belblok_id = ${p.sessieId}`)).rows[0].n
      return { p, gekoppeld, totaal: lijst.length }
    })
    expect(r.p.inBlok).toBeGreaterThan(0)
    expect(r.gekoppeld).toBe(r.p.inBlok)
    expect(r.p.inBlok + r.p.geschoven + r.p.inLijst).toBe(r.totaal)
  })
  it('een uitkomst in de belmodus geeft dezelfde vervolgpoging en logt script en versie', async () => {
    const r = await inVoltvast(async (tx) => {
      const u = (await tx.execute(sql`select id, werkplek, data from users where id = 'u-03'`)).rows[0]
      await beltaken(tx)
      const k = bouwBellijst(await laadBelKandidaten(tx, 'u-03'), new Date()).find((x) => x.taskId && x.poging)!
      const p = await planBlok(tx, 'org-voltvast', u, { start: morgen9(), minuten: 60, accountIds: [k.accountId] })
      const script = (await laadScripts(tx))[0]!
      const g = await verwerkGesprek(tx, 'u-03', { taskId: k.taskId!, knop: 'geen_gehoor', duurSec: 40, sleutel: 's1', script: { scriptId: script.id, versie: script.versie, gekozenDoor: 'voorstel', bezwaren: [{ id: 'bz', bezwaar: 'Online is het goedkoper.', argumentRef: 'cc-02' }] } }, p.sessieId)
      const act = (await tx.execute(sql`select data->'script'->>'scriptId' as s, (data->'script'->>'versie')::int as v, uitkomst from activiteiten where task_id = ${k.taskId}`)).rows[0]
      const lev = (await tx.execute(sql`select huidige_leverancier_id from accounts where id = ${k.accountId}`)).rows[0].huidige_leverancier_id
      const nogmaals = await verwerkGesprek(tx, 'u-03', { taskId: k.taskId!, knop: 'geen_gehoor', sleutel: 's1' }, p.sessieId)
      return { g, act, lev, script, k, nogmaals }
    })
    expect(r.g.status).toBe('klaar')
    expect(r.act).toEqual({ s: r.script.id, v: r.script.versie, uitkomst: 'geen_reactie' })
    expect(r.lev).toBe('cc-02')
    expect(r.nogmaals.gesprekken).toBe(1)
  })
  it('een nieuwe versie tijdens een lopend blok verandert het script in dat blok niet', async () => {
    const r = await inVoltvast(async (tx) => {
      const [s] = await laadScripts(tx)
      await tx.execute(sql`update belscripts set data = jsonb_set(data, '{opmerking}', '"versie 2"'::jsonb) where id = ${s!.id}`)
      const v = await activeer(tx, s!.id, 'u-04')
      const vast = (await laadScripts(tx, { [s!.id]: 1 })).find((x) => x.id === s!.id)!
      const nieuw = (await laadScripts(tx)).find((x) => x.id === s!.id)!
      return { v, vast: vast.versie, nieuw: nieuw.versie, opm: nieuw.data.opmerking }
    })
    expect(r).toEqual({ v: expect.objectContaining({ versie: 2 }), vast: 1, nieuw: 2, opm: 'versie 2' })
  })
  it('een bel-me-niet-contact verschijnt nooit in de bellijst', async () => {
    const r = await inVoltvast(async (tx) => {
      await beltaken(tx)
      const k = bouwBellijst(await laadBelKandidaten(tx, 'u-03'), new Date()).find((x) => x.contactId)!
      await tx.execute(sql`update contacts set data = data || '{"belMeNiet": true}'::jsonb where id = ${k.contactId}`)
      return { id: k.contactId, lijst: bouwBellijst(await laadBelKandidaten(tx, 'u-03'), new Date()).map((x) => x.contactId) }
    })
    expect(r.lijst).not.toContain(r.id)
  })
  it('de vuller vult een automatisch koud blok alleen met koude kandidaten', async () => {
    const r = await inVoltvast(async (tx) => {
      await beltaken(tx)
      const nu = new Date(morgen9())
      const v = await vulBelblokken(tx, 'org-voltvast', new Date(nu.getTime() - 3600_000))
      const taken = (await tx.execute(sql`select t.data->'poging'->>'n' as n from tasks t join belblok_sessies s on s.id = t.belblok_id where s.vast_blok_id = 'vb-ochtend'`)).rows as { n: string | null }[]
      return { v, taken }
    })
    expect(r.v.blokken).toBeGreaterThan(0)
    expect(r.taken.every((t) => t.n === null || Number(t.n) <= 1)).toBe(true)
  })
})
