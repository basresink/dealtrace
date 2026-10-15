// P13 op databaseniveau: plannen en afronden van afspraken. Gat 3 (alleen de eerste afspraak meldt),
// gat 32 (de taak sluit bij afronden), gat 37 (agenda bezet telt mee), de melding voor de collega,
// geen vervolg met reden, niet verschenen, intern overleg zonder klantcontact en versleutelde tokens.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { vrijeMomentenAgenda } from '../../shared/agenda'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { planAfspraak, rondAfAfspraak, zetAfspraakStatus, koppel, bezetVoor, leesTokens, agenda } = await import('../../server/utils/agenda')

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
const lieke = { id: 'u-05', naam: 'Testgebruiker Lieke Nieuwland', rol: 'accountmanager', mag: { voorCollega: true } }
const sanne = (mag = true) => ({ id: 'u-03', naam: 'Testgebruiker Sanne Belhuis', rol: 'accountmanager', mag: { voorCollega: mag } })
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const soortId = async (tx: any, slug: string) => (await rij(tx, sql`select id from meetingsoorten where slug = ${slug}`)).id as string
const nu = new Date('2026-11-02T08:00:00Z')

describe('plannen', () => {
  it('gat 3: alleen de eerste afspraak meldt eerste-afspraak-gepland', async () => {
    await inOrg(ORG, async (tx) => {
      const kennis = await soortId(tx, 'kennismaking')
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g34', meetingsoortId: kennis, start: '2026-11-03T09:00:00Z' }, nu)
      const b = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g34', meetingsoortId: await soortId(tx, 'demo'), start: '2026-11-10T09:00:00Z' }, nu)
      expect(a.eerste).toBe(true); expect(b.eerste).toBe(false)
      const acc = await rij(tx, sql`select fase_id, nb_status from accounts where id = 'pr-g34'`)
      expect(acc).toMatchObject({ fase_id: 'afspraak-gepland', nb_status: 'gescoord' })
      const n = await rij(tx, sql`select count(*)::int as n from reisgeschiedenis where gebeurtenis = 'eerste-afspraak-gepland' and prospectreis_id in (select id from prospectreizen where account_id = 'pr-g34')`)
      expect(n.n).toBe(1)
    })
  })
  it('gat 3: een geannuleerde eerste afspraak telt niet; een belafspraak is geen eerste afspraak', async () => {
    await inOrg(ORG, async (tx) => {
      const bel = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g29', meetingsoortId: await soortId(tx, 'belafspraak'), start: '2026-11-03T08:00:00Z' }, nu)
      expect(bel.eerste).toBe(false)
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g29', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-04T09:00:00Z' }, nu)
      expect(a.eerste).toBe(true)
      await zetAfspraakStatus(tx, ORG, a.id, 'u-05', 'geannuleerd', nu)
      const b = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g29', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-11T09:00:00Z' }, nu)
      expect(b.eerste).toBe(true)
    })
  })
  it('binnendienst plant voor de buitendienst: in diens agenda, met briefing en melding; zonder recht 403', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await planAfspraak(tx, ORG, sanne(), { accountId: 'pr-11', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-03T12:00:00Z', voorWie: 'u-05', aanleiding: 'Belde terug' }, nu)
      const ap = await rij(tx, sql`select owner_id, gepland_door, data from appointments where id = ${r.id}`)
      expect(ap).toMatchObject({ owner_id: 'u-05', gepland_door: 'u-03' })
      expect(ap.data.briefing).toContain('Belde terug')
      const m = await rij(tx, sql`select titel, link from notificaties where gebruiker_id = 'u-05' and titel = 'Afspraak gemaakt door een collega voor jou'`)
      expect(m.link).toBe(`/agenda?afspraak=${r.id}`)
      await expect(planAfspraak(tx, ORG, sanne(false), { accountId: 'pr-11', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-03T13:00:00Z', voorWie: 'u-05' }, nu)).rejects.toMatchObject({ statusCode: 403 })
    })
  })
})

describe('afronden', () => {
  it('gat 32: de taak waaruit je plant, is gekoppeld en sluit bij afronden; vervolg vraagt Overdragen?', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values ('t-ag-1', ${ORG}, 'u-05', 'pr-g34', 'bellen', 'Bel voor een afspraak', 'open', 'middel', now(), 'mens', '{}')`)
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g34', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-03T09:00:00Z', taskId: 't-ag-1' }, nu)
      expect((await rij(tx, sql`select data->>'afspraakId' as id, status from tasks where id = 't-ag-1'`)).id).toBe(a.id)
      const r = await rondAfAfspraak(tx, ORG, a.id, 'u-05', { uitkomst: 'vervolg', verslag: 'Ze willen verder', vervolgstap: 'offerte via DealDrive' }, nu)
      expect(r).toMatchObject({ eerste: true, overdragen: true })
      expect((await rij(tx, sql`select status from tasks where id = 't-ag-1'`)).status).toBe('klaar')
      expect((await rij(tx, sql`select fase_id from accounts where id = 'pr-g34'`)).fase_id).toBe('afspraak-gehouden')
      expect((await rij(tx, sql`select title from tasks where data->>'afspraakId' = ${a.id} and id <> 't-ag-1'`)).title).toContain('Overdragen')
      // Idempotent op afspraak en uitkomst; een andere uitkomst geeft 409.
      expect((await rondAfAfspraak(tx, ORG, a.id, 'u-05', { uitkomst: 'vervolg' }, nu)).alAfgerond).toBe(true)
      await expect(rondAfAfspraak(tx, ORG, a.id, 'u-05', { uitkomst: 'later' }, nu)).rejects.toMatchObject({ statusCode: 409 })
    })
  })
  it('geen vervolg vraagt een reden en zet nee; de reis gaat naar verloren', async () => {
    await inOrg(ORG, async (tx) => {
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g34', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-03T09:00:00Z' }, nu)
      await expect(rondAfAfspraak(tx, ORG, a.id, 'u-05', { uitkomst: 'geen-vervolg' }, nu)).rejects.toMatchObject({ statusCode: 400 })
      await rondAfAfspraak(tx, ORG, a.id, 'u-05', { uitkomst: 'geen-vervolg', reden: 'Geen budget' }, nu)
      const acc = await rij(tx, sql`select fase_id, nb_status, data->'nee'->>'reden' as reden from accounts where id = 'pr-g34'`)
      expect(acc).toMatchObject({ fase_id: 'verloren', nb_status: 'nee', reden: 'Geen budget' })
    })
  })
  it('niet verschenen bij de eerste afspraak: fase In gesprek, status in reis, inzicht Gat in je agenda', async () => {
    await inOrg(ORG, async (tx) => {
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g34', meetingsoortId: await soortId(tx, 'kennismaking'), start: '2026-11-03T09:00:00Z' }, nu)
      const r = await zetAfspraakStatus(tx, ORG, a.id, 'u-05', 'niet_verschenen', nu)
      expect(r.eerste).toBe(true)
      expect(await rij(tx, sql`select fase_id, nb_status from accounts where id = 'pr-g34'`)).toMatchObject({ fase_id: 'in-gesprek', nb_status: 'in reis' })
      expect((await rij(tx, sql`select count(*)::int as n from signals where type = 'gat-in-agenda' and data->>'afspraakId' = ${a.id}`)).n).toBe(1)
    })
  })
  it('intern overleg kan zonder klant en werkt laatste_contact_op niet bij', async () => {
    await inOrg(ORG, async (tx) => {
      const intern = await soortId(tx, 'weekoverleg')
      const zonder = await planAfspraak(tx, ORG, lieke, { meetingsoortId: intern, start: '2026-11-03T15:00:00Z' }, nu)
      await rondAfAfspraak(tx, ORG, zonder.id, 'u-05', { uitkomst: 'gehouden' }, nu)
      const voor = (await rij(tx, sql`select laatste_contact_op from accounts where id = 'pr-g19'`)).laatste_contact_op
      const met = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g19', meetingsoortId: intern, start: '2026-11-03T16:00:00Z' }, nu)
      expect(met.eerste).toBe(false)
      await rondAfAfspraak(tx, ORG, met.id, 'u-05', { uitkomst: 'gehouden' }, nu)
      expect((await rij(tx, sql`select laatste_contact_op from accounts where id = 'pr-g19'`)).laatste_contact_op).toEqual(voor)
    })
  })
})

describe('agendakoppeling', () => {
  it('tokens versleuteld met het agendageheim; gat 37: bezet uit de koppeling telt mee in vrije momenten en belblokken', async () => {
    await inOrg(ORG, async (tx) => {
      const dag = '2026-11-03' // een dinsdag: lunch en extern overleg in de mock
      const zonder = vrijeMomentenAgenda(await bezetVoor(tx, 'u-07', new Date(`${dag}T00:00:00Z`), new Date(`${dag}T23:00:00Z`)), dag, 30)
      await koppel(tx, ORG, 'u-07', 'microsoft', 'code-1')
      const k = await rij(tx, sql`select tokens from agenda_koppelingen where gebruiker_id = 'u-07'`)
      expect(k.tokens).not.toContain('mock-')
      expect(leesTokens(k)).toMatchObject({ access: 'mock-microsoft-code-1' })
      const met = vrijeMomentenAgenda(await bezetVoor(tx, 'u-07', new Date(`${dag}T00:00:00Z`), new Date(`${dag}T23:00:00Z`)), dag, 30)
      expect(met.length).toBe(zonder.length - 3)
      expect(met.some((m) => m.start === '2026-11-03T11:00:00.000Z')).toBe(false) // 12:00 lunch
      expect(await agenda(tx).gekoppeld('u-07')).toBe(true)
      expect((await agenda(tx).bezet('u-07', new Date(`${dag}T00:00:00Z`), new Date(`${dag}T23:00:00Z`))).map((b) => b.titel)).toEqual(['Lunch', 'Extern overleg'])
    })
  })
})
