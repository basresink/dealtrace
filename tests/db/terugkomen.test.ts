// Instellingen, Terugkomen op databaseniveau: een regel bewaren is atomisch (concept, nieuwe versie, mapping,
// verschuiving en audit), een salesmanager mag geen redenen koppelen, een regel uit SalesDNA geeft 409 op reden,
// termijn, kanaal en aanpak maar bewaart ritme en wie het oppakt, de afkoeling verschuift, met de hand aangepaste
// datums blijven staan en "Niet geschikt" krijgt nooit een regel.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { bewaarAfkoeling, bewaarReden, bewaarRegel, leesTerugkomen, proef } = await import('../../server/utils/terugkomBeheer')
const { AFKOELING_STANDAARD } = await import('../../shared/nbStatus')

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
const ORG = 'org-voltvast'
const hc02 = { reden: 'Beslissing uitgesteld', termijnDagen: 120, kanaal: 'mail' as const, oppakker: 'binnendienst' as const, hercontactritmeId: null, aanpak: 'Korte e-mail met een nieuwe aanleiding.' }
const KAN = { regels: true, redenen: true, afkoeling: true, ritme: true, startset: true }

describe('terugkomen', () => {
  it('regel bewaren: nieuwe versie, de wachtende prospects verschuiven zoals de droogloop zei, audit', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const voor = await leesTerugkomen(tx, KAN)
      const p = await proef(tx, { regel: { id: 'hc-02', ...hc02 } })
      const uit = await bewaarRegel(tx, ORG, 'u-06', 'hc-02', hc02, undefined, true)
      const ids = p.verschuivingen.map((v) => v.id)
      const accounts = ids.length ? (await tx.execute(sql`select id, terug_op, data->'terugkom'->>'datum' as datum from accounts where id = any(string_to_array(${ids.join(',')}, ','))`)).rows : []
      const regel = (await tx.execute(sql`select termijn_dagen, termijn from vv_terugkomregels where extern_id = 'hc-02'`)).rows[0]
      const audit = (await tx.execute(sql`select changes from audit_events where action = 'terugkomen.regel' and resource_id = 'hc-02'`)).rows
      return { voor, p, uit, accounts, regel, audit }
    })
    expect(r.uit.versie).toBe(r.voor.versie + 1)
    expect(r.p.aantal).toBeGreaterThan(0)
    expect(r.uit.verschoven).toBe(r.p.aantal)
    for (const a of r.accounts as any[]) {
      const v = r.p.verschuivingen.find((x) => x.id === a.id)!
      expect(a.terug_op).toBe(v.naar)
      expect(a.datum).toBe(v.naar)
    }
    expect(r.regel).toMatchObject({ termijn_dagen: 120, termijn: 'Over 120 dagen' })
    expect(r.audit).toHaveLength(1)
  })

  it('een met de hand aangepaste datum verschuift niet', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const p = await proef(tx, { regel: { id: 'hc-02', ...hc02 } })
      const eerste = p.verschuivingen[0]!
      await tx.execute(sql`update accounts set data = data || '{"terugHistorie":[{"reden":"test"}]}'::jsonb where id = ${eerste.id}`)
      const na = await proef(tx, { regel: { id: 'hc-02', ...hc02 } })
      return { eerste, na }
    })
    expect(r.na.verschuivingen.some((v) => v.id === r.eerste.id)).toBe(false)
  })

  it('een reden verhuist naar de regel; de salesmanager mag dat niet (403)', async () => {
    const reden = [{ bronSoort: 'nee' as const, reden: 'Tevreden met huidige leverancier' }, { bronSoort: 'nee' as const, reden: 'Verkeerd moment' }, { bronSoort: 'deal_verloren' as const, reden: 'Timing' }, { bronSoort: 'deal_verloren' as const, reden: 'Geen besluit' }]
    const sm = await inOrg(ORG, (tx) => bewaarRegel(tx, ORG, 'u-04', 'hc-02', hc02, reden, false).catch((e) => e))
    expect(statusVan(sm)).toBe(403)
    const r = await inOrg(ORG, async (tx) => {
      const uit = await bewaarRegel(tx, ORG, 'u-06', 'hc-02', hc02, reden, true)
      const m = (await tx.execute(sql`select terugkomregel_id from vv_redenmapping where reden = 'Tevreden met huidige leverancier' and bron_soort = 'nee'`)).rows[0] as any
      return { uit, m }
    })
    expect(r.uit.verhuisd).toEqual([{ reden: 'Tevreden met huidige leverancier', van: 'hc-06' }])
    expect(r.m.terugkomregel_id).toBe('hc-02')
  })

  it('een nieuwe regel krijgt een id en staat in het leesmodel', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const uit = await bewaarRegel(tx, ORG, 'u-04', 'nieuw', { ...hc02, reden: 'Testregel budget', termijnDagen: 200, kanaal: 'bellen' }, undefined, false)
      return { uit, rij: (await tx.execute(sql`select reden, rollen from vv_terugkomregels where extern_id = ${uit.id} and actief`)).rows[0] }
    })
    expect(r.uit.id).toMatch(/^tk-/)
    expect(r.rij).toMatchObject({ reden: 'Testregel budget', rollen: ['Binnendienst'] })
  })

  it('uit SalesDNA: reden, termijn, kanaal en aanpak geven 409; ritme en wie het oppakt mogen, zonder nieuwe versie', async () => {
    const r = await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update vv_sublagen set bron = 'salesdna' where onderdeel = 'terugkomregels'`)
      const voor = await leesTerugkomen(tx, KAN)
      const huidig = voor.regels.find((x: any) => x.id === 'hc-02')!
      const basis = { reden: huidig.reden, termijnDagen: huidig.termijnDagen, kanaal: huidig.kanaalSleutel, oppakker: huidig.oppakker, hercontactritmeId: null, aanpak: huidig.aanpak }
      const termijn = await bewaarRegel(tx, ORG, 'u-06', 'hc-02', { ...basis, termijnDagen: 150 }, undefined, true).catch((e) => e)
      const nieuw = await bewaarRegel(tx, ORG, 'u-06', 'nieuw', { ...basis, reden: 'Anders' }, undefined, true).catch((e) => e)
      const [ritme] = (await tx.execute(sql`select id from hercontactritmes where naam = 'Winback'`)).rows as any[]
      const ok = await bewaarRegel(tx, ORG, 'u-06', 'hc-02', { ...basis, oppakker: 'buitendienst', hercontactritmeId: ritme.id }, undefined, true)
      const rij = (await tx.execute(sql`select rollen, hercontactritme_id from vv_terugkomregels where extern_id = 'hc-02'`)).rows[0]
      const na = await leesTerugkomen(tx, KAN)
      return { termijn, nieuw, ok, rij, ritme, voor, na }
    })
    expect(statusVan(r.termijn)).toBe(409)
    expect(statusVan(r.nieuw)).toBe(409)
    expect(r.ok.versie).toBe(r.voor.versie)
    expect(r.rij).toEqual({ rollen: ['Buitendienst'], hercontactritme_id: r.ritme.id })
    expect(r.na.regels.find((x: any) => x.id === 'hc-02')).toMatchObject({ oppakker: 'buitendienst', hercontactritmeId: r.ritme.id })
  })

  it('afkoeling bewaren verschuift en schrijft een auditregel; Niet geschikt krijgt nooit een regel', async () => {
    const r = await inOrg(ORG, async (tx) => {
      const afk = { ...AFKOELING_STANDAARD, bellen: 200 }
      const p = await proef(tx, { afkoeling: afk })
      const uit = await bewaarAfkoeling(tx, ORG, 'u-06', afk)
      const inst = (await tx.execute(sql`select value from org_settings where key = 'afkoeling'`)).rows[0] as any
      const nietGeschikt = await bewaarReden(tx, ORG, 'u-06', { bronSoort: 'nee', reden: 'Niet geschikt', terugkomregelId: 'hc-01' }).catch((e) => e)
      const onbekend = await bewaarReden(tx, ORG, 'u-06', { bronSoort: 'nee', reden: 'Geen budget', terugkomregelId: 'bestaat-niet' }).catch((e) => e)
      return { p, uit, inst, nietGeschikt, onbekend }
    })
    expect(r.uit.verschoven).toBe(r.p.aantal)
    expect(r.inst.value.bellen).toBe(200)
    expect(statusVan(r.nietGeschikt)).toBe(422)
    expect(statusVan(r.onbekend)).toBe(422)
  })

  it('een andere organisatie ziet de regels van Voltvast niet', async () => {
    const r = await inOrg('org-tweede', (tx) => leesTerugkomen(tx, KAN))
    expect(r.regels.some((x: any) => x.id === 'hc-02')).toBe(false)
  })
})
