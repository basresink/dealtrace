// P32 op databaseniveau: de fixturedag uit de seed via dezelfde rekenkern, alleen eigen werk,
// het signaalbesluit (idempotent per dag, stilte, dagplafond) en RLS op signaal_besluiten.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { nlMoment } from '../../shared/datum'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { telefoonDag, besluit, laadBron } = await import('../../server/utils/dagritme')

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
const ochtend = () => { const d = new Date(); return new Date(`${nlMoment(d).datum}T06:00:00Z`) }

describe('Vandaag op de telefoon', () => {
  it('Lieke (buitendienst): drie afspraken, vijf belacties, focus op de eerste afspraak, signaal terugkomregel', async () => {
    const nu = ochtend()
    const r = await inOrg('org-voltvast', (tx) => telefoonDag(tx, { id: 'u-05', werkplek: 'buitendienst', niveau: 'gevorderd' }, nlMoment(nu).datum, nu))
    expect(r.dag.stapels.afspraken).toHaveLength(3)
    expect(r.dag.stapels.bellen).toHaveLength(5)
    expect(r.dag.stapels.bellen.filter((b) => b.achterstallig)).toHaveLength(1)
    expect(r.focus).toMatchObject({ regel: '1-eerste-afspraak', accountId: 'pr-g39' })
    expect(r.signaal?.soort).toBe('terugkomregel')
    expect(r.recap).toBeNull()
    expect(r.dag.stapels.eersteAfspraken.find((x) => x.accountId === 'pr-g39')?.knop).toBe('bevestig')
  })

  it('Beginner krijgt geen signaal en geen tip; binnendienst heeft de belstapel bovenaan', async () => {
    const nu = ochtend()
    const r = await inOrg('org-voltvast', async (tx) => ({
      beginner: await telefoonDag(tx, { id: 'u-05', werkplek: 'buitendienst', niveau: 'beginner' }, nlMoment(nu).datum, nu),
      ruben: await telefoonDag(tx, { id: 'u-03', werkplek: 'binnendienst', niveau: 'gevorderd' }, nlMoment(nu).datum, nu),
    }))
    expect(r.beginner.signaal).toBeNull()
    expect(r.beginner.tip).toBeNull()
    expect(r.ruben.dag.volgorde[0]).toBe('bellen')
    expect(r.ruben.dag.stapels.bellen).toHaveLength(5)
    expect(r.ruben.dag.stapels.bellen.every((b) => !b.titel.includes('onderhoudsplanning'))).toBe(true)
  })

  it('een taak van een collega op een eigen account verschijnt niet', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, due_date) values ('dag-col', 'org-voltvast', 'u-01', 'pr-g39', 'bellen', 'Collega belt', 'open', now())`)
      return laadBron(tx, 'u-05')
    })
    expect(r.taken.some((t) => t.id === 'dag-col')).toBe(false)
  })

  it('signaalbesluit: idempotent per dag, stil tot, en het signaal is weg op elk toestel', async () => {
    const nu = ochtend()
    const r = await inOrg('org-voltvast', async (tx) => {
      const voor = await telefoonDag(tx, { id: 'u-05', werkplek: 'buitendienst', niveau: 'gevorderd' }, nlMoment(nu).datum, nu)
      const sleutel = voor.signaal!.sleutel
      const b1 = await besluit(tx, 'org-voltvast', 'u-05', sleutel, 'later', nu)
      await besluit(tx, 'org-voltvast', 'u-05', sleutel, 'later', nu)
      const n = (await tx.execute(sql`select count(*)::int n from signaal_besluiten where gebruiker_id = 'u-05'`)).rows[0] as any
      const na = await telefoonDag(tx, { id: 'u-05', werkplek: 'buitendienst', niveau: 'gevorderd' }, nlMoment(nu).datum, nu)
      return { sleutel, b1, n: n.n, na }
    })
    expect(r.n).toBe(1)
    expect(r.b1.stilTot > nlMoment(ochtend()).datum).toBe(true)
    expect(r.na.signaal?.sleutel ?? null).not.toBe(r.sleutel)
  })

  it('RLS: org-tweede ziet de besluiten van Voltvast niet', async () => {
    const n = await inOrg('org-voltvast', async (tx) => {
      await besluit(tx, 'org-voltvast', 'u-05', 'terug:x', 'weg')
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      return ((await tx.execute(sql`select count(*)::int n from signaal_besluiten`)).rows[0] as any).n
    })
    expect(n).toBe(0)
  })
})
