// P19 op databaseniveau: de Waarnemer met een mock-zoeker (inzicht met citaat, URL en datum; verzonnen
// URL en te oude bron tegengehouden; hooguit 25 accounts per regel; bijwerken laat gelezen staan), de
// Notulist (cc-02 en het namenfilter), de Verrijker (dossier-compleet, geen nummer zonder bron) en RLS.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { draaiWaarnemer } = await import('../../server/utils/agents/waarnemer')
const { onderzoekAccount } = await import('../../server/utils/agents/verrijker')
const { stelCommitteeVoor } = await import('../../server/utils/agents/profielbouwer')
const { planAfspraak, rondAfAfspraak } = await import('../../server/utils/agenda')
const { mockLog, MOCK_FIXTURES } = await import('../../server/utils/llm-provider')

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
afterEach(() => { for (const k of Object.keys(MOCK_FIXTURES)) delete MOCK_FIXTURES[k] })

const ORG = 'org-voltvast'
const rijen = async (tx: any, q: any) => (await tx.execute(q)).rows as any[]
const rij = async (tx: any, q: any) => (await rijen(tx, q))[0]
// Woensdag 10:00 in Nederland: binnen werkuren voor de Bewaker.
const nu = new Date('2026-10-14T08:00:00Z')
const datum = (dagen: number) => new Date(nu.getTime() - dagen * 864e5).toISOString().slice(0, 10)
const vacature = (dagen: number) => async (a: { naam: string }, regel: { soort: string }) => regel.soort !== 'vacature' ? [] : [{
  url: 'https://werkenbij.testplanning.test/vacatures/servicemonteur', titel: `Vacature servicemonteur bij ${a.naam}`, fragment: `${a.naam} zoekt een servicemonteur.`, datum: datum(dagen),
  tekst: `${a.naam} zoekt een servicemonteur voor de groeiende installatieafdeling. Het materiaal komt nu via Online webgroothandel.`,
}]

describe('Waarnemer', () => {
  it('een vacature wordt een inzicht met citaat, URL en datum; concurrent cc-02 wordt een signaal', async () => {
    await inOrg(ORG, async (tx) => {
      const r = await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-47'], zoeker: vacature(5) as any })
      expect(r).toMatchObject({ inzichten: 1, tegengehouden: 0, gestopt: null })
      const s = await rij(tx, sql`select status, agent, bron, relevance_score, data from signals where account_id = 'pl-47' and agent = 'waarnemer' and type = 'vacature'`)
      expect(s).toMatchObject({ status: 'nieuw', bron: 'extern', relevance_score: 85 })
      expect(s.data.evidence[0]).toMatchObject({ url: 'https://werkenbij.testplanning.test/vacatures/servicemonteur', datum: datum(5) })
      expect(s.data.evidence[0].citaat).toContain('zoekt een servicemonteur')
      expect(s.data.voorstel).toMatchObject({ priority: 'hoog' })
      expect((await rij(tx, sql`select title from signals where account_id = 'pl-47' and onderwerp = 'concurrent:cc-02'`)).title).toBe('Online webgroothandel genoemd bij Testplanning Installatie 47')
      expect(await rij(tx, sql`select uitkomst, mandaat_niveau from agent_runs where agent = 'waarnemer' and account_id = 'pl-47' and handeling = 'inzicht'`)).toMatchObject({ uitkomst: 'uitgevoerd', mandaat_niveau: 'A' })
    })
  })
  it('een verzonnen URL wordt tegengehouden; geen inzicht in de feed', async () => {
    await inOrg(ORG, async (tx) => {
      MOCK_FIXTURES.webonderzoek = [{ titel: 'Vacature', beschrijving: 'x', relevantie: 90, zekerheid: 90, evidence: [{ citaat: 'zoekt een servicemonteur', bron: 'Web', url: 'https://verzonnen.test/vacature' }] }]
      const r = await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-48'], zoeker: vacature(5) as any })
      expect(r).toMatchObject({ inzichten: 0, tegengehouden: 1 })
      const s = await rij(tx, sql`select status, data->>'tegenhoudReden' as reden from signals where account_id = 'pl-48' and type = 'vacature'`)
      expect(s).toEqual({ status: 'tegengehouden', reden: 'URL kwam niet uit de zoekresultaten' })
    })
  })
  it('een vacature van 121 dagen vervalt; van 31 dagen geen taakvoorstel', async () => {
    await inOrg(ORG, async (tx) => {
      await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-46'], zoeker: vacature(121) as any })
      expect((await rij(tx, sql`select data->>'tegenhoudReden' as r from signals where account_id = 'pl-46' and type = 'vacature'`)).r).toBe('Te oud: vacature ouder dan 120 dagen')
      await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-44'], zoeker: vacature(31) as any })
      const s = await rij(tx, sql`select status, data->'voorstel' as voorstel from signals where account_id = 'pl-44' and type = 'vacature'`)
      expect(s).toEqual({ status: 'nieuw', voorstel: null })
    })
  })
  it('hooguit 25 accounts per regel per run; een tweede run binnen de cadans doet niets', async () => {
    await inOrg(ORG, async (tx) => {
      const tel: Record<string, number> = {}
      const zoeker = async (_a: any, regel: { soort: string }) => { tel[regel.soort] = (tel[regel.soort] ?? 0) + 1; return [] }
      await draaiWaarnemer(tx, ORG, nu, { zoeker: zoeker as any })
      expect(tel.vacature).toBe(25)
      expect(tel.nieuws).toBe(25)
      const n = { ...tel }
      const r2 = await draaiWaarnemer(tx, ORG, nu, { zoeker: zoeker as any })
      expect(r2.bekeken).toBeGreaterThan(0)
      expect(tel.vacature! - n.vacature!).toBeLessThanOrEqual(25)
      // Wie in run 1 bekeken is, komt binnen 7 dagen niet terug.
      const dubbel = await rij(tx, sql`select count(*)::int n from accounts where data->'waarnemer'->>'vacature' is not null`)
      expect(dubbel.n).toBe(tel.vacature)
    })
  })
  it('een open inzicht dat de Waarnemer bijwerkt, blijft gelezen', async () => {
    await inOrg(ORG, async (tx) => {
      await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-47'], zoeker: vacature(5) as any })
      await tx.execute(sql`update signals set status = 'gelezen' where account_id = 'pl-47' and type = 'vacature'`)
      await tx.execute(sql`update accounts set data = data - 'waarnemer' where id = 'pl-47'`)
      await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-47'], zoeker: vacature(3) as any })
      const s = await rijen(tx, sql`select status, data->'bron'->>'datum' as d from signals where account_id = 'pl-47' and type = 'vacature'`)
      expect(s).toEqual([{ status: 'gelezen', d: datum(3) }])
    })
  })
  it('de Bewaker houdt de run tegen als het dagplafond voor webonderzoek op is', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${ORG}, 'agentCreditsPerSoort', '{"webonderzoek":0}'::jsonb) on conflict (organisation_id, key) do update set value = excluded.value`)
      const r = await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-47'], zoeker: vacature(5) as any })
      expect(r.bekeken).toBe(0)
      expect(r.gestopt).toBeTruthy()
      expect((await rij(tx, sql`select uitkomst from agent_runs where agent = 'waarnemer' and handeling = 'run'`)).uitkomst).toBe('geblokkeerd')
    })
  })
})

describe('Waarnemer: extra bronnen', () => {
  const geen = async () => []
  it('volgt de extra bronnen van account en contact; herkomst "Extra bron: <label>"; een ongewijzigde pagina kost geen AI', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update accounts set data = jsonb_set(data - 'waarnemer', '{volgBronnen}', ${JSON.stringify([{ soort: 'trefwoord', waarde: 'nieuwbouw' }, { soort: 'url', waarde: 'https://blog.testplanning47.test/nieuws', label: 'Blog van de directeur' }])}::jsonb) where id = 'pl-47'`)
      await tx.execute(sql`insert into contacts (id, organisation_id, account_id, first_name, last_name, data) values ('c-eb-1', ${ORG}, 'pl-47', 'Testa', 'Bronstra', ${JSON.stringify({ extraBronnen: [{ label: 'Profiel op de vakbeurs', url: 'https://beurs.voorbeeld.test/sprekers/bronstra' }] })}::jsonb)`)
      const paginas: Record<string, string> = {
        'https://blog.testplanning47.test/nieuws': 'Testplanning Installatie 47 opent in maart een tweede vestiging. De directeur zoekt een partner voor onderhoud.',
        'https://beurs.voorbeeld.test/sprekers/bronstra': 'Testa Bronstra spreekt op de vakbeurs over verduurzaming van bedrijfspanden.',
      }
      const gelezen: string[] = []
      const lezer = async (url: string, n: Date) => { gelezen.push(url); return paginas[url] ? { url, titel: 'Pagina', tekst: paginas[url]!, datum: n.toISOString().slice(0, 10) } : null }
      const voor = mockLog.length
      const r = await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-47'], zoeker: geen as any, bronLezer: lezer })
      expect(r).toMatchObject({ extraBronnen: 2, inzichten: 2, tegengehouden: 0, gestopt: null })
      expect(gelezen.sort()).toEqual(Object.keys(paginas).sort())
      const s = await rijen(tx, sql`select contact_id, type, status, data->'bron'->>'naam' as naam, data->'bron'->>'url' as url, data->'evidence'->0->>'bron' as bewijsbron from signals where account_id = 'pl-47' and onderwerp like 'extrabron:%' order by naam`)
      expect(s).toEqual([
        { contact_id: null, type: 'website', status: 'nieuw', naam: 'Extra bron: Blog van de directeur', url: 'https://blog.testplanning47.test/nieuws', bewijsbron: 'Extra bron: Blog van de directeur' },
        { contact_id: 'c-eb-1', type: 'website', status: 'nieuw', naam: 'Extra bron: Profiel op de vakbeurs', url: 'https://beurs.voorbeeld.test/sprekers/bronstra', bewijsbron: 'Extra bron: Profiel op de vakbeurs' },
      ])
      expect(mockLog.slice(voor).filter((l) => l.soort === 'webonderzoek')).toHaveLength(2)
      expect((await rij(tx, sql`select count(*)::int n from agent_runs where agent = 'waarnemer' and account_id = 'pl-47' and handeling = 'inzicht' and bronnen ? 'https://blog.testplanning47.test/nieuws'`)).n).toBe(1)

      // Binnen de cadans niets; daarna leest hij opnieuw, maar een ongewijzigde pagina kost geen AI-aanroep.
      expect((await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-47'], zoeker: geen as any, bronLezer: lezer })).extraBronnen).toBe(0)
      const later = new Date(nu.getTime() + 8 * 864e5)
      const n2 = mockLog.length
      expect((await draaiWaarnemer(tx, ORG, later, { accountIds: ['pl-47'], zoeker: geen as any, bronLezer: lezer })).extraBronnen).toBe(0)
      expect(mockLog.slice(n2).filter((l) => l.soort === 'webonderzoek')).toHaveLength(0)
      // Een gewijzigde pagina werkt het open inzicht bij.
      paginas['https://blog.testplanning47.test/nieuws'] = 'Testplanning Installatie 47 neemt een collega-installateur over. De directeur zoekt een partner voor onderhoud.'
      const r3 = await draaiWaarnemer(tx, ORG, new Date(later.getTime() + 8 * 864e5), { accountIds: ['pl-47'], zoeker: geen as any, bronLezer: lezer })
      expect(r3.extraBronnen).toBe(1)
      expect((await rij(tx, sql`select count(*)::int n, max(data->'evidence'->0->>'citaat') c from signals where account_id = 'pl-47' and onderwerp = 'extrabron:account:https://blog.testplanning47.test/nieuws'`))).toEqual({ n: 1, c: 'Testplanning Installatie 47 neemt een collega-installateur over.' })
    })
  })
  it('de standaardlezer gebruikt de mock van webBron', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update accounts set data = jsonb_set(data - 'waarnemer', '{volgBronnen}', ${JSON.stringify([{ soort: 'url', waarde: 'https://vacatures.testplanning48.test', label: 'Vacaturesite' }])}::jsonb) where id = 'pl-48'`)
      const r = await draaiWaarnemer(tx, ORG, nu, { accountIds: ['pl-48'], zoeker: (async () => []) as any })
      expect(r.extraBronnen).toBe(1)
      const s = await rij(tx, sql`select title, data->'bron'->>'naam' as naam from signals where account_id = 'pl-48' and onderwerp like 'extrabron:%'`)
      expect(s.naam).toBe('Extra bron: Vacaturesite')
    })
  })
})

describe('Notulist', () => {
  it('herkent cc-02 in het verslag; de contactnaam gaat niet mee naar de AI; actiepunten worden concepten', async () => {
    await inOrg(ORG, async (tx) => {
      const soort = (await rij(tx, sql`select id from meetingsoorten where slug = 'kennismaking'`)).id
      const c = await rij(tx, sql`select first_name, last_name, account_id, a.owner_id from contacts c join accounts a on a.id = c.account_id where c.id = 'pr-g39-c1'`)
      const ap = await planAfspraak(tx, ORG, { id: c.owner_id, naam: 'Eigenaar', rol: 'accountmanager', mag: { voorCollega: false } }, { accountId: c.account_id, meetingsoortId: soort, start: '2026-10-14T07:00:00Z' }, nu)
      const verslag = `${c.first_name} ${c.last_name} vertelde dat ze in 2027 een nieuwbouwproject starten. Het materiaal komt nu via Online webgroothandel. Ik ga volgende week een offerte sturen.`
      await rondAfAfspraak(tx, ORG, ap.id, c.owner_id, { uitkomst: 'vervolg', verslag }, nu)
      const s = await rij(tx, sql`select agent, title from signals where account_id = ${c.account_id} and onderwerp = 'concurrent:cc-02'`)
      expect(s).toEqual({ agent: 'notulist', title: 'Online webgroothandel genoemd in het verslag' })
      const aanroep = [...mockLog].reverse().find((l) => l.soort === 'notulist')!
      expect(JSON.stringify(aanroep.materiaal)).not.toContain(c.last_name)
      expect((await rij(tx, sql`select count(*)::int n from concepten where appointment_id = ${ap.id} and agent = 'notulist'`)).n).toBe(1)
      expect((await rij(tx, sql`select data->'notulist'->>'voorgesteldeUitkomst' as u from appointments where id = ${ap.id}`)).u).toBe('vervolg')
    })
  })
})

describe('Verrijker en Profielbouwer', () => {
  it('meldt dossier-compleet zodra alle zes criteria een oordeel hebben; geen nummer zonder bron', async () => {
    await inOrg(ORG, async (tx) => {
      MOCK_FIXTURES.dossier = [{ velden: [{ veld: 'telefoon', waarde: '010 000 0000' }, { veld: 'medewerkers', waarde: '40', bron: 'KvK' }], criteria: { branche: 'ja', omvang: 'ja', locatie: 'ja', leverancier: 'nee', aanleiding: 'ja', beslisser: 'nee' } }]
      const r = await onderzoekAccount(tx, ORG, 'pl-47', { gebruiker: { id: 'u-07', rol: 'accountmanager', niveau: 'expert', data: {} }, nu })
      expect(r).toMatchObject({ ok: true, compleet: true, velden: 1, geweigerd: 1 })
      const a = await rij(tx, sql`select fase_id, data->'dossier' as d from accounts where id = 'pl-47'`)
      expect(a.fase_id).toBe('dossier-compleet')
      expect(a.d.velden.map((v: any) => v.veld)).toEqual(['medewerkers'])
      expect(a.d.op).toBe(nu.toISOString())
    })
  })
  it('stelt het committee voor; zekerheid onder 60 is vermoedelijk', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`update contacts set data = data || '{"functie":"Werkvoorbereider"}'::jsonb where id = 'pr-g39-c1'`)
      await tx.execute(sql`update contacts set data = data || '{"functie":"Directeur"}'::jsonb where id = 'pr-g39-c2'`)
      const r = await stelCommitteeVoor(tx, ORG, { id: 'u-05', rol: 'accountmanager', niveau: 'gevorderd', data: {} }, 'pr-g39', nu)
      expect(r.voorstellen).toEqual(expect.arrayContaining([expect.objectContaining({ functie: 'directeur', rol: 'beslisser', vermoedelijk: false }), expect.objectContaining({ functie: 'werkvoorbereider', vermoedelijk: true })]))
    })
  })
})

describe('RLS', () => {
  it('een Waarnemer-profiel van organisatie A is onzichtbaar voor B', async () => {
    await inOrg(ORG, async (tx) => {
      await tx.execute(sql`insert into waarnemer_profielen (organisation_id, doelgroep_id, data) values (${ORG}, null, '{"cadansDagen":14,"signaalsoorten":[]}'::jsonb)`)
      expect((await rij(tx, sql`select count(*)::int n from waarnemer_profielen`)).n).toBe(1)
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      expect((await rij(tx, sql`select count(*)::int n from waarnemer_profielen`)).n).toBe(0)
      await expect(tx.execute(sql`insert into waarnemer_profielen (organisation_id, data) values (${ORG}, '{}'::jsonb)`)).rejects.toThrow()
    })
  })
})
