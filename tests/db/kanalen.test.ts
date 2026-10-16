// P26 op databaseniveau: de verzender (kanalen per soort, in de app uit = verborgen, stille uren, rijmodus
// en daarna gebundeld), WhatsApp (zonder opt-in geblokkeerd door de Bewaker, met opt-in via de mock en in de
// activiteitenlog, frequentieplafond, opt-out via de webhook), een uitgezet kanaal, en RLS op de sjablonen.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { verzendMeldingen } = await import('../../server/utils/meldingVerzender')
const { MELDING_POSTVAK } = await import('../../server/utils/mailer')
const wa = await import('../../server/utils/whatsapp')
const { WA_MOCK_POSTVAK } = await import('../../server/utils/bronnen/whatsapp')
const { versleutel } = await import('../../server/utils/geheimen')
const { toets } = await import('../../server/utils/agents/bewaker')

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
// Een fout binnen de transactie zonder hem te vergiftigen: eerst een savepoint, dan pas de belofte.
async function fout(tx: any, p: () => Promise<unknown>) {
  await tx.execute(sql`savepoint t`)
  try { await p(); await tx.execute(sql`release savepoint t`); return null } catch (e: any) { await tx.execute(sql`rollback to savepoint t`); return e }
}
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 }) })
afterAll(async () => { await pool.end() })

const ORG = 'org-voltvast'
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
// Dinsdag 10:00 en 20:00 in Nederland.
const OVERDAG = new Date('2026-10-13T08:00:00Z')
const AVOND = new Date('2026-10-13T18:00:00Z')
const melding = async (tx: any, soort: string, titel: string, gebruiker = 'u-01', op = new Date('2026-10-13T07:00:00Z')) => {
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, op, data) values (${id}, ${ORG}, ${gebruiker}, ${soort}, ${titel}, ${op.toISOString()}, '{}'::jsonb)`)
  return id
}
const kanalen = (tx: any, id: string) => rij(tx, sql`select kanalen_verstuurd as k, verborgen_op from notificaties where id = ${id}`)

describe('de verzender', () => {
  it('per soort: mail waar gekozen, in de app uit is verborgen', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update notificaties set kanalen_verstuurd = '{}'::jsonb where kanalen_verstuurd is null`)
      await tx.execute(sql`insert into persoonlijke_instellingen (id, organisation_id, data) values ('u-01', ${ORG}, ${JSON.stringify({ kanalen: { hot: { email: true }, inzicht: { inApp: false } } })}::jsonb)
        on conflict (id) do update set data = excluded.data`)
      const hot = await melding(tx, 'hot', 'Hete aanleiding: Testbedrijf Kabel')
      const inz = await melding(tx, 'inzicht', 'Je belt vaker op dinsdag')
      const voor = MELDING_POSTVAK.length
      const t = await verzendMeldingen(tx, ORG, OVERDAG)
      expect((await kanalen(tx, hot)).k).toEqual({ inApp: true, email: true, push: true })
      expect((await kanalen(tx, inz)).verborgen_op).not.toBeNull()
      expect(MELDING_POSTVAK.slice(voor).map((m) => m.onderwerp)).toEqual(['Hete aanleiding: Testbedrijf Kabel'])
      expect(t.verborgen).toBe(1)
      // Een tweede ronde doet niets meer.
      expect((await verzendMeldingen(tx, ORG, OVERDAG)).inApp).toBe(0)
    })
  })
  it('stille uren: push wacht tot erna; rijmodus houdt vast en daarna komt één gebundelde push', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update notificaties set kanalen_verstuurd = '{}'::jsonb where kanalen_verstuurd is null`)
      const a = await melding(tx, 'herinnering', 'Herinnering: offerte nabellen', 'u-02', AVOND)
      expect((await verzendMeldingen(tx, ORG, new Date(AVOND.getTime() + 60_000))).wacht).toBe(1)
      expect((await kanalen(tx, a)).k).toBeNull()
      await tx.execute(sql`update users set data = jsonb_set(data, '{rijmodus}', '{"aan": true}'::jsonb) where id = 'u-02'`)
      const b = await melding(tx, 'hot', 'Hete aanleiding: Testbouw Noord', 'u-02', OVERDAG)
      const morgen = new Date('2026-10-14T08:00:00Z')
      expect((await verzendMeldingen(tx, ORG, morgen)).wacht).toBe(2)
      await tx.execute(sql`update users set data = data - 'rijmodus' where id = 'u-02'`)
      const t = await verzendMeldingen(tx, ORG, morgen)
      expect(t.gebundeld).toBe(1)
      expect((await kanalen(tx, b)).k).toMatchObject({ push: true, gebundeld: true })
    })
  })
})

describe('WhatsApp', () => {
  const opzet = async (tx: any) => {
    await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (${ORG}, 'whatsapp', 'actief', ${versleutel({ webhookGeheim: 'test-geheim' }, 'whatsapp')}, '{"modus": "mock"}'::jsonb)`)
    const [s] = await rijen(tx, sql`insert into whatsapp_sjablonen (organisation_id, naam, taal, tekst) values (${ORG}, 'eerste_contact', 'nl', 'Hoi, {{1}}') returning id`)
    expect((await wa.dienIn(tx, ORG, s.id)).status).toBe('goedgekeurd')
    const [c] = await rijen(tx, sql`insert into contacts (organisation_id, account_id, last_name, rol, data) values (${ORG}, 'pr-06', 'Testcontact', 'beslisser', '{"mobiel": "+31612345001"}'::jsonb) returning id`)
    const concept = async () => {
      const id = crypto.randomUUID()
      await tx.execute(sql`insert into concepten (id, organisation_id, agent, handeling, gebruiker_id, account_id, concept, status) values (${id}, ${ORG}, 'schrijver', 'pitstop:whatsapp', 'u-01', 'pr-06', '{"type": "whatsapp", "tekst": "Zullen we volgende week bellen?"}'::jsonb, 'goedgekeurd')`)
      return id
    }
    return { contactId: c.id as string, concept }
  }
  const anouk = { id: 'u-01', rol: 'accountmanager', niveau: 'gevorderd', data: {} }

  it('zonder opt-in houdt de Bewaker het tegen; met opt-in via de mock, in de log; een tweede binnen 3 werkdagen niet', async () => {
    await inOrg(ORG, async (tx) => {
      const o = await opzet(tx)
      const c1 = await o.concept()
      expect(await wa.verstuurWhatsapp(tx, ORG, anouk, c1, OVERDAG)).toEqual({ status: 'geblokkeerd', tekst: 'Geen consent voor WhatsApp' })
      expect((await rij(tx, sql`select count(*)::int n from agent_runs where agent = 'berichtgever' and uitkomst = 'geblokkeerd'`)).n).toBeGreaterThan(0)
      await tx.execute(sql`update contacts set data = data || '{"consent": {"whatsapp": {"status": "ja", "op": "2026-09-01", "bron": "beurs"}}}'::jsonb where id = ${o.contactId}`)
      const voor = WA_MOCK_POSTVAK.length
      expect((await wa.verstuurWhatsapp(tx, ORG, anouk, c1, OVERDAG)).status).toBe('verstuurd')
      expect(WA_MOCK_POSTVAK.slice(voor)).toMatchObject([{ nummer: '+31612345001', sjabloon: 'eerste_contact', variabelen: ['Zullen we volgende week bellen?'] }])
      expect(await rij(tx, sql`select kanaal, uitkomst from activiteiten where account_id = 'pr-06' and kanaal = 'whatsapp'`)).toEqual({ kanaal: 'whatsapp', uitkomst: 'verzonden' })
      const c2 = await o.concept()
      expect((await wa.verstuurWhatsapp(tx, ORG, anouk, c2, new Date(OVERDAG.getTime() + 86_400_000))).tekst).toMatch(/Frequentieplafond/)
      expect((await fout(tx, () => wa.verstuurWhatsapp(tx, ORG, { ...anouk, id: 'u-02' }, c2, OVERDAG)))?.statusCode).toBe(403)
    })
  })
  it('een opt-out via de webhook zet de toestemming op nee, met datum en bron', async () => {
    await inOrg(ORG, async (tx) => {
      const o = await opzet(tx)
      await tx.execute(sql`update contacts set data = data || '{"consent": {"whatsapp": {"status": "ja"}}}'::jsonb where id = ${o.contactId}`)
      const r = await wa.verwerkWebhook(tx, { entry: [{ changes: [{ value: { messages: [{ id: 'wamid.x', from: '31612345001', text: { body: 'stop' } }] } }] }] }, OVERDAG)
      expect(r.optOuts).toBe(1)
      expect((await rij(tx, sql`select data->'consent'->'whatsapp' as w from contacts where id = ${o.contactId}`)).w).toEqual({ status: 'nee', op: OVERDAG.toISOString(), bron: 'opt-out via WhatsApp' })
      expect((await wa.waKoppeling(tx))!.webhookGeheim).toBe('test-geheim')
    })
  })
  it('sjablonen en berichten blijven in de eigen organisatie', async () => {
    await inOrg(ORG, async (tx) => { await opzet(tx); await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`); expect((await rij(tx, sql`select count(*)::int n from whatsapp_sjablonen`)).n).toBe(0) })
  })
})

describe('kanalen en consent', () => {
  it('een kanaal dat de beheerder uitzet, houdt de Bewaker tegen', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ORG}, 'kanalenUit', '["mail"]'::jsonb) on conflict (organisation_id, key) do update set value = excluded.value`)
      const t = await toets(tx, ORG, { agent: 'verzender', handeling: 'mail.versturen', gebruiker: { id: 'u-01', niveau: 'gevorderd', data: {} }, accountId: 'pr-06', kanaal: 'mail', naarBuiten: true } as any, OVERDAG)
      expect(t).toMatchObject({ mag: false, reden: 'Kanaal mail staat uit' })
    })
  })
  it('bel-me-niet met reden; de app-rol ziet alleen de eigen organisatie', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into bel_me_niet (organisation_id, telefoon_e164, door, reden) values (${ORG}, '+31612777000', 'u-06', 'Vroeg erom')`)
      expect((await rij(tx, sql`select reden from bel_me_niet where telefoon_e164 = '+31612777000'`)).reden).toBe('Vroeg erom')
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await rij(tx, sql`select count(*)::int n from bel_me_niet where telefoon_e164 = '+31612777000'`)).n).toBe(0)
    })
  })
})
