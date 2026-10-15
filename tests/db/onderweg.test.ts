// P30 op databaseniveau: het dagpakket (inhoud, hooguit 5 MB, versie), "In de buurt" binnen 15
// minuten, bezoek afronden met nieuwe contactpersoon, bijlage en volgende stap (idempotent), het
// inloopbezoek, de meetingsoort Ongepland bezoek, RLS op bijlagen en geen opgeslagen locatie.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { nlMoment } from '../../shared/datum'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { dagpakket, inDeBuurt, bezoekAfronden, legInloopVast, DAGPAKKET_MAX } = await import('../../server/utils/onderweg')

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
const ctx = { gebruiker: { id: 'u-05', rol: 'accountmanager', niveau: 'gevorderd', werkplek: 'buitendienst', verborgen: [] }, organisatie: { id: ORG, pakket: 'compleet', iedereenAlles: false, features: { aan: [], uit: [] } }, stand: [] as any[] }

describe('dagpakket', () => {
  it('vandaag en morgen, accountkaarten, meetingsoorten met Ongepland bezoek, redenen; hooguit 5 MB; versie vastgelegd', async () => {
    await inOrg(ORG, async (tx) => {
      const p = await dagpakket(tx, ORG, await lieke(tx), ctx, vandaag, ['pr-g24'], nu)
      expect(p.dagen).toHaveLength(2)
      expect(p.dagen[0].stops).toHaveLength(3)
      expect(p.accounts.map((a: any) => a.id)).toEqual(expect.arrayContaining(['pr-g39', 'pr-g44', 'pr-10', 'pr-g24']))
      expect(p.accounts.find((a: any) => a.id === 'pr-g39').contacten.length).toBeGreaterThan(0)
      expect(p.accounts.every((a: any) => a.momenten.length <= 10)).toBe(true)
      expect(p.meetingsoorten.map((m: any) => m.slug)).toContain('ongepland-bezoek')
      expect(p.neeRedenen.length).toBeGreaterThan(3)
      expect(p.grootte).toBeLessThan(DAGPAKKET_MAX)
      const v = await rij(tx, sql`select versie, accounts from dagpakket_versies where gebruiker_id = 'u-05' and datum = ${vandaag}`)
      expect(v).toMatchObject({ versie: p.versie, accounts: p.accounts.length })
      // Zelfde stand geeft dezelfde versie.
      expect((await dagpakket(tx, ORG, await lieke(tx), ctx, vandaag, ['pr-g24'], nu)).versie).toBe(p.versie)
    })
  })
})

describe('in de buurt', () => {
  it('eigen accounts binnen 15 minuten met reden; alleen prospects werkt; nee valt weg', async () => {
    await inOrg(ORG, async (tx) => {
      const assen = { lat: 52.99, lng: 6.56 }
      const r = await inDeBuurt(tx, 'u-05', assen, 15, false, nu)
      expect(r.length).toBeGreaterThan(0)
      expect(r.every((a) => a.minuten <= 15 && a.reden)).toBe(true)
      expect(r.some((a) => a.id === 'pr-g09')).toBe(false) // nee
      expect(r.some((a) => a.id === 'pr-08')).toBe(false) // Emmen, verder dan 15 minuten
      await tx.execute(sql`update accounts set account_kind = 'klant' where id = 'pr-g34'`)
      expect((await inDeBuurt(tx, 'u-05', assen, 15, true, nu)).some((a) => a.id === 'pr-g34')).toBe(false)
    })
  })
})

describe('bezoek afronden en inloop', () => {
  it('uitkomst, nieuwe contactpersoon, bijlage en volgende stap; nog eens met dezelfde uitkomst doet niets', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud) values ('11111111-1111-4111-8111-111111111111', ${ORG}, 'u-05', 'appointments', 'dag-a2', 'foto', 'image/jpeg', 3, '\\x010203')`)
      const r = await bezoekAfronden(tx, ORG, 'u-05', { afspraakId: 'dag-a2', uitkomst: 'andere-contactpersoon', verslag: 'De inkoper was er niet.', bijlagen: ['11111111-1111-4111-8111-111111111111'], nieuwContact: { naam: 'Kees Testinkoop', functie: 'Inkoper', telefoon: '0612345678' }, volgendeStap: { titel: 'Bel Kees', datum: '2026-12-01', soort: 'bellen' } }, nu)
      expect(r.alAfgerond).toBe(false)
      expect(await rij(tx, sql`select status, uitkomst_code, data->'bijlagen' as b from appointments where id = 'dag-a2'`)).toMatchObject({ status: 'afgerond', uitkomst_code: 'andere-contactpersoon', b: ['11111111-1111-4111-8111-111111111111'] })
      expect((await rij(tx, sql`select data->>'functie' as f from contacts where last_name = 'Testinkoop'`)).f).toBe('Inkoper')
      expect((await rij(tx, sql`select count(*)::int as n from tasks where title = 'Bel Kees'`)).n).toBe(1)
      const nog = await bezoekAfronden(tx, ORG, 'u-05', { afspraakId: 'dag-a2', uitkomst: 'andere-contactpersoon', volgendeStap: { titel: 'Bel Kees', datum: '2026-12-01' } }, nu)
      expect(nog.alAfgerond).toBe(true)
      expect((await rij(tx, sql`select count(*)::int as n from tasks where title = 'Bel Kees'`)).n).toBe(1)
    })
  })
  it('geen interesse vraagt een reden en zet nee met afkoelperiode', async () => {
    await inOrg(ORG, async (tx) => {
      await expect(bezoekAfronden(tx, ORG, 'u-05', { afspraakId: 'dag-a1', uitkomst: 'geen-vervolg' }, nu)).rejects.toMatchObject({ statusCode: 400 })
      await bezoekAfronden(tx, ORG, 'u-05', { afspraakId: 'dag-a1', uitkomst: 'geen-vervolg', reden: 'Geen budget' }, nu)
      const a = await rij(tx, sql`select nb_status, data->'nee' as nee from accounts where id = 'pr-g39'`)
      expect(a.nb_status).toBe('nee')
      expect(a.nee.afkoeling).toBeTruthy()
    })
  })
  it('inloop: een afspraak Ongepland bezoek nu, idempotent op het id, geen eerste afspraak', async () => {
    await inOrg(ORG, async (tx) => {
      const id = '22222222-2222-4222-8222-222222222222'
      const a = await legInloopVast(tx, ORG, 'u-05', { id, accountId: 'pr-g29' })
      const b = await legInloopVast(tx, ORG, 'u-05', { id, accountId: 'pr-g29' })
      expect([a.nieuw, b.nieuw]).toEqual([true, false])
      expect(await rij(tx, sql`select m.slug, ap.vorm, ap.status from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.id = ${id}`)).toMatchObject({ slug: 'ongepland-bezoek', vorm: 'bezoek', status: 'gepland' })
      const r = await bezoekAfronden(tx, ORG, 'u-05', { afspraakId: id, uitkomst: 'later', laterOp: '2026-12-15' }, nu)
      expect(r.eerste).toBe(false)
      expect((await rij(tx, sql`select fase_id from accounts where id = 'pr-g29'`)).fase_id).not.toBe('afspraak-gehouden')
    })
  })
})

describe('privacy en RLS', () => {
  it('bijlagen van Voltvast onzichtbaar voor Tweede; geen locatiekolommen op de nieuwe tabellen', async () => {
    await inOrg(ORG, async (tx) => { await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte) values ('33333333-3333-4333-8333-333333333333', ${ORG}, 'u-05', 'appointments', 'dag-a3', 'foto', 'image/jpeg', 1)`) })
    expect(await inOrg('org-tweede', async (tx) => (await rij(tx, sql`select count(*)::int as n from bijlagen`)).n)).toBe(0)
    const kol = await inOrg(ORG, async (tx) => (await tx.execute(sql`select column_name from information_schema.columns where table_name in ('bijlagen', 'dagpakket_versies')`)).rows.map((r: any) => r.column_name))
    expect(kol.some((k: string) => /lat|lng|locatie|plek/.test(k))).toBe(false)
  })
})
