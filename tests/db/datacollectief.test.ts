// P15 op databaseniveau: een ronde met Datacollectief (bronpil, contactpersonen, "Al in je bestand",
// samenvoegen met KvK), contactpersonen op een account (ontdubbelen, hand niet overschrijven,
// onderdrukkingslijst, herkomst), het plafond (429 zonder kosten, melding bij 80 procent), runs en
// verbruik, en de scheiding tussen organisaties. Alles tegen de mock.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string; data?: unknown }) => Object.assign(new Error(o.statusMessage), o)
const { draaiRonde, leadsVoorScherm, verrijkContactenViaDc } = await import('../../server/utils/leads')
const { dcStatus } = await import('../../server/utils/bronnen/datacollectief')
const { emailHash } = await import('../../server/utils/importer')

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
const ORG = { id: 'org-voltvast', pakket: 'compleet' as const }
const U07 = { id: 'u-07', rol: 'accountmanager', niveau: 'expert', werkplek: 'binnendienst', data: {} }

describe('Datacollectief', () => {
  it('ronde: leads met bronpil en contactpersonen; een bestaand account staat in "Al in je bestand"; elk record telt en staat in de runs', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      const voor = await dcStatus(tx, 'compleet')
      const ronde = await draaiRonde(tx, ORG, U07, { brancheId: 'br-01' }, ['datacollectief'])
      const rijen = await tx.select().from(schema.leads).where(sql`ronde_id = ${ronde.rondeId}`)
      const scherm = await leadsVoorScherm(tx, rijen, { brancheId: 'br-01' })
      const na = await dcStatus(tx, 'compleet')
      return { ronde, rijen, scherm, voor, na }
    })
    expect(r.ronde.aantal).toBeGreaterThanOrEqual(8)
    expect(r.ronde.dc).toBe(r.na.gebruikt - r.voor.gebruikt)
    expect(r.rijen.every((l: any) => l.bron === 'datacollectief')).toBe(true)
    const hoekstra = r.rijen.find((l: any) => l.kvk === '92000001') as any
    expect(hoekstra.data.contacten[0]).toMatchObject({ naam: 'Jelle Testhoekstra', functie: 'Eigenaar', bron: 'datacollectief' })
    expect(hoekstra.data.herkomst.kvk.bron).toBe('datacollectief')
    const stroomdal = (r.scherm as any[]).find((l) => l.naam === 'Testinstallatie Stroomdal')
    expect(stroomdal?.groep).toBe('alBekend')
    expect(stroomdal?.bronLabel).toBe('Datacollectief')
    expect(r.na.runs[0]).toMatchObject({ handeling: 'selectie' })
  })

  it('ronde met KvK en Datacollectief: één lead per bedrijf; KvK-velden blijven, contactpersonen komen erbij', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      const ronde = await draaiRonde(tx, ORG, U07, { brancheId: 'br-01' }, ['kvk', 'datacollectief'])
      return (await tx.select().from(schema.leads).where(sql`ronde_id = ${ronde.rondeId} and kvk = '91000002'`)) as any[]
    })
    expect(r).toHaveLength(1)
    expect(r[0].bron).toBe('kvk')
    expect(r[0].data.herkomst.naam.bron).toBe('kvk')
    expect(r[0].data.contacten.some((c: any) => c.naam === 'Sanne Vonk' && c.bron === 'datacollectief')).toBe(true)
  })

  it('contactpersonen op een account: ontdubbeld, hand blijft, afgemeld adres komt niet terug als mailbaar, herkomst met datum', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      await tx.execute(sql`delete from contacts where account_id = 'pr-03'`)
      await tx.execute(sql`insert into contacts (organisation_id, account_id, first_name, last_name, email, data) values ('org-voltvast', 'pr-03', 'Frank', 'Teststroom', 'frank@stroomdal.test', ${JSON.stringify({ functie: 'Directeur-eigenaar', herkomst: { functie: { bron: 'hand', op: '2026-01-01' } } })}::jsonb)`)
      await tx.execute(sql`insert into onderdrukkingslijst (organisation_id, email_hash) values ('org-voltvast', ${emailHash('noor@stroomdal.test')})`)
      const uit = await verrijkContactenViaDc(tx, 'org-voltvast', 'compleet', 'pr-03', 'u-07', 5)
      const contacten = (await tx.execute(sql`select first_name, last_name, email, data from contacts where account_id = 'pr-03' order by last_name`)).rows as any[]
      const tweede = await verrijkContactenViaDc(tx, 'org-voltvast', 'compleet', 'pr-03', 'u-07', 5)
      return { uit, contacten, tweede }
    })
    expect(r.uit.toegevoegd).toBe(1)
    const frank = r.contacten.find((c) => c.last_name === 'Teststroom')
    expect(frank.data.functie).toBe('Directeur-eigenaar')
    expect(frank.data.telefoon).toBe('+31640000091')
    expect(frank.data.herkomst.telefoon.bron).toBe('datacollectief')
    const noor = r.contacten.find((c) => c.last_name === 'Proefdal')
    expect(noor.email).toBeNull()
    expect(noor.data.consent.email.status).toBe('nee')
    expect(noor.data.herkomst.naam.bron).toBe('datacollectief')
    expect(r.contacten).toHaveLength(2)
    expect(r.tweede.toegevoegd).toBe(0)
  })

  it('plafond: boven het plafond 429 en geen kosten; bij 80 procent één melding aan de beheerder', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      await tx.execute(sql`update koppelingen set instellingen = instellingen || '{"plafond": 10}'::jsonb where soort = 'datacollectief'`)
      await tx.execute(sql`insert into lead_verbruik (organisation_id, maand, soort, aantal) values ('org-voltvast', ${new Date().toISOString().slice(0, 7)}, 'datacollectief', 7)
        on conflict (organisation_id, maand, soort) do update set aantal = 7`)
      await verrijkContactenViaDc(tx, 'org-voltvast', 'compleet', 'pr-03', 'u-07', 2)
      const melding = (await tx.execute(sql`select count(*)::int n from notificaties where titel = 'Datacollectief op 80 procent'`)).rows[0] as any
      await tx.execute(sql`update lead_verbruik set aantal = 10 where soort = 'datacollectief'`)
      const voor = (await tx.execute(sql`select aantal from lead_verbruik where soort = 'datacollectief'`)).rows[0] as any
      const fout = await draaiRonde(tx, ORG, U07, { brancheId: 'br-02' }, ['datacollectief']).catch((e: any) => e)
      const na = (await tx.execute(sql`select aantal from lead_verbruik where soort = 'datacollectief'`)).rows[0] as any
      return { melding: melding.n, fout, voor: voor.aantal, na: na.aantal }
    })
    expect(r.melding).toBe(1)
    expect(r.fout.statusCode).toBe(429)
    expect(r.fout.statusMessage).toBe('Je maandplafond voor Datacollectief-records is op.')
    expect(r.na).toBe(r.voor)
  })

  it('zonder sleutel of zonder Compleet is de bron niet kiesbaar; de koppeling van Voltvast is onzichtbaar voor org-tweede', async () => {
    const r = await inOrg('org-tweede', async (tx) => ({
      status: await dcStatus(tx, 'plus'),
      koppelingen: (await tx.execute(sql`select count(*)::int n from koppelingen where soort = 'datacollectief'`)).rows[0] as any,
      verbruik: (await tx.execute(sql`select count(*)::int n from lead_verbruik where soort = 'datacollectief'`)).rows[0] as any,
      ronde: await draaiRonde(tx, { id: 'org-tweede', pakket: 'plus' }, { id: 'u-t1', rol: 'beheerder', niveau: 'expert', werkplek: 'binnendienst', data: {} }, {}, ['datacollectief']).catch((e: any) => e),
    }))
    expect(r.status).toMatchObject({ gekoppeld: false, pakketPlafond: 0 })
    expect(r.koppelingen.n).toBe(0)
    expect(r.verbruik.n).toBe(0)
    expect(r.ronde.statusCode).toBe(403)
  })
})
