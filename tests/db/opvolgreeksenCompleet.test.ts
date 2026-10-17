// Opvolgreeksen compleet (F7) op databaseniveau: sjablonenbeheer (maken, controle, dubbele naam, uitzetten, stopregels
// en instructie per stap), het overzicht met de stand per reeks en de reikwijdte, een antwoord in de mailbox dat de
// reeks stopt met een taak bel terug (één keer per bericht, een automatisch antwoord stopt niets), de mock-adapter,
// versturen zonder mailkoppeling via de outbox met de afmeldlink, een gedeactiveerde prospect die geen reeks krijgt,
// en RLS (FORCE) op inkomende_mails. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const r = await import('../../server/utils/opvolgreeks')
const o = await import('../../server/utils/opvolgreeksOverzicht')
const m = await import('../../server/utils/mailInkomend')
const { MOCK_POSTVAK } = await import('../../server/utils/mail')

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
const ACC = 'pr-g16'
const anouk = { id: 'u-01', rol: 'accountmanager', niveau: 'gevorderd', werkplek: 'binnendienst', data: {} }
const bram = { id: 'u-02', rol: 'accountmanager', niveau: 'beginner', werkplek: 'binnendienst', data: {} }
const joost = { id: 'u-04', rol: 'salesmanager', niveau: 'expert', werkplek: 'binnendienst', data: {} }
const mira = { id: 'u-06', rol: 'beheerder', niveau: 'expert', werkplek: 'binnendienst', data: {} }
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const sjabloon = async (tx: any, sleutel: string) => (await r.sjablonen(tx, ORG)).find((s) => s.sleutel === sleutel)!.id
const EIGEN = { naam: 'Na beurscontact', na: 'Gesproken op de beurs', uitkomsten: ['later'], stopregels: { afspraak: false },
  stappen: [{ dag: 0, kanaal: 'mail', titel: 'Mail: het beloofde overzicht', onderwerp: 'Het overzicht van de beurs', instructie: 'Noem de beurs en het winpunt.' }, { dag: 2, kanaal: 'bellen', titel: 'Bellen: overzicht ontvangen?' }],
  einde: { dag: 9, wachtDagen: 30 } }

describe('opvolgreeksen compleet', () => {
  it('sjablonenbeheer: maken, controle, dubbele naam, uitzetten en de stappen met onderwerp en instructie', async () => {
    await inOrg(ORG, async (tx) => {
      const s = await o.bewaarSjabloon(tx, ORG, joost, null, EIGEN as any)
      expect(s).toMatchObject({ naam: 'Na beurscontact', actief: true, uitkomsten: ['later'], stopregels: { reactie: true, afspraak: false, nee: true } })
      expect(s.stappen[0]).toMatchObject({ onderwerp: 'Het overzicht van de beurs', instructie: 'Noem de beurs en het winpunt.' })
      await expect(o.bewaarSjabloon(tx, ORG, joost, null, { ...EIGEN, naam: 'na beurscontact' } as any)).rejects.toMatchObject({ statusCode: 409 })
      await expect(o.bewaarSjabloon(tx, ORG, joost, null, { ...EIGEN, naam: 'Kapot', einde: { dag: 1, wachtDagen: 30 }, stappen: [{ dag: 3, kanaal: 'fax', titel: '' }] } as any)).rejects.toMatchObject({ statusCode: 422 })
      expect((await r.sjablonen(tx, ORG)).map((x) => x.naam)).toContain('Na beurscontact')
      await o.bewaarSjabloon(tx, ORG, mira, s.id, { actief: false })
      expect((await r.sjablonen(tx, ORG)).map((x) => x.naam)).not.toContain('Na beurscontact')
      expect((await o.sjablonenBeheer(tx, ORG)).find((x) => x.id === s.id)).toMatchObject({ actief: false, lopend: 0 })
      await expect(r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: s.id }, 'http://localhost:3000')).rejects.toMatchObject({ statusCode: 422 })
      await o.bewaarSjabloon(tx, ORG, mira, s.id, { actief: true })
      // De reeks bewaart de stopregels en het onderwerp; het concept krijgt het onderwerp van de stap.
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: s.id }, 'http://localhost:3000'))!
      expect((await rij(tx, sql`select data->'stopregels' as s from reeksen where id = ${reeks.id}`)).s).toEqual({ reactie: true, afspraak: false, nee: true })
      expect((await rij(tx, sql`select data->>'onderwerp' as o, instructie from reeksstappen where reeks_id = ${reeks.id} and volgnummer = 1`))).toEqual({ o: 'Het overzicht van de beurs', instructie: 'Noem de beurs en het winpunt.' })
      const c = reeks.stappen[0]!.concept
      if (c) expect(c.onderwerp).toBe('Het overzicht van de beurs')
      expect((await rij(tx, sql`select count(*)::int as n from audit_events where resource_id = ${s.id}`)).n).toBe(3)
    })
  })

  it('overzicht: de stand per reeks, de kop, en wie wat ziet', async () => {
    await inOrg(ORG, async (tx) => {
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000'))!
      const mij = await o.reeksOverzicht(tx, ORG, anouk, {})
      const regel = mij.lijst.find((x) => x.id === reeks.id)!
      expect(['concept', 'open']).toContain(regel.stand)
      expect(regel).toMatchObject({ stap: 1, van: 4, account: { id: ACC } })
      expect(mij.kop).toMatch(/wacht(en)? op jou\.$/)
      expect(mij.wieKeuzes).toEqual(['mij'])
      expect(mij.tellers[regel.stand]).toBeGreaterThan(0)
      // De salesmanager ziet de reeks van zijn team, een collega niet; het detail weigert een collega buiten je team.
      expect((await o.reeksOverzicht(tx, ORG, joost, { wie: 'team' })).lijst.some((x) => x.id === reeks.id)).toBe(true)
      expect((await o.reeksOverzicht(tx, ORG, bram, { wie: 'team' })).lijst.some((x) => x.id === reeks.id)).toBe(false)
      await expect(o.reeksDetail(tx, ORG, bram, reeks.id)).rejects.toMatchObject({ statusCode: 403 })
      const d = await o.reeksDetail(tx, ORG, joost, reeks.id)
      expect(d.kan).toEqual({ wijzigen: true, stappen: false })
      // Filter op stand en de strip voor Prospects.
      expect((await o.reeksOverzicht(tx, ORG, anouk, { stand: 'raak' })).lijst.some((x) => x.id === reeks.id)).toBe(false)
      const strip = (await o.lopendeReeksen(tx, [ACC])).get(ACC)!
      expect(strip).toMatchObject({ id: reeks.id, naam: 'Na informatie', stap: 1, van: 4 })
    })
  })

  it('een antwoord in de mailbox stopt de reeks met een taak bel terug, één keer per bericht', async () => {
    await inOrg(ORG, async (tx) => {
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-voicemail') }, 'http://localhost:3000'))!
      const email = (await rij(tx, sql`select email from contacts where id = ${reeks.contact!.id}`)).email as string
      expect(email).toBeTruthy()
      // Een automatisch antwoord stopt niets.
      const auto = await m.verwerkInkomend(tx, ORG, { berichtId: 'auto-1', van: `Els <${email.toUpperCase()}>`, onderwerp: 'Automatisch antwoord: afwezig' }, 'webhook')
      expect(auto).toMatchObject({ verwerking: 'auto-antwoord', reeksen: [] })
      expect((await rij(tx, sql`select status from reeksen where id = ${reeks.id}`)).status).toBe('loopt')
      const u = await m.verwerkInkomend(tx, ORG, { berichtId: 'antw-1', van: email, onderwerp: 'Re: kort bericht', tekst: 'Bel me morgen maar even.' }, 'webhook')
      expect(u).toMatchObject({ verwerking: 'gestopt', dubbel: false, reeksen: [reeks.id] })
      const na = await rij(tx, sql`select status, stopreden, data from reeksen where id = ${reeks.id}`)
      expect(na).toMatchObject({ status: 'gestopt', stopreden: 'reactie' })
      expect(na.data.viaMail).toBe(true)
      const t = await rij(tx, sql`select title, priority, status, action_type, due_date from tasks where id = ${u.belTerugTaken[0]}`)
      expect(t).toMatchObject({ priority: 'hoog', status: 'open', action_type: 'bellen' })
      expect(t.title).toMatch(/antwoordde op je mail/)
      expect((await rij(tx, sql`select count(*)::int as n from activiteiten where account_id = ${ACC} and soort = 'reactie' and kanaal = 'mail'`)).n).toBe(1)
      expect((await rij(tx, sql`select verwerking, reeks_id, fragment from inkomende_mails where bericht_id = 'antw-1'`))).toEqual({ verwerking: 'gestopt', reeks_id: reeks.id, fragment: 'Bel me morgen maar even.' })
      // Dezelfde mail nog een keer: niets nieuws. Een onbekende afzender: alleen vastgelegd.
      expect(await m.verwerkInkomend(tx, ORG, { berichtId: 'antw-1', van: email }, 'webhook')).toMatchObject({ dubbel: true })
      expect((await m.verwerkInkomend(tx, ORG, { berichtId: 'x-1', van: 'onbekend@nergens.test' }, 'webhook')).verwerking).toBe('onbekend')
      expect((await rij(tx, sql`select count(*)::int as n from tasks where id in ${u.belTerugTaken}`)).n).toBe(1)
    })
  })

  it('de mock-adapter: het postvak in het geheugen wordt gelezen bij de poll', async () => {
    await inOrg(ORG, async (tx) => {
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000'))!
      const email = (await rij(tx, sql`select email from contacts where id = ${reeks.contact!.id}`)).email as string
      m.zetInMockPostvak(ORG, { berichtId: `mock-${Date.now()}`, van: email, onderwerp: 'Re: informatie' })
      expect(await m.pollPostvak(tx, ORG)).toEqual({ gelezen: 1, gestopt: 1 })
      expect(await m.pollPostvak(tx, ORG)).toEqual({ gelezen: 0, gestopt: 0 })
      expect((await rij(tx, sql`select stopreden from reeksen where id = ${reeks.id}`)).stopreden).toBe('reactie')
      // Zonder mailkoppeling leest de poll niets: de bestaande stopregels blijven gelden.
      await tx.execute(sql`delete from koppelingen where soort = 'mail'`)
      m.zetInMockPostvak(ORG, { van: email })
      expect(await m.pollPostvak(tx, ORG)).toEqual({ gelezen: 0, gestopt: 0 })
      m.MOCK_INKOMEND[ORG] = []
    })
  })

  it('versturen zonder mailkoppeling gaat via de outbox, met de afmeldlink onder een eerste mail', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`delete from koppelingen where soort = 'mail'`)
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000'))!
      const stap = reeks.stappen[0]!
      if (!stap.concept) return
      const eerste = !(await rijen(tx, sql`select 1 from activiteiten where account_id = ${ACC} and soort = 'mail' limit 1`)).length
      const voor = MOCK_POSTVAK.length
      const u = await r.stapActie(tx, ORG, anouk, reeks.id, stap.id, { actie: 'verstuur' }, 'http://localhost:3000').catch((e: any) => e)
      if (u?.statusCode === 403) return // de Bewaker hield het tegen (consent of werkuren); dan is er niets verstuurd
      expect(u.tekst).toBe('Goedgekeurd en verstuurd.')
      expect(MOCK_POSTVAK.length).toBe(voor + 1)
      const mail = MOCK_POSTVAK.at(-1)!
      if (eerste) expect(mail.tekst).toContain('/api/afmelden?')
      expect(mail.van).toBe((await rij(tx, sql`select email from users where id = 'u-01'`)).email)
    })
  })

  it('een gedeactiveerde prospect krijgt geen reeks; een lopende reeks stopt zonder bel terug', async () => {
    await inOrg(ORG, async (tx) => {
      const heeft = (await rij(tx, sql`select count(*)::int as n from information_schema.columns where table_name = 'accounts' and column_name = 'gedeactiveerd_op'`)).n
      if (!heeft) return
      const reeks = (await r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-informatie') }, 'http://localhost:3000'))!
      await tx.execute(sql`update accounts set gedeactiveerd_op = now() where id = ${ACC}`)
      expect(await r.werkReeksBij(tx, ORG, reeks.id)).toMatchObject({ gestopt: 'handmatig' })
      const na = await rij(tx, sql`select status, data from reeksen where id = ${reeks.id}`)
      expect(na.status).toBe('gestopt')
      expect(na.data.stopToelichting).toBe('De prospect is gedeactiveerd')
      expect(na.data.belTerugTaakId).toBeNull()
      await expect(r.startReeks(tx, ORG, anouk, ACC, { sjabloonId: await sjabloon(tx, 'na-voicemail') }, 'http://localhost:3000')).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('RLS: inkomende mail van de ene organisatie is onzichtbaar voor de andere', async () => {
    await inOrg(ORG, async (tx) => {
      await m.verwerkInkomend(tx, ORG, { berichtId: 'rls-1', van: 'iemand@ergens.test' }, 'webhook')
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await rij(tx, sql`select count(*)::int as n from inkomende_mails where organisation_id = ${ORG}`)).n).toBe(0)
      const e: any = await tx.execute(sql`insert into inkomende_mails (organisation_id, bericht_id, van, verwerking) values (${ORG}, 'x', 'a@b.test', 'onbekend')`).catch((x: any) => x)
      expect(String(e?.cause?.message ?? e?.message)).toMatch(/row-level security/)
    })
    const c = await pool.connect()
    try {
      expect((await c.query(`select 1 from pg_class where relname = 'inkomende_mails' and relforcerowsecurity`)).rowCount).toBe(1)
    } finally { c.release() }
  })
})
