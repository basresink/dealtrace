// P29 op databaseniveau: de webhook (handtekening, tijdvenster, dubbel, cross-tenant), de job, de
// projectie met bron salesdna, het gat in de versies, verouderd, hernoemd en verwijderd, de taak voor
// een nieuwe branche, overstappen (archief en naammapping) en ontkoppelen. Alles tegen de mock.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const sd = await import('../../server/utils/salesdna')
const { leesStand, sublagen } = await import('../../server/utils/vvProjectie')
const { teken } = await import('../../server/utils/salesdnaWebhook')
const { versleutel } = await import('../../server/utils/geheimen')
const { MOCK_FIXTURES, mockOverrides } = await import('../../server/utils/bronnen/salesdna')

let pool: pg.Pool
class Terug extends Error {}
async function inTx<T>(werk: (tx: any, u: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    const u = {
      zoek: async (id: string) => (await tx.execute(sql`select * from dealtrace_salesdna_koppeling(${id})`)).rows[0],
      inOrg: async (org: string, w: (t: any) => Promise<any>) => { await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`); return w(tx) },
    }
    uit = await werk(tx, u)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const GEHEIM = { 'org-tweede': 'geheim-tweede-test', 'org-voltvast': 'geheim-voltvast-test' } as Record<string, string>
async function maakKoppeling(tx: any, u: any, org: string, endpoint = 'mock') {
  return u.inOrg(org, async () => {
    const [k] = (await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (${org}, 'salesdna', 'actief', ${versleutel({ geheim: GEHEIM[org]! })}, ${JSON.stringify({ endpoint })}::jsonb) returning id`)).rows
    return k.id as string
  })
}
function bericht(b: any, extra: Record<string, unknown> = {}) {
  const nu = new Date()
  const body = JSON.stringify({ ...structuredClone(b), ...extra, tijd: nu.toISOString() })
  return { body, id: JSON.parse(body).eventId as string, nu }
}
async function stuur(u: any, koppelingId: string, org: string, b: any, extra: Record<string, unknown> = {}, geheim = GEHEIM[org]!) {
  const m = bericht(b, extra)
  const r = await sd.ontvang(koppelingId, m.body, { handtekening: teken(m.body, geheim), eventId: m.id, tijd: m.nu.toISOString() }, m.nu, u)
  if (r.resultaat === 'wacht') await sd.verwerkWachtende(org, u)
  return r
}
const basis = (id: string) => MOCK_FIXTURES.basis.find((b) => b.onderwerpId === id)!

describe('webhook', () => {
  it('ongeldige handtekening of oud tijdstip: 401, geweigerd zonder payload, niets geschreven', async () => {
    const r = await inTx(async (tx, u) => {
      const k = await maakKoppeling(tx, u, 'org-tweede')
      const m = bericht(basis('L0.6'))
      const fout = await sd.ontvang(k, m.body, { handtekening: teken(m.body, 'verkeerd'), eventId: m.id, tijd: m.nu.toISOString() }, m.nu, u)
      const oud = new Date(Date.now() - 6 * 60 * 1000).toISOString()
      const telaat = await sd.ontvang(k, m.body, { handtekening: teken(m.body, GEHEIM['org-tweede']!), eventId: m.id, tijd: oud }, m.nu, u)
      const log = (await tx.execute(sql`select resultaat, payload from salesdna_events`)).rows
      const spiegel = (await tx.execute(sql`select count(*)::int n from salesdna_sublagen`)).rows[0]
      return { fout, telaat, log, spiegel }
    })
    expect(r.fout.status).toBe(401)
    expect(r.telaat.status).toBe(401)
    expect(r.log.every((l: any) => l.resultaat === 'geweigerd' && l.payload === null)).toBe(true)
    expect((r.spiegel as any).n).toBe(0)
  })

  it('cross-tenant: het geheim van Voltvast op de koppeling van org-tweede wordt geweigerd', async () => {
    const r = await inTx(async (tx, u) => {
      const k2 = await maakKoppeling(tx, u, 'org-tweede')
      await maakKoppeling(tx, u, 'org-voltvast')
      const res = await stuur(u, k2, 'org-tweede', basis('L0.6'), {}, GEHEIM['org-voltvast']!)
      await u.inOrg('org-tweede', async () => undefined)
      return { res, n: (await tx.execute(sql`select count(*)::int n from vv_branches`)).rows[0] }
    })
    expect(r.res.status).toBe(401)
    expect((r.n as any).n).toBe(0)
  })

  it('een lege organisatie krijgt het verhaal via webhooks; /richting leest hetzelfde als de eigen startset; dubbel verandert niets', async () => {
    const r = await inTx(async (tx, u) => {
      const k = await maakKoppeling(tx, u, 'org-tweede')
      for (const b of MOCK_FIXTURES.basis) await stuur(u, k, 'org-tweede', b)
      const dubbel = await stuur(u, k, 'org-tweede', basis('L0.6'))
      const anderId = await stuur(u, k, 'org-tweede', basis('L0.6'), { eventId: 'evt-ander' })
      const stand = await leesStand(tx)
      const s = await sublagen(tx)
      await u.inOrg('org-voltvast', async () => undefined)
      const eigen = await leesStand(tx)
      return { dubbel, anderId, stand, s, eigen }
    })
    expect(r.dubbel).toMatchObject({ status: 200, resultaat: 'dubbel' })
    expect(r.anderId).toMatchObject({ status: 200, resultaat: 'dubbel' })
    expect(r.s.branches).toMatchObject({ bron: 'salesdna', status: 'bevestigd', versie: 1 })
    expect(r.s.bedrijfsverhaal.versie).toBe(3)
    expect(r.s.golden_circle.bron).toBe('eigen')
    const kern = (x: any) => ({ branches: x.branches.map((b: any) => [b.id, b.naam]), teksten: x.teksten.map((t: any) => [t.id, t.tekst]).sort(), winpunten: x.winpunten.map((w: any) => [w.id, w.faseId, w.impact]), concurrenten: x.concurrenten.map((c: any) => [c.id, c.naam]), regels: x.terugkomregels.map((t: any) => [t.id, t.reden, t.termijnDagen]).sort() })
    const zonderGolden = (x: any) => ({ ...kern(x), teksten: kern(x).teksten.filter((t: any) => !t[0].startsWith('tx-L0.0')) })
    expect(zonderGolden(r.stand)).toEqual(zonderGolden(r.eigen))
  })

  it('gat in de versies start een volledige synchronisatie; oud wordt genegeerd', async () => {
    const r = await inTx(async (tx, u) => {
      const k = await maakKoppeling(tx, u, 'org-tweede')
      await stuur(u, k, 'org-tweede', basis('L0.4'))
      mockOverrides.set('L0.4', { ...MOCK_FIXTURES.los.l04v3, versie: 4 })
      try {
        await stuur(u, k, 'org-tweede', MOCK_FIXTURES.los.l04v3, { versie: 4, eventId: 'evt-gat' })
      } finally { mockOverrides.clear() }
      const oud = await stuur(u, k, 'org-tweede', basis('L0.4'), { eventId: 'evt-oud', versie: 1 })
      const log = (await tx.execute(sql`select event_id, resultaat from salesdna_events order by id`)).rows
      const run = (await tx.execute(sql`select handeling, geschreven from koppeling_runs`)).rows
      return { s: (await sublagen(tx)).waarde, stand: await leesStand(tx), log, run, oud }
    })
    expect(r.log.find((l: any) => l.event_id?.startsWith('evt-gat'))?.resultaat).toBe('synchronisatie')
    expect(r.run[0]).toMatchObject({ handeling: 'volledig:gat:L0.4', geschreven: 1 })
    expect(r.s.versie).toBe(4)
    expect(r.stand.teksten.find((t: any) => t.sleutel === 'kernbelofte' && t.brancheId === 'br-01')?.tekst).toContain('op het afgesproken uur')
    expect(r.log.find((l: any) => l.event_id?.startsWith('evt-oud'))?.resultaat).toBe('oud')
  })

  it('C.9 punten 6, 7 en 8: hernoemd, gewijzigd blok zonder verouderd, en verouderd met doorwerken', async () => {
    const r = await inTx(async (tx, u) => {
      const k = await maakKoppeling(tx, u, 'org-tweede')
      for (const b of MOCK_FIXTURES.basis) await stuur(u, k, 'org-tweede', b)
      await tx.execute(sql`insert into accounts (id, organisation_id, name, account_kind, vv_branche_id, huidige_leverancier_id) values ('sd-acc', 'org-tweede', 'Testaccount SalesDNA', 'prospect', 'br-02', 'cc-02')`)
      await stuur(u, k, 'org-tweede', MOCK_FIXTURES.los.l06v2)
      await stuur(u, k, 'org-tweede', MOCK_FIXTURES.los.l04v3)
      const naBlok = await sublagen(tx)
      await stuur(u, k, 'org-tweede', MOCK_FIXTURES.verouderd.l08)
      const naVerouderd = await sublagen(tx)
      const stand = await leesStand(tx)
      const acc = (await tx.execute(sql`select vv_branche_id from accounts where id = 'sd-acc'`)).rows[0]
      return { naBlok, naVerouderd, stand, acc }
    })
    expect(r.stand.branches.find((b: any) => b.id === 'br-02')?.naam).toBe('Installateurs utiliteitsbouw')
    expect((r.acc as any).vv_branche_id).toBe('br-02')
    expect(r.naBlok.waarde).toMatchObject({ versie: 3, verouderd: false })
    expect(r.naVerouderd.concurrenten).toMatchObject({ verouderd: true, versie: 1 })
    expect(r.stand.concurrenten.length).toBeGreaterThan(0)
  })

  it('verdwenen concurrent op actief=false; nieuwe branche zonder SBI geeft een taak voor de beheerder', async () => {
    const r = await inTx(async (tx, u) => {
      const k = await maakKoppeling(tx, u, 'org-tweede')
      await stuur(u, k, 'org-tweede', basis('L0.8'))
      await stuur(u, k, 'org-tweede', basis('L0.6'))
      const l08 = structuredClone(basis('L0.8'))
      l08.inhoud.rijen = l08.inhoud.rijen.filter((x: any) => x._id !== 'cc-02')
      await stuur(u, k, 'org-tweede', l08, { versie: 2, eventId: 'evt-weg' })
      const cc = (await tx.execute(sql`select extern_id, actief, bron from vv_concurrenten where extern_id = 'cc-02'`)).rows[0]
      const taken = (await tx.execute(sql`select title, owner_id from tasks where title like 'Nieuwe branche%'`)).rows
      return { cc, taken }
    })
    expect(r.cc).toMatchObject({ actief: false, bron: 'salesdna' })
    expect(r.taken.length).toBe(4)
    expect(r.taken[0]).toMatchObject({ owner_id: 'u-t1' })
  })
})

describe('bron kiezen en ontkoppelen', () => {
  it('Voltvast: SalesDNA wordt de bron na de controlelijst (archief, naammapping); gespiegeld weigert bewerken; ontkoppelen kopieert terug', async () => {
    const r = await inTx(async (tx, u) => {
      const k = await maakKoppeling(tx, u, 'org-voltvast')
      await u.inOrg('org-voltvast', async () => undefined)
      await tx.execute(sql`update vv_branches set extern_id = 'eigen-util' where extern_id = 'br-02'`)
      await tx.execute(sql`update vv_sublagen set concept = jsonb_set(concept, '{items,1,id}', '"eigen-util"') where onderdeel = 'branches'`)
      await tx.execute(sql`update accounts set vv_branche_id = 'eigen-util' where vv_branche_id = 'br-02'`)
      const accounts = Number((await tx.execute(sql`select count(*)::int n from accounts where vv_branche_id = 'eigen-util'`)).rows[0]!.n)
      await stuur(u, k, 'org-voltvast', basis('L0.6'))
      const voor = (await sublagen(tx)).branches
      const v = await sd.vergelijk(tx, 'org-voltvast', 'branches')
      const zonder = await sd.wordSalesdna(tx, 'org-voltvast', 'branches', {}, 'u-06').catch((e: any) => e)
      await sd.wordSalesdna(tx, 'org-voltvast', 'branches', { controlelijstBevestigd: true }, 'u-06')
      const na = (await sublagen(tx)).branches
      const gemapt = Number((await tx.execute(sql`select count(*)::int n from accounts where vv_branche_id = 'br-02'`)).rows[0]!.n)
      const archief = (await tx.execute(sql`select status, herkomst from vv_versies where onderdeel = 'branches' order by versie desc limit 1`)).rows[0]
      const bewerk = await (await import('../../server/utils/vvProjectie')).bewaarConcept(tx, 'org-voltvast', 'branches', {}).catch((e: any) => e)
      const leeg = await sd.wordSalesdna(tx, 'org-voltvast', 'golden_circle', { controlelijstBevestigd: true }, 'u-06').catch((e: any) => e)
      await sd.ontkoppel(tx, 'org-voltvast', 'u-06')
      const ontk = (await sublagen(tx)).branches
      const kop = (await tx.execute(sql`select status, geheimen from koppelingen where soort = 'salesdna'`)).rows[0]
      return { voor, v, zonder, na, accounts, gemapt, archief, bewerk, leeg, ontk, kop, stand: await leesStand(tx) }
    })
    expect(r.voor.bron).toBe('eigen')
    expect(r.v.controlelijst.find((c: any) => c.eigenId === 'eigen-util')).toMatchObject({ salesdnaId: 'br-02', op: 'naam', accounts: r.accounts })
    expect(r.zonder.statusCode).toBe(422)
    expect(r.na).toMatchObject({ bron: 'salesdna', versie: 1 })
    expect(r.gemapt).toBe(r.accounts)
    expect(r.archief).toMatchObject({ status: 'gearchiveerd', herkomst: 'eigen' })
    expect(r.bewerk.statusCode).toBe(409)
    expect(r.leeg.statusCode).toBe(409)
    expect(r.ontk).toMatchObject({ bron: 'eigen', status: 'bevestigd' })
    expect(r.kop).toMatchObject({ status: 'uit', geheimen: null })
    expect(r.stand.branches.map((b: any) => b.id)).toContain('br-02')
  })

  it('koppelen met de mock: ping, volledige synchronisatie en een run in het logboek', async () => {
    const r = await inTx(async (tx, u) => {
      await u.inOrg('org-tweede', async () => undefined)
      const run = await sd.koppel(tx, 'org-tweede', 'mock', 'nieuw-geheim', 'u-t1')
      const st = await sd.status(tx, 'org-tweede')
      return { run, st }
    })
    expect(r.run).toMatchObject({ gelezen: 7, geschreven: 7, fouten: [] })
    expect(r.st.gekoppeld).toBe(true)
    expect(r.st.koppeling?.vingerafdruk).toHaveLength(8)
    expect(JSON.stringify(r.st)).not.toContain('nieuw-geheim')
    expect(r.st.onderdelen.filter((o: any) => o.bron === 'salesdna')).toHaveLength(7)
  })
})
