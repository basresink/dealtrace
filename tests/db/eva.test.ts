// De werkplek van testgebruiker Eva Ervaren (u-07) uit de seed (server/db/seedEva.ts): elke pagina
// gevuld voor de komende vier weken, alleen werkdagen tussen 08:00 en 18:00, een aanleiding van de dag
// op Vandaag, alleen fictieve gegevens, en een tweede seedronde verandert niets.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isWerkdag, nlMoment, plusDagen } from '../../shared/datum'
import { kiesAanleidingVanDeDag } from '../../shared/vandaag'
import { valideerBlokken } from '../../shared/belblokken'
import { seedEva } from '../../server/db/seedEva'

let beheer: pg.Client
beforeAll(async () => { beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect() })
afterAll(async () => { await beheer.end() })

const ORG = 'org-voltvast'
const rijen = async (q: string, p: unknown[] = []) => (await beheer.query(q, p)).rows as any[]
const nu = new Date()
let vandaag = nlMoment(nu).datum
while (!isWerkdag(vandaag, { bevrijdingsdag: 'lustrum' })) vandaag = plusDagen(vandaag, 1)
const dag = (t: string | Date) => nlMoment(new Date(t)).datum
const uur = (t: string | Date) => { const m = nlMoment(new Date(t)); return m.uur + m.minuut / 60 }

describe('Eva Ervaren (u-07) in de seed', () => {
  it('Vandaag: een aanleiding van de dag (85+, jonger dan 48 uur, eigen prospect) en meer prospect-signalen', async () => {
    const signalen = await rijen(`select id, account_id as "accountId", owner_id as "ownerId", status, relevance_score as "relevanceScore", created_at from signals where owner_id = 'u-07' and status in ('nieuw', 'gelezen')`)
    const eigen = new Set((await rijen(`select id from accounts where owner_id = 'u-07'`)).map((r) => r.id as string))
    const s = signalen.map((x) => ({ ...x, createdAt: new Date(x.created_at).toISOString() }))
    const aanleiding = kiesAanleidingVanDeDag(s, 'u-07', eigen, nu)
    expect(aanleiding?.accountId).toBe('eva-a06')
    const prospects = new Set((await rijen(`select id from accounts where owner_id = 'u-07' and account_kind = 'prospect'`)).map((r) => r.id as string))
    const recent = s.filter((x) => x.id !== aanleiding!.id && prospects.has(x.accountId) && Date.parse(x.createdAt) >= nu.getTime() - 48 * 3600e3)
    expect(new Set(recent.map((x) => x.accountId)).size).toBeGreaterThanOrEqual(3)
  })

  it('taken van elke soort, vandaag, achterstallig en verspreid over vier weken; alleen werkdagen tussen 08:00 en 18:00', async () => {
    const taken = await rijen(`select id, action_type, due_date, belblok_id from tasks where owner_id = 'u-07' and id like 'eva-t%' and status = 'open'`)
    expect(new Set(taken.map((t) => t.action_type))).toEqual(new Set(['bellen', 'mailen', 'bezoek', 'linkedin', 'bericht', 'taak']))
    expect(taken.filter((t) => dag(t.due_date) === vandaag).length).toBeGreaterThanOrEqual(6)
    expect(taken.filter((t) => dag(t.due_date) < vandaag).length).toBeGreaterThanOrEqual(3)
    expect(taken.some((t) => dag(t.due_date) >= plusDagen(vandaag, 25))).toBe(true)
    expect(taken.filter((t) => t.belblok_id).length).toBeGreaterThanOrEqual(5)
    for (const t of taken) {
      expect(isWerkdag(dag(t.due_date))).toBe(true)
      expect(uur(t.due_date)).toBeGreaterThanOrEqual(8)
      expect(uur(t.due_date)).toBeLessThanOrEqual(18)
    }
  })

  it('agenda: afspraken vandaag en later, in drie vormen en meerdere meetingsoorten, op werkdagen tussen 08:00 en 18:00', async () => {
    const afs = await rijen(`select a.vorm, a.status, a.start_at, a.end_at, m.slug from appointments a join meetingsoorten m on m.id = a.meetingsoort_id where a.owner_id = 'u-07'`)
    expect(afs.filter((a) => a.status === 'gepland' && dag(a.start_at) === vandaag).length).toBeGreaterThanOrEqual(3)
    expect(new Set(afs.map((a) => a.vorm))).toEqual(new Set(['bezoek', 'online', 'telefoon']))
    expect(new Set(afs.map((a) => a.slug)).size).toBeGreaterThanOrEqual(5)
    expect(afs.some((a) => a.status === 'gepland' && dag(a.start_at) >= plusDagen(vandaag, 21))).toBe(true)
    expect(afs.some((a) => a.status === 'afgerond')).toBe(true)
    for (const a of afs) {
      expect(isWerkdag(dag(a.start_at))).toBe(true)
      expect(uur(a.start_at)).toBeGreaterThanOrEqual(8)
      expect(uur(a.end_at)).toBeLessThanOrEqual(18)
    }
    // Eén afspraak plande Eva voor de buitendienst.
    expect((await rijen(`select 1 from appointments where gepland_door = 'u-07' and owner_id = 'u-02'`)).length).toBe(1)
  })

  it('belblokken: geldige vaste blokken, geplande sessies en gehouden blokken met resultaat', async () => {
    const [u] = await rijen(`select data from users where id = 'u-07'`)
    expect(valideerBlokken(u.data.belblokken.blokken)).toEqual([])
    const s = await rijen(`select status, data from belblok_sessies where gebruiker_id = 'u-07' and id like 'eva-bb-%'`)
    expect(s.filter((x) => x.status === 'gepland').length).toBeGreaterThanOrEqual(10)
    const klaar = s.filter((x) => x.status === 'klaar')
    expect(klaar.length).toBeGreaterThanOrEqual(4)
    expect(klaar.every((x) => x.data.resultaat?.gevoerd === x.data.gesprekken.length)).toBe(true)
  })

  it('accounts in elke fase van de reis met contactpersonen, activiteiten, concepten, meldingen, campagne, kansen en coaching', async () => {
    const acc = await rijen(`select a.id, a.fase_id, a.account_kind, (select count(*)::int from contacts c where c.account_id = a.id) as n from accounts a where a.id like 'eva-%'`)
    expect(new Set(acc.filter((a) => a.account_kind === 'prospect').map((a) => a.fase_id)).size).toBe(10)
    expect(acc.every((a) => a.n >= 1)).toBe(true)
    expect((await rijen(`select 1 from activiteiten where door = 'u-07' and op >= now() - interval '28 days'`)).length).toBeGreaterThanOrEqual(25)
    expect((await rijen(`select 1 from concepten where gebruiker_id = 'u-07' and status = 'klaar'`)).length).toBeGreaterThanOrEqual(4)
    expect((await rijen(`select 1 from notificaties where gebruiker_id = 'u-07' and gelezen_op is null`)).length).toBeGreaterThanOrEqual(5)
    expect((await rijen(`select 1 from campagne_items where campagne_id = 'cp-eva-01' and eigenaar_id = 'u-07'`)).length).toBeGreaterThanOrEqual(4)
    expect((await rijen(`select 1 from klaargezet_voor where van_gebruiker = 'u-07'`)).length).toBe(2)
    expect((await rijen(`select 1 from coaching_sessies where gebruiker_id = 'u-07'`)).length).toBe(1)
  })

  it('alleen fictieve gegevens: namen met Test, e-mail op .test, nummers +316120', async () => {
    const acc = await rijen(`select name, domein, data->>'telefoon' as tel from accounts where id like 'eva-%'`)
    expect(acc.every((a) => a.name.startsWith('Test') && a.domein.endsWith('.test') && /^\+316120\d{5}$/.test(a.tel))).toBe(true)
    const c = await rijen(`select email, data->>'telefoon' as tel from contacts where id like 'eva-%'`)
    expect(c.every((x) => x.email.endsWith('.test') && /^\+316120\d{5}$/.test(x.tel))).toBe(true)
    const teksten = JSON.stringify([
      await rijen(`select title, data from tasks where id like 'eva-%'`), await rijen(`select title, data from signals where id like 'eva-%'`),
      await rijen(`select concept from concepten where id like 'cr-eva-%'`), await rijen(`select titel, tekst from notificaties where id like 'm-eva-%'`),
    ])
    expect(teksten).not.toMatch(/[–—]/)
  })

  it('op elke dag van de week geseed: werkdagen, 08:00 tot 18:00 en vrij van de lunch en het dinsdagoverleg uit de agendamock', async () => {
    const weg = [
      `delete from appointments where id like 'eva-ap%'`, `delete from tasks where id like 'eva-t%'`, `delete from belblok_sessies where id like 'eva-bb-%'`,
      `delete from notificaties where id like 'm-eva-%'`, `delete from concepten where id like 'cr-eva-%'`, `delete from signals where id like 'eva-s%'`,
      `delete from klaargezet_voor where id like 'kz-eva-%'`, `delete from campagnes where id = 'cp-eva-01'`, `delete from coaching_notities where id = 'cn-eva-1'`,
      `delete from coaching_sessies where id = 'cs-eva-1'`, `delete from activiteiten where id like 'eva-%'`, `delete from accounts where id like 'eva-%'`,
    ]
    await beheer.query('begin')
    try {
      for (let i = 0; i < 7; i++) {
        const proef = new Date(Date.UTC(2026, 10, 2 + i, 6, 30)) // maandag 2 november 2026, 07:30 in Nederland, en de zes dagen daarna
        for (const q of weg) await beheer.query(q)
        await seedEva(beheer, ORG, proef)
        const bezet = [
          ...await rijen(`select start_at as s, end_at as e from appointments where id like 'eva-ap%' and status = 'gepland' and owner_id = 'u-07'`),
          ...await rijen(`select start_op as s, eind_op as e from belblok_sessies where id like 'eva-bb-%' and status = 'gepland'`),
        ]
        for (const b of bezet) {
          const d = dag(b.s); const s = uur(b.s); const e = uur(b.e)
          expect(isWerkdag(d)).toBe(true)
          expect(s).toBeGreaterThanOrEqual(8); expect(e).toBeLessThanOrEqual(18)
          expect(s < 12.5 && e > 12).toBe(false)
          if (new Date(`${d}T12:00:00Z`).getUTCDay() === 2) expect(s < 15 && e > 14).toBe(false)
        }
        const taken = await rijen(`select due_date from tasks where id like 'eva-t%'`)
        expect(taken.every((t) => isWerkdag(dag(t.due_date)) && uur(t.due_date) >= 8 && uur(t.due_date) <= 18)).toBe(true)
      }
    } finally { await beheer.query('rollback') }
  })

  it('een tweede seedronde voegt niets toe', async () => {
    const tel = async () => (await rijen(`select (select count(*) from accounts where id like 'eva-%')::int a, (select count(*) from tasks where owner_id = 'u-07')::int t,
      (select count(*) from appointments where gepland_door = 'u-07')::int p, (select count(*) from belblok_sessies where gebruiker_id = 'u-07')::int b,
      (select count(*) from activiteiten where door = 'u-07')::int x, (select count(*) from signals where owner_id = 'u-07')::int s, (select count(*) from reisgeschiedenis where account_id like 'eva-%')::int r`))[0]
    await beheer.query('begin')
    try {
      const voor = await tel()
      await seedEva(beheer, ORG)
      expect(await tel()).toEqual(voor)
    } finally { await beheer.query('rollback') }
  })
})
