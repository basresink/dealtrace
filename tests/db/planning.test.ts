// P12 op databaseniveau: de motorregel jaarplanning-venster (SR07), inplannen in belblokken met
// belblok_id binnen het dagplafond, de terugkomdatum met afkoeling, de teruggekomen verloren deal
// (C.9 geval 5) en de zes terugkomregels van Voltvast.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { jaarplanning, inplannen, terugkomOverzicht, verwerkTerugkomst } = await import('../../server/utils/planning')
const { zetTerugOp } = await import('../../server/utils/reis')
const { draaiMotor } = await import('../../server/utils/motor')
const fixture = (await import('../../seed/dealdrive-mock/webhook-deal-verloren.json', { with: { type: 'json' } })).default

let pool: pg.Pool
class Terug extends Error {}
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
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })
const nu = new Date('2026-10-15T08:00:00Z')

describe('jaarplanning', () => {
  it('36 grote prospects van u-07 zijn niet benaderd; benaderd telt alleen dit verkoopjaar', async () => {
    const r = await inVoltvast(async (tx) => {
      await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, uitkomst, op) values ('org-voltvast', 'pl-01', 'gebeld', 'geen_reactie', '2025-12-31T15:00:00Z'), ('org-voltvast', 'pl-02', 'import', null, '2026-03-01T10:00:00Z')`)
      return jaarplanning(tx, ['u-07'], nu)
    })
    expect(r.stand.achterstand.groot).toBe(36)
    expect(r.knelt[0]).toMatchObject({ niveau: 'urgent', actie: { aantal: 36 } })
    expect(r.accounts.find((a: any) => a.id === 'pl-01').status).toBe('Nog niet benaderd')
  })
  it('SR07 maakt een beltaak voor een prospect waarvan het venster voorbij is; niet bij een poging dit jaar', async () => {
    const r = await inVoltvast(async (tx) => {
      await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, uitkomst, op) values ('org-voltvast', 'pl-02', 'gebeld', 'geen_reactie', '2026-03-01T10:00:00Z')`)
      await draaiMotor(tx, 'org-voltvast', { soort: 'handmatig', accountIds: ['pl-01', 'pl-02'], nu })
      return (await tx.execute(sql`select t.account_id, t.action_type from tasks t join activity_rules r on r.id = t.rule_id where r.code = 'SR07' and t.account_id in ('pl-01', 'pl-02')`)).rows
    })
    expect(r).toEqual([{ account_id: 'pl-01', action_type: 'bellen' }])
  })
  it('inplannen zet de beltaken met belblok_id in de koude blokken, nooit boven 40 per dag', async () => {
    const r = await inVoltvast(async (tx) => {
      const ids = (await jaarplanning(tx, ['u-07'], nu)).accounts.filter((a: any) => a.potentie === 'groot').map((a: any) => a.id)
      const uit = await inplannen(tx, 'org-voltvast', ids, { door: 'u-07', nu })
      const taken = (await tx.execute(sql`select count(*)::int n, count(belblok_id)::int b, max(c)::int maxdag from (select belblok_id, count(*) over (partition by to_char(due_date, 'YYYY-MM-DD')) c from tasks where owner_id = 'u-07' and action_type = 'bellen' and status = 'open' and data->'herkomst'->>'bron' = 'jaarplanning') x`)).rows[0]
      return { uit, taken }
    })
    expect(r.uit.ingepland).toBe(36)
    expect(r.taken.n).toBe(36)
    expect(r.taken.b).toBe(36)
    expect(r.taken.maxdag).toBeLessThanOrEqual(40)
  })
})

describe('terugkomen', () => {
  it('een terugkomdatum binnen de afkoelperiode schuift naar het einde ervan', async () => {
    const r = await inVoltvast(async (tx) => {
      const nee = (await tx.execute(sql`select data->'nee' as nee from accounts where id = 'acc-bewaker'`)).rows[0].nee
      const uit = await zetTerugOp(tx, 'acc-bewaker', '2026-11-01', 'Klant vroeg terug te bellen', 'u-03', new Date())
      return { nee, uit }
    })
    expect(r.uit.geschoven).toBe(true)
    expect(r.uit.melding).toMatch(/^De afkoelperiode voor bellen loopt tot \d{4}-\d{2}-\d{2}\. De terugkomdatum is daarop gezet\.$/)
  })
  it('C.9 geval 5: verloren deal met reden Prijs via hc-03 geeft een bezoektaak over 182 dagen', async () => {
    const r = await inVoltvast(async (tx) => {
      const v = await verwerkTerugkomst(tx, 'org-voltvast', 'pr-01', { bronSoort: 'deal_verloren', reden: fixture.gegevens.reden }, nu)
      const t = (await tx.execute(sql`select action_type, due_date, data->>'waarom' as w from tasks where id = ${v.taskId}`)).rows[0]
      const a = (await tx.execute(sql`select terug_op, terug_regel_id from accounts where id = 'pr-01'`)).rows[0]
      return { v, t, a }
    })
    expect(r.a).toEqual({ terug_op: '2027-04-15', terug_regel_id: 'hc-03' })
    expect(r.t.action_type).toBe('bezoek')
    expect(new Date(r.t.due_date).toISOString().slice(0, 10)).toBe('2027-04-15')
    expect(r.t.w).toMatch(/^Terug op 15 april 2027 · Prijs te hoog/)
  })
  it('zes terugkomregels in twee lijsten; hc-04 direct; klassen leeg is alle klassen', async () => {
    const r = await inVoltvast((tx) => terugkomOverzicht(tx, 'u-03', nu))
    expect(r.verloren.length + r.slapend.length).toBe(6)
    expect([...r.verloren, ...r.slapend].map((x) => x.id).sort()).toEqual(['hc-01', 'hc-02', 'hc-03', 'hc-04', 'hc-05', 'hc-06'])
    const hc4 = [...r.verloren, ...r.slapend].find((x) => x.id === 'hc-04')!
    expect(hc4.termijnTekst).toBe('direct')
    expect(r.verloren[0]!.klassenTekst).toBe('alle klassen')
  })
})
