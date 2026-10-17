// Pakket E op databaseniveau: de export bevat alleen de eigen organisatie (eigen filter en RLS), een
// accountmanager en salesmanager krijgen 403, de founder die meekijkt mag geen export maken, een export
// schrijft een auditregel, het vervaloverzicht telt wat ouder is dan de termijn (en verwijdert niets),
// factuurgegevens worden gecontroleerd en het logo weigert een ander bestandstype. Alle data is fictief.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string; data?: unknown }) => Object.assign(new Error(o.statusMessage), o)
const { auditExport, bewaarTermijnen, bouwExport, vereisPrivacyBeheer, vervaltOverzicht } = await import('../../server/utils/privacy')
const { bewaarFactuurgegevens, leesFactuurInstelling } = await import('../../server/utils/facturatie')
const { bewaarLogo, leesLogo, verwijderLogo } = await import('../../server/utils/organisatieLogo')
const { BEWAAR_STANDAARD } = await import('../../shared/privacy')

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
const zet = (tx: any, org: string) => tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
const tekst = (b: { inhoud: string | Uint8Array }) => (typeof b.inhoud === 'string' ? b.inhoud : Buffer.from(b.inhoud).toString('utf8'))
const fout = async (f: () => Promise<unknown> | unknown) => { try { await f(); return null } catch (e: any) { return e } }

beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

describe('export van de organisatie', () => {
  it('bevat alleen de eigen organisatie, ook als een andere organisatie data heeft', async () => {
    const r = await inOrg('org-tweede', async (tx) => {
      // Fictieve data in de tweede organisatie.
      await tx.execute(sql`insert into accounts (id, organisation_id, name) values ('acc-export-tweede', 'org-tweede', 'Testexport Tweede BV')`)
      await tx.execute(sql`insert into activiteiten (id, organisation_id, account_id, soort) values ('act-export-tweede', 'org-tweede', 'acc-export-tweede', 'bellen')`)
      await zet(tx, 'org-voltvast')
      const eigen = await bouwExport(tx, 'org-voltvast', { organisatieNaam: 'Testbedrijf Voltvast', door: 'Test' })
      await zet(tx, 'org-tweede')
      const tweede = await bouwExport(tx, 'org-tweede', { organisatieNaam: 'Testorganisatie Tweede', door: 'Test' })
      const voltvastIds = ((await (async () => { await zet(tx, 'org-voltvast'); return tx.execute(sql`select id from accounts limit 5`) })()).rows as any[]).map((a) => a.id)
      return { eigen, tweede, voltvastIds }
    })
    const alles = r.eigen.bestanden.map(tekst).join('\n')
    expect(r.eigen.bestanden.map((b) => b.naam)).toEqual(['accounts.csv', 'contactpersonen.csv', 'taken.csv', 'afspraken.csv', 'activiteiten.csv', 'verslagen.csv', 'campagnes.csv', 'campagne-accounts.csv', 'accountplannen.csv', 'gebruikers.csv', 'teams.csv', 'instellingen.json'])
    expect(r.eigen.aantallen['accounts.csv']).toBeGreaterThan(0)
    expect(alles).not.toContain('Testexport Tweede')
    expect(alles).not.toContain('act-export-tweede')
    // De tweede organisatie ziet haar eigen rij en niets van Voltvast.
    const tweede = r.tweede.bestanden.map(tekst).join('\n')
    expect(tweede).toContain('Testexport Tweede BV')
    for (const id of r.voltvastIds) expect(tweede).not.toContain(id)
    expect(r.tweede.aantallen['accounts.csv']).toBe(1)
  })

  it('RLS houdt het tegen, ook als de aanroeper een andere organisatie meegeeft', async () => {
    const r = await inOrg('org-tweede', (tx) => bouwExport(tx, 'org-voltvast', { organisatieNaam: 'x', door: 'x' }))
    expect(r.rijen).toBe(0)
  })

  it('geen geheimen: gebruikers zonder data, instellingen zonder de sleutels van de leverancier', async () => {
    const r = await inOrg('org-voltvast', (tx) => bouwExport(tx, 'org-voltvast', { organisatieNaam: 'Testbedrijf Voltvast', door: 'Test' }))
    const gebruikers = tekst(r.bestanden.find((b) => b.naam === 'gebruikers.csv')!)
    expect(gebruikers.split('\r\n')[0]).toBe('﻿id;naam;email;rol;niveau;werkplek;team_id;status;laatste_inlog;aangemaakt_op')
    expect(gebruikers).not.toMatch(/totp|geheim/i)
    const json = JSON.parse(tekst(r.bestanden.find((b) => b.naam === 'instellingen.json')!))
    for (const k of ['pakket', 'aiCredits', 'features', 'platformprompts', 'agentmaxima']) expect(json.instellingen).not.toHaveProperty(k)
    expect(json.organisatie).toBe('Testbedrijf Voltvast')
  })

  it('schrijft een auditregel', async () => {
    const n = await inOrg('org-voltvast', async (tx) => {
      await auditExport(tx, 'org-voltvast', 'u-06', { rijen: 12, aantallen: { 'accounts.csv': 12 } })
      return ((await tx.execute(sql`select count(*)::int as n from audit_events where action = 'organisatie.export' and actor_id = 'u-06'`)).rows[0] as any).n
    })
    expect(n).toBeGreaterThanOrEqual(1)
  })

  it('alleen de beheerder: accountmanager en salesmanager krijgen 403, de founder die meekijkt ook voor de export', async () => {
    expect((await fout(() => vereisPrivacyBeheer({ gebruiker: { rol: 'accountmanager' } })))?.statusCode).toBe(403)
    expect((await fout(() => vereisPrivacyBeheer({ gebruiker: { rol: 'salesmanager' } })))?.statusCode).toBe(403)
    expect(await fout(() => vereisPrivacyBeheer({ gebruiker: { rol: 'beheerder' } }))).toBeNull()
    expect(await fout(() => vereisPrivacyBeheer({ gebruiker: { rol: 'beheerder' }, werkIn: { modus: 'wijzigen' } }))).toBeNull()
    expect((await fout(() => vereisPrivacyBeheer({ gebruiker: { rol: 'beheerder' }, werkIn: { modus: 'wijzigen' } }, { export: true })))?.statusCode).toBe(403)
  })
})

describe('bewaartermijnen', () => {
  it('telt wat ouder is dan de termijn, verwijdert niets en bewaart met audit', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      await tx.execute(sql`insert into activiteiten (id, organisation_id, soort, op) values ('act-oud-1', 'org-voltvast', 'bellen', now() - interval '4 years'), ('act-oud-2', 'org-voltvast', 'mail', now() - interval '18 months')`)
      const standaard = await vervaltOverzicht(tx, 'org-voltvast', BEWAAR_STANDAARD)
      const korter = await bewaarTermijnen(tx, 'org-voltvast', 'u-06', { activiteiten: 12 })
      const naKorter = await vervaltOverzicht(tx, 'org-voltvast', korter)
      const nogDaar = ((await tx.execute(sql`select count(*)::int as n from activiteiten where id in ('act-oud-1', 'act-oud-2')`)).rows[0] as any).n
      const audit = (await tx.execute(sql`select changes from audit_events where action = 'privacy.bewaartermijnen'`)).rows as any[]
      const ongeldig = await fout(() => bewaarTermijnen(tx, 'org-voltvast', 'u-06', { activiteiten: 7 }))
      return { standaard, naKorter, nogDaar, audit, ongeldig }
    })
    expect(r.standaard.find((v) => v.soort === 'activiteiten')!.aantal).toBe(1)
    expect(r.naKorter.find((v) => v.soort === 'activiteiten')!.aantal).toBe(2)
    expect(r.naKorter.find((v) => v.soort === 'activiteiten')!.zin).toBe('Activiteiten: 2 zouden vervallen, ouder dan 1 jaar.')
    expect(r.nogDaar).toBe(2)
    expect(r.audit).toHaveLength(1)
    expect(r.audit[0].changes.naar.activiteiten).toBe(12)
    expect(r.ongeldig?.statusCode).toBe(422)
  })
})

describe('factuurgegevens en logo', () => {
  it('factuurgegevens: 422 met fouten per veld, daarna bewaard en teruggelezen', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      const f = await fout(() => bewaarFactuurgegevens(tx, 'org-voltvast', 'u-06', { bedrijfsnaam: '', postcode: 'x' }))
      await bewaarFactuurgegevens(tx, 'org-voltvast', 'u-06', { bedrijfsnaam: 'Testbedrijf Voltvast', adres: 'Teststraat 1', postcode: '1234ab', plaats: 'Teststad', land: 'NL', kvk: '12345678', btw: 'NL123456789B01', email: 'facturen@voltvast.test' })
      const terug = await leesFactuurInstelling(tx)
      await zet(tx, 'org-tweede')
      const ander = await leesFactuurInstelling(tx)
      return { f, terug, ander }
    })
    expect(r.f?.statusCode).toBe(422)
    expect(Object.keys(r.f?.data?.fouten ?? {})).toEqual(expect.arrayContaining(['bedrijfsnaam', 'postcode', 'email']))
    expect(r.terug).toMatchObject({ postcode: '1234 AB', email: 'facturen@voltvast.test' })
    expect(r.ander).toBeNull()
  })

  it('logo: een ander bestandstype geeft 415, een png wordt bewaard en vervangt het vorige', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const r = await inOrg('org-voltvast', async (tx) => {
      const gif = await fout(() => bewaarLogo(tx, 'org-voltvast', 'u-06', Buffer.from('GIF89a......')))
      const eerste = await bewaarLogo(tx, 'org-voltvast', 'u-06', png)
      const tweede = await bewaarLogo(tx, 'org-voltvast', 'u-06', png)
      const bijlagen = ((await tx.execute(sql`select count(*)::int as n from bijlagen where record_soort = 'organisatie' and naam = 'logo'`)).rows[0] as any).n
      const gelezen = await leesLogo(tx)
      await verwijderLogo(tx, 'org-voltvast', 'u-06')
      return { gif, eerste, tweede, bijlagen, gelezen, na: await leesLogo(tx) }
    })
    expect(r.gif?.statusCode).toBe(415)
    expect(r.eerste.bijlageId).not.toBe(r.tweede.bijlageId)
    expect(r.bijlagen).toBe(1)
    expect(r.gelezen?.bijlageId).toBe(r.tweede.bijlageId)
    expect(r.na).toBeNull()
  })
})
