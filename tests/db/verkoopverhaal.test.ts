// P28 op databaseniveau: startset kopiëren (concept, 409 met bevestigde inhoud), bevestigen (422 bij
// ontbrekende velden, nieuwe versie, projectie), alleen bevestigd naar buiten, hernoemen houdt ids,
// verouderingsregel met Klopt nog, en RLS tussen organisaties.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { bevestig, bewaarConcept, kloptNog, kopieerStartset, leesStand, sublagen } = await import('../../server/utils/vvProjectie')
const voltvast = (await import('../../seed/voltvast.json', { with: { type: 'json' } })).default as any

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
const statusVan = (e: any) => e?.statusCode

describe('verkoopverhaal', () => {
  it('Voltvast heeft zeven bevestigde onderdelen; de golden circle is concept', async () => {
    const s = await inOrg('org-voltvast', (tx) => sublagen(tx))
    expect(Object.values(s).filter((x) => x.status === 'bevestigd')).toHaveLength(7)
    expect(s.golden_circle.status).toBe('concept')
  })

  it('startset kopiëren met bevestigde inhoud geeft 409', async () => {
    const e = await inOrg('org-voltvast', (tx) => kopieerStartset(tx, 'org-voltvast', voltvast.verkoopverhaal, 'u-06').catch((x) => x))
    expect(statusVan(e)).toBe(409)
  })

  it('org-tweede: startset als concept, niets naar buiten tot bevestigen; dan wel', async () => {
    const r = await inOrg('org-tweede', async (tx) => {
      const voor = await leesStand(tx)
      await kopieerStartset(tx, 'org-tweede', voltvast.verkoopverhaal, 'u-t1')
      const s = await sublagen(tx)
      const naKopie = await leesStand(tx)
      const fout = await bevestig(tx, 'org-tweede', 'golden_circle', 'u-t1').catch((x) => x)
      const v = await bevestig(tx, 'org-tweede', 'branches', 'u-t1')
      await bevestig(tx, 'org-tweede', 'bedrijfsverhaal', 'u-t1')
      return { voor, s, naKopie, fout, v, na: await leesStand(tx) }
    })
    expect(r.voor.branches).toHaveLength(0)
    expect(Object.values(r.s).every((x) => x.status === 'concept')).toBe(true)
    expect(r.naKopie.branches).toHaveLength(0)
    expect(r.naKopie.teksten).toHaveLength(0)
    expect(statusVan(r.fout)).toBe(422)
    expect(r.fout.message).toContain('Waarom')
    expect(r.v.versie).toBe(1)
    expect(r.na.branches.map((b) => b.id)).toEqual(expect.arrayContaining(['br-01', 'br-02', 'br-03', 'br-04']))
    expect(r.na.teksten.some((t) => t.sleutel === 'verhaal' && t.brancheId === 'br-01')).toBe(true)
  })

  it('br-02 hernoemen houdt de id; nieuwe versie en Controleren op concurrenten en winpunten; Klopt nog haalt het weg', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      const s = await sublagen(tx, 'org-voltvast')
      const c = structuredClone(s.branches.concept)
      c.items.find((b: any) => b.id === 'br-02').naam = 'Utiliteit en kantoren'
      await bewaarConcept(tx, 'org-voltvast', 'branches', c)
      const v = await bevestig(tx, 'org-voltvast', 'branches', 'u-04')
      const stand = await leesStand(tx)
      const na = await sublagen(tx)
      await kloptNog(tx, 'org-voltvast', 'winpunten', 'u-04')
      const daarna = await sublagen(tx)
      const versies = (await tx.execute(sql`select count(*)::int n from vv_versies where onderdeel = 'branches'`)).rows[0]
      return { v, stand, na, daarna, versies, voor: s.branches.versie }
    })
    expect(r.v.versie).toBe(r.voor + 1)
    expect(r.stand.branches.find((b) => b.id === 'br-02')?.naam).toBe('Utiliteit en kantoren')
    expect(r.na.concurrenten.controleren).toBe(true)
    expect(r.na.winpunten.controleren).toBe(true)
    expect(r.daarna.winpunten.controleren).toBe(false)
    expect(r.daarna.winpunten.versie).toBe(r.na.winpunten.versie)
    expect((r.versies as any).n).toBe(r.v.versie)
  })

  it('RLS: org-tweede ziet het verhaal van Voltvast niet', async () => {
    const r = await inOrg('org-tweede', async (tx) => ({
      branches: (await tx.execute(sql`select count(*)::int n from vv_branches`)).rows[0],
      teksten: (await tx.execute(sql`select count(*)::int n from vv_teksten`)).rows[0],
    }))
    expect((r.branches as any).n).toBe(0)
    expect((r.teksten as any).n).toBe(0)
  })

  it('versies zijn een log: de app mag ze niet wijzigen', async () => {
    const e = await inOrg('org-voltvast', (tx) => tx.execute(sql`delete from vv_versies`).catch((x: any) => x))
    expect(String(e?.cause?.message ?? e?.message)).toMatch(/permission denied/)
  })
})
