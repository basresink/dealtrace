// Afspraakvenster en plannen in de opzet van DealDrive op databaseniveau: plannen met contact, titel,
// herhaling en uitgenodigde collega's; verplaatsen; de Notulist leest verslag en transcript samen en
// maakt bij opnieuw analyseren geen dubbele concepttaken; Rond af houdt een bewaard verslag.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { planAfspraak, verplaatsAfspraak, rondAfAfspraak, agendaVoor } = await import('../../server/utils/agenda')
const { analyseerVerslag } = await import('../../server/utils/agents/notulist')

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
const lieke = { id: 'u-05', naam: 'Testgebruiker Lieke Nieuwland', rol: 'accountmanager', mag: { voorCollega: false } }
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const soortId = async (tx: any, slug: string) => (await rijen(tx, sql`select id from meetingsoorten where slug = ${slug}`))[0].id as string
const nu = new Date('2026-11-02T08:00:00Z')

describe('plannen in de opzet van DealDrive', () => {
  it('contact van de klant wordt gekoppeld, een contact van een ander account niet; de titel staat op de afspraak', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = await soortId(tx, 'belafspraak')
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', contactId: 'pr-g39-c1', meetingsoortId: soort, start: '2026-11-03T09:00:00Z', titel: '  Leverplan bespreken ' }, nu)
      const [r] = await rijen(tx, sql`select account_id, contact_id, data->>'titel' as titel from appointments where id = ${a.id}`)
      expect(r).toMatchObject({ account_id: 'pr-g39', contact_id: 'pr-g39-c1', titel: 'Leverplan bespreken' })
      const b = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', contactId: 'ct-03', meetingsoortId: soort, start: '2026-11-04T09:00:00Z' }, nu)
      expect((await rijen(tx, sql`select contact_id from appointments where id = ${b.id}`))[0].contact_id).toBeNull()
    })
  })
  it('herhaling wekelijks: een reeks losse afspraken op dezelfde Nederlandse tijd; de taak blijft bij de eerste', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = await soortId(tx, 'belafspraak')
      const r: any = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', meetingsoortId: soort, start: '2026-11-03T09:00:00Z', herhaling: 'wekelijks', herhalingTot: '2026-11-24' }, nu)
      expect(r.aantal).toBe(4)
      expect(r.tekst).toMatch(/^4 afspraken gepland, elke week tot en met 24 november\.$/)
      const reeks = await rijen(tx, sql`select start_at from appointments where data->>'reeksId' = ${r.reeksId} order by start_at`)
      expect(reeks.map((x) => new Date(x.start_at).toISOString())).toEqual(['2026-11-03T09:00:00.000Z', '2026-11-10T09:00:00.000Z', '2026-11-17T09:00:00.000Z', '2026-11-24T09:00:00.000Z'])
    })
  })
  it('collega uitnodigen: de afspraak staat in diens agenda en er is één melding', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = await soortId(tx, 'kennismaking')
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', meetingsoortId: soort, start: '2026-11-05T13:00:00Z', collegaUitnodigen: ['u-03', 'u-05', 'bestaat-niet'] }, nu)
      const [r] = await rijen(tx, sql`select owner_id, data->'uitgenodigd' as uitgenodigd from appointments where id = ${a.id}`)
      expect(r).toMatchObject({ owner_id: 'u-05', uitgenodigd: ['u-03'] })
      const ag = await agendaVoor(tx, ['u-03'], new Date('2026-11-05T00:00:00Z'), new Date('2026-11-06T00:00:00Z'))
      expect(ag.afspraken.some((x: any) => x.id === a.id)).toBe(true)
      expect(await rijen(tx, sql`select 1 from notificaties where gebruiker_id = 'u-03' and link = ${`/agenda?afspraak=${a.id}`}`)).toHaveLength(1)
    })
  })
})

describe('verplaatsen', () => {
  it('nieuw moment, duur en titel; alleen een geplande afspraak', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = await soortId(tx, 'kennismaking')
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', meetingsoortId: soort, start: '2026-11-03T09:00:00Z', duurMin: 30 }, nu)
      const r = await verplaatsAfspraak(tx, ORG, a.id, 'u-05', { start: '2026-11-06T13:00:00Z', duurMin: 45, titel: 'Nieuwe titel' }, nu)
      expect(r).toMatchObject({ start: '2026-11-06T13:00:00.000Z', eind: '2026-11-06T13:45:00.000Z' })
      const [x] = await rijen(tx, sql`select data->>'titel' as titel, data->'verplaatst'->>'van' as van, versie from appointments where id = ${a.id}`)
      expect(x).toMatchObject({ titel: 'Nieuwe titel', van: '2026-11-03T09:00:00.000Z', versie: 2 })
      await tx.execute(sql`update appointments set status = 'geannuleerd' where id = ${a.id}`)
      await expect(verplaatsAfspraak(tx, ORG, a.id, 'u-05', { start: '2026-11-07T13:00:00Z' }, nu)).rejects.toThrow(/Alleen een geplande afspraak/)
    })
  })
})

describe('Notulist in het afspraakvenster', () => {
  it('leest verslag en transcript samen, geeft een samenvatting en maakt geen dubbele concepttaken', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = await soortId(tx, 'kennismaking')
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', contactId: 'pr-g39-c1', meetingsoortId: soort, start: '2026-11-03T09:00:00Z' }, nu)
      await tx.execute(sql`update appointments set data = data || ${JSON.stringify({ verslag: { tekst: 'Goed gesprek over de levering. We sturen het leverplan op.', bron: 'getypt', perAgendapunt: [] } })}::jsonb where id = ${a.id}`)
      await tx.execute(sql`insert into transcripten (organisation_id, record_soort, record_id, tekst, dienst) values (${ORG}, 'appointments', ${a.id}, 'Klant: In maart starten we met nieuwbouw in Zeist.', 'geplakt')`)
      const r: any = await analyseerVerslag(tx, ORG, a.id, nu)
      expect(r.ok).toBe(true)
      expect(r.analyse.samenvatting).toContain('Goed gesprek over de levering.')
      expect(r.analyse.koopsignalen.join(' ')).toMatch(/nieuwbouw/)
      const [ap] = await rijen(tx, sql`select data->'notulist'->'basis' as basis from appointments where id = ${a.id}`)
      expect(ap.basis).toEqual({ verslag: true, transcript: true })
      const tel = async () => (await rijen(tx, sql`select count(*)::int as n from concepten where appointment_id = ${a.id} and handeling = 'taak:uit-verslag'`))[0].n
      const eerst = await tel()
      expect(eerst).toBeGreaterThan(0)
      await analyseerVerslag(tx, ORG, a.id, nu)
      expect(await tel()).toBe(eerst)
    })
  })
  it('Rond af zonder nieuw verslag houdt het bewaarde verslag', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = await soortId(tx, 'belafspraak')
      const a = await planAfspraak(tx, ORG, lieke, { accountId: 'pr-g39', meetingsoortId: soort, start: '2026-11-03T09:00:00Z' }, nu)
      await tx.execute(sql`update appointments set data = data || ${JSON.stringify({ verslag: { tekst: 'Bewaard in het venster.', bron: 'getypt', perAgendapunt: [] } })}::jsonb where id = ${a.id}`)
      await rondAfAfspraak(tx, ORG, a.id, 'u-05', { uitkomst: 'later', verslag: '', laterOp: '2026-12-01' }, nu)
      const [x] = await rijen(tx, sql`select status, data->'verslag'->>'tekst' as tekst from appointments where id = ${a.id}`)
      expect(x).toMatchObject({ status: 'afgerond', tekst: 'Bewaard in het venster.' })
    })
  })
})
