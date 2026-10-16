// Volgen (F2 en F7) op databaseniveau: startsjablonen per organisatie, een reeks starten (stappen, dag 0 met taak
// en concept van de Schrijver, het ritme staat stil), één lopende reeks per account, een reactie stopt de reeks met
// een taak "bel terug", een geplande afspraak stopt hem bij de volgende run, handmatig stoppen zet het ritme terug,
// de volgende beste stap uit de database, Niet nu, en RLS (FORCE) op de vier nieuwe tabellen. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const r = await import('../../server/utils/opvolgreeks')
const v = await import('../../server/utils/volgen')

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
const ACC = 'pr-g16'
const anouk = { id: 'u-01', rol: 'accountmanager', niveau: 'gevorderd', werkplek: 'binnendienst', data: {} }
const collega = { id: 'u-02', rol: 'accountmanager', niveau: 'beginner', werkplek: 'binnendienst', data: {} }
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const sjabloon = async (tx: any, sleutel: string) => (await r.sjablonen(tx, ORG)).find((s) => s.sleutel === sleutel)!.id

describe('opvolgreeksen', () => {
  it('startsjablonen: Na informatie, Na voicemail en Na eerste gesprek', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await r.sjablonen(tx, ORG)).map((s) => s.naam)).toEqual(['Na informatie', 'Na voicemail', 'Na eerste gesprek'])
      expect(await r.zorgVoorSjablonen(tx, ORG)).toBe(0)
    })
  })

  it('starten: stappen, dag 0 met taak en concept, het ritme staat stil, één reeks per account', async () => {
    await inOrg(ORG, async (tx) => {
      const ritmeVoor = (await rij(tx, sql`select data->'reis'->'ritme' as r from accounts where id = ${ACC}`)).r
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie'), mandaat: 'C' }, 'http://localhost:3000'))!
      expect(reeks).toMatchObject({ naam: 'Na informatie', status: 'loopt', mandaat: 'C', ownerId: 'u-01' })
      expect(reeks.stappen.map((s) => s.kanaal)).toEqual(['mail', 'linkedin', 'bellen', 'mail', 'einde'])
      const eerste = reeks.stappen[0]!
      expect(eerste.status).toBe('open')
      const t = await rij(tx, sql`select action_type, status, owner_id, contact_id, data from tasks where id = ${eerste.taak!.id}`)
      expect(t).toMatchObject({ action_type: 'mailen', status: 'open', owner_id: 'u-01', contact_id: reeks.contact!.id })
      expect(t.data.herkomst.bron).toBe('reeks')
      expect(eerste.concept?.status).toBe('klaar')
      expect((await rij(tx, sql`select agent, status from concepten where id = ${eerste.concept!.id}`))).toEqual({ agent: 'schrijver', status: 'klaar' })
      if (ritmeVoor?.actief) expect((await rij(tx, sql`select (data->'reis'->'ritme'->>'actief')::boolean as a from accounts where id = ${ACC}`)).a).toBe(false)
      await expect(r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-voicemail') }, 'http://localhost:3000')).rejects.toMatchObject({ statusCode: 409 })
      // Een collega zonder recht op het account start of wijzigt niets.
      await expect(r.wijzigReeks(tx, ORG, collega, reeks.id, { actie: 'stop' })).rejects.toMatchObject({ statusCode: 403 })
      expect((await rij(tx, sql`select count(*)::int as n from audit_events where resource_id = ${reeks.id}`)).n).toBe(1)
    })
  })

  it('een reactie stopt de reeks: open stappen vallen weg en er komt een taak bel terug', async () => {
    await inOrg(ORG, async (tx) => {
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-voicemail') }, 'http://localhost:3000'))!
      const na = (await r.logReactie(tx, ORG, anouk, reeks.id, { kanaal: 'mail', notitie: 'Stuur maar een voorstel.' }))!
      expect(na).toMatchObject({ status: 'gestopt', stopreden: 'reactie' })
      expect(na.stappen.filter((s) => s.status === 'overgeslagen').length).toBe(5)
      expect((await rij(tx, sql`select status from tasks where id = ${reeks.stappen[0]!.taak!.id}`)).status).toBe('geannuleerd')
      const bel = await rij(tx, sql`select action_type, priority, status, title from tasks where id = ${na.belTerugTaakId}`)
      expect(bel).toMatchObject({ action_type: 'bellen', priority: 'hoog', status: 'open' })
      expect(bel.title).toMatch(/^Bel terug: /)
      expect((await rij(tx, sql`select count(*)::int as n from activiteiten where account_id = ${ACC} and soort = 'reactie'`)).n).toBe(1)
      // Na een stop mag er weer een reeks starten.
      expect((await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000'))!.status).toBe('loopt')
    })
  })

  it('een geplande afspraak stopt de reeks bij de volgende run; handmatig stoppen zet het ritme terug', async () => {
    await inOrg(ORG, async (tx) => {
      const ritmeVoor = (await rij(tx, sql`select data->'reis'->'ritme' as r from accounts where id = ${ACC}`)).r
      const a = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-eerste-gesprek') }, 'http://localhost:3000'))!
      await r.wijzigReeks(tx, ORG, anouk, a.id, { actie: 'stop' })
      if (ritmeVoor?.actief) expect((await rij(tx, sql`select (data->'reis'->'ritme'->>'actief')::boolean as a from accounts where id = ${ACC}`)).a).toBe(true)
      const b = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000'))!
      const soort = await rij(tx, sql`select id from meetingsoorten limit 1`)
      await tx.execute(sql`insert into appointments (organisation_id, owner_id, account_id, meetingsoort_id, vorm, status, start_at, end_at, created_at)
        values (${ORG}, 'u-01', ${ACC}, ${soort.id}, 'online', 'gepland', now() + interval '3 days', now() + interval '3 days 1 hour', now() + interval '1 second')`)
      const sweep = await r.reeksSweep(tx, ORG, new Date(Date.now() + 5000))
      expect(sweep.gestopt).toBe(1)
      expect((await rij(tx, sql`select status, stopreden from reeksen where id = ${b.id}`))).toEqual({ status: 'gestopt', stopreden: 'afspraak' })
      expect((await rij(tx, sql`select count(*)::int as n from notificaties where data->>'reeksId' = ${b.id}`)).n).toBe(1)
    })
  })

  it('volgende beste stap uit de database, Niet nu en de taak bij Doe het nu', async () => {
    await inOrg(ORG, async (tx) => {
      const u = await v.volgenVoor(tx, ORG, anouk, ACC, null)
      expect(u.stap.factoren.length).toBeGreaterThan(0)
      expect(u.stap.bewaker.tekst).toMatch(/^(Mag|Tegengehouden)/)
      expect(u.sjablonen).toHaveLength(3)
      expect(u.mandaten).toEqual(['C', 'B'])
      const k = [u.stap, ...u.alternatieven].find((x) => x.bewaker.mag && x.soort !== 'wachten')!
      const nu = await v.kiesStap(tx, ORG, anouk, ACC, { sleutel: k.sleutel, keuze: 'nu' })
      expect((await rij(tx, sql`select status, owner_id from tasks where id = ${nu.taskId}`))).toEqual({ status: 'open', owner_id: 'u-01' })
      const na = await v.volgenVoor(tx, ORG, anouk, ACC, null)
      await v.kiesStap(tx, ORG, anouk, ACC, { sleutel: na.stap.sleutel, keuze: 'niet-nu', reden: 'klopt-niet' })
      const daarna = await v.volgenVoor(tx, ORG, anouk, ACC, null)
      expect(daarna.stap.sleutel).not.toBe(na.stap.sleutel)
      await expect(v.kiesStap(tx, ORG, anouk, ACC, { sleutel: 'bestaat-niet', keuze: 'nu' })).rejects.toMatchObject({ statusCode: 409 })
      await expect(v.volgenVoor(tx, ORG, anouk, ACC, 'eva-a09-c1')).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('RLS: een andere organisatie ziet en schrijft niets', async () => {
    await inOrg(ORG, async (tx) => {
      await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000')
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      for (const t of ['reeksen', 'reeksstappen', 'volgen_keuzes']) expect((await rij(tx, sql.raw(`select count(*)::int as n from ${t} where organisation_id = '${ORG}'`))).n).toBe(0)
      expect((await rij(tx, sql`select count(*)::int as n from reekssjablonen where organisation_id = ${ORG}`)).n).toBe(0)
      const e: any = await tx.execute(sql`insert into reekssjablonen (organisation_id, sleutel, naam, stappen, einde) values (${ORG}, 'x', 'X', '[]'::jsonb, '{}'::jsonb)`).catch((x: any) => x)
      expect(String(e?.cause?.message ?? e?.message)).toMatch(/row-level security/)
    })
    const c = await pool.connect()
    try {
      const f = await c.query(`select relname from pg_class where relname in ('reekssjablonen', 'reeksen', 'reeksstappen', 'volgen_keuzes') and relforcerowsecurity`)
      expect(f.rowCount).toBe(4)
    } finally { c.release() }
  })
})
