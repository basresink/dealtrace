// P18 op databaseniveau: dezelfde soort voor elke ingang (gat 34), achterstallige taken, een import is
// geen contactmoment, de Pitstop (vvVersies, winpunt, namenfilter, 2 credits), besluiten met overname,
// versturen langs de Bewaker (afkoeling), de afmeldlink en de onderdrukkingslijst, en RLS.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const b = await import('../../server/utils/briefing')
const { MOCK_POSTVAK } = await import('../../server/utils/mail')
const { mockLog } = await import('../../server/utils/llm-provider')
const { emailHash } = await import('../../server/utils/importer')
const { zetNee } = await import('../../server/utils/reis')

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
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
const anouk = { id: 'u-01', rol: 'accountmanager', niveau: 'gevorderd', data: {} }
// Woensdag 10:00 in Nederland: binnen werkuren voor de Bewaker.
const WERKTIJD = new Date('2026-10-14T08:00:00Z')
const taak = async (tx: any, accountId: string, x: { due?: string; actie?: string; owner?: string } = {}) => {
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${id}, ${ORG}, ${x.owner ?? 'u-01'}, ${accountId}, ${x.actie ?? 'bellen'}, 'Testtaak', 'open', 'middel', ${x.due ?? new Date().toISOString()}, 'mens', '{}'::jsonb)`)
  return id
}

describe('soortbepaling (gat 34)', () => {
  it('afspraak, taak en account kiezen voor Vonkenburg alle drie Overdracht', async () => {
    await inOrg(ORG, async (tx) => {
      const a = await b.briefing(tx, { soort: 'afspraak', id: 'afs-vonkenburg' })
      const t = await b.briefing(tx, { soort: 'taak', id: 't-overdragen-vonkenburg' })
      const c = await b.briefing(tx, { soort: 'account', id: 'pr-02' })
      expect([a.soort, t.soort, c.soort]).toEqual(['overdracht', 'overdracht', 'overdracht'])
      expect(a.blokken.find((x) => x.sleutel === 'verslag')!.tekst).toMatch(/Twee nieuwbouwprojecten/)
    })
  })
  it('een achterstallige taak krijgt ook een briefing; een import maakt geen contactmoment', async () => {
    await inOrg(ORG, async (tx) => {
      const id = await taak(tx, 'pr-06', { due: '2026-09-01T09:00:00Z' })
      const voor = await b.briefing(tx, { soort: 'taak', id })
      await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, uitkomst, op, data) values (${ORG}, 'pr-06', 'import', 'gesproken', now(), '{}'::jsonb)`)
      const na = await b.briefing(tx, { soort: 'taak', id })
      expect(voor.blokken.length).toBeGreaterThan(0)
      expect(na.soort).toBe(voor.soort)
    })
  })
  it('eigen tekst wint en blijft bij het gesprek; de soort vastzetten', async () => {
    await inOrg(ORG, async (tx) => {
      const id = await taak(tx, 'pr-06')
      await b.bewaarTekst(tx, ORG, 'u-01', { soort: 'taak', id }, 'doel', 'Een kennismaking op locatie.')
      await b.bewaarTekst(tx, ORG, 'u-01', { soort: 'taak', id }, '_soort', 'verdieping')
      const x = await b.briefing(tx, { soort: 'taak', id })
      expect(x.soort).toBe('verdieping')
      expect(x.blokken.find((k) => k.sleutel === 'doel')).toMatchObject({ tekst: 'Een kennismaking op locatie.', herkomst: 'eigen' })
      await b.bewaarUitkomst(tx, { soort: 'taak', id }, { doel: 'deels', volgendeStap: 'Terugbellen' })
      expect((await b.briefing(tx, { soort: 'taak', id })).uitkomst).toMatchObject({ doel: 'deels', volgendeStap: 'Terugbellen' })
    })
  })
})

describe('Pitstop', () => {
  it('een mailconcept met één winpunt (niet wp-02), stijlscore 7 of hoger, binnen de grens, vvVersies, 2 credits; geen namen in de AI-aanroep', async () => {
    await inOrg(ORG, async (tx) => {
      const id = await taak(tx, 'pr-06', { actie: 'mailen' })
      const [c] = await rijen(tx, sql`select first_name, last_name from contacts where account_id = 'pr-06' limit 1`)
      await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, uitkomst, op, data) values (${ORG}, 'pr-06', 'gebeld', 'gesproken', now() - interval '2 days', ${JSON.stringify({ tekst: `${c.first_name} ${c.last_name} vroeg: wanneer kunnen jullie leveren?` })}::jsonb)`)
      const voor = (await rij(tx, sql`select coalesce(sum(credits), 0)::int as n from ai_reserveringen where status = 'geboekt'`)).n
      const r = await b.bereidVoor(tx, ORG, anouk, { soort: 'taak', id })
      expect(r.status).toBe('klaar')
      expect(r.concept).toMatchObject({ type: 'mail' })
      expect(r.concept!.winpuntId).toBeTruthy()
      expect(r.concept!.winpuntId).not.toBe('wp-02')
      expect(r.concept!.stijlscore).toBeGreaterThanOrEqual(7)
      expect(r.concept!.woorden).toBeLessThanOrEqual(120)
      expect(Object.keys(r.concept!.vvVersies).length).toBeGreaterThan(0)
      expect((await rij(tx, sql`select coalesce(sum(credits), 0)::int as n from ai_reserveringen where status = 'geboekt'`)).n - voor).toBe(2)
      const laatste = JSON.stringify(mockLog.at(-1)!.materiaal)
      expect(laatste).not.toContain(c.last_name)
      expect(laatste).toContain('wanneer kunnen jullie leveren?')
      expect((await rij(tx, sql`select status from concepten where id = ${r.id}`)).status).toBe('klaar')
      expect((await rij(tx, sql`select count(*)::int as n from agent_runs where handeling = 'pitstop:mail'`)).n).toBe(1)
    })
  })
  it('golden master per type: belscript, LinkedIn en bezoekbriefing volgen waarom, hoe, vraag', async () => {
    await inOrg(ORG, async (tx) => {
      const bel = await b.bereidVoor(tx, ORG, anouk, { soort: 'taak', id: await taak(tx, 'pr-06', { actie: 'bellen' }) })
      const li = await b.bereidVoor(tx, ORG, anouk, { soort: 'taak', id: await taak(tx, 'pr-06', { actie: 'linkedin' }) })
      const bz = await b.bereidVoor(tx, ORG, anouk, { soort: 'afspraak', id: 'afs-vonkenburg' })
      expect(bel.concept!.tekst).toMatch(/^Opening: .+\nWinpunt: .+\nVraag: Past een kwartier volgende week/)
      expect(li.concept!.tekst).toMatch(/^.+\. .+: .+\. Past een kwartier volgende week om te kijken of dit jullie monteurs tijd scheelt\?$/)
      expect(Object.keys(bz.concept!.blokken)).toEqual(['opening', 'winpunt'])
      // De AI-versie verschijnt in de briefing met het label "Door AI geschreven".
      expect((await b.briefing(tx, { soort: 'afspraak', id: 'afs-vonkenburg' })).blokken.some((k) => k.herkomst === 'ai')).toBe(true)
    })
  })
})

describe('concepten en mail', () => {
  it('goedkeuren met aanpassing legt de overname vast; daarna verwerpen: 409', async () => {
    await inOrg(ORG, async (tx) => {
      const c = await b.besluit(tx, anouk, 'cr-voicemail', { besluit: 'goedkeuren', tekst: 'Hoi, ik sprak je voicemail in. Bel je me terug?' })
      expect(c).toMatchObject({ status: 'goedgekeurd', overname: 'aangepast' })
      expect((await b.besluit(tx, anouk, 'cr-voicemail', { besluit: 'goedkeuren' })).status).toBe('goedgekeurd')
      expect((await b.besluit(tx, anouk, 'cr-voicemail', { besluit: 'verwerpen' }).catch((e: any) => e)).statusCode).toBe(409)
      expect((await b.besluit(tx, { id: 'u-02', rol: 'accountmanager' }, 'cr-voicemail', { besluit: 'goedkeuren' }).catch((e: any) => e)).statusCode).toBe(403)
    })
  })
  it('versturen: de eerste mail krijgt de afmeldlink; een afgemeld adres krijgt niets; in de afkoelperiode houdt de Bewaker hem tegen', async () => {
    await inOrg(ORG, async (tx) => {
      await b.besluit(tx, anouk, 'cr-voicemail', { besluit: 'goedkeuren' })
      const voor = MOCK_POSTVAK.length
      expect(await b.verstuurConcept(tx, ORG, anouk, 'cr-voicemail', 'https://app.test', WERKTIJD)).toMatchObject({ status: 'verstuurd' })
      const mail = MOCK_POSTVAK.at(-1)!
      expect(MOCK_POSTVAK.length).toBe(voor + 1)
      expect(mail.tekst).toMatch(/Meld je af: https:\/\/app\.test\/api\/afmelden\?o=org-voltvast&h=[a-f0-9]{64}&t=/)
      expect((await rij(tx, sql`select count(*)::int as n from activiteiten where account_id = 'pr-06' and soort = 'mail'`)).n).toBe(1)
      // Afgemeld: geen mail meer.
      await tx.execute(sql`update concepten set status = 'goedgekeurd' where id = 'cr-voicemail'`)
      await tx.execute(sql`insert into onderdrukkingslijst (organisation_id, email_hash, bron) values (${ORG}, ${emailHash(mail.aan)}, 'afgemeld')`)
      const afg = await b.verstuurConcept(tx, ORG, anouk, 'cr-voicemail', 'https://app.test', WERKTIJD).catch((e: any) => e)
      expect(afg.message).toBe('Dit adres heeft zich afgemeld en krijgt geen mail meer.')
      expect(afg.statusCode).toBe(403)
      expect(MOCK_POSTVAK.length).toBe(voor + 1)
    })
    await inOrg(ORG, async (tx) => {
      await b.besluit(tx, anouk, 'cr-voicemail', { besluit: 'goedkeuren' })
      await zetNee(tx, 'pr-06', { reden: 'Verkeerd moment', afkoeling: { mail: 30, bellen: 30 } }, 'u-01', WERKTIJD)
      const fout = await b.verstuurConcept(tx, ORG, anouk, 'cr-voicemail', 'https://app.test', WERKTIJD).catch((e: any) => e)
      expect(fout.statusCode).toBe(403)
      expect(fout.message).toMatch(/Afkoelperiode mail tot/)
      expect((await rij(tx, sql`select uitkomst, reden from agent_runs where agent = 'verzender' order by op desc limit 1`))).toMatchObject({ uitkomst: 'geblokkeerd' })
    })
  })
  it('de inbox: eigen concepten; de salesmanager met team ook die van zijn team', async () => {
    await inOrg(ORG, async (tx) => {
      expect((await b.concepten(tx, anouk)).map((c) => c.id)).toContain('cr-voicemail')
      expect((await b.concepten(tx, { id: 'u-02', rol: 'accountmanager' }, { team: true })).length).toBe(0)
      const joost = (await b.concepten(tx, { id: 'u-04', rol: 'salesmanager' }, { team: true })).map((c) => c.id)
      const anoukInTeam = (await rij(tx, sql`select count(*)::int as n from users u join teams t on t.id = u.team_id where u.id = 'u-01' and 'u-04' = any(t.manager_ids)`)).n > 0
      expect(joost.includes('cr-voicemail')).toBe(anoukInTeam)
    })
  })
  it('RLS: een andere organisatie ziet concepten, briefingteksten en sjablonen niet', async () => {
    await inOrg('org-tweede', async (tx) => {
      for (const t of ['concepten', 'briefing_teksten', 'mailsjablonen']) expect((await rij(tx, sql.raw(`select count(*)::int as n from ${t}`))).n).toBe(0)
    })
  })
})
