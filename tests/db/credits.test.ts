// P33 op databaseniveau: de atomaire reservering (twintig vragen tegelijk bij 10 credits over),
// boeken en vrijgeven, 402 bij 0 en bij het plafond, de agentgrens, één melding bij 80 procent,
// gesprekken alleen in de eigen organisatie en de platformfunctie zonder berichten.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const { reserveer, boek, geefVrij, stand, verbruikGebruiker, ruimOp } = await import('../../server/utils/credits')
const { voerAiStapUit } = await import('../../server/utils/llm-provider')

let pool: pg.Pool
class Terug extends Error {}
async function inOrg<T>(org: string, werk: (tx: any) => Promise<T>, terug = true): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${org}, true)`)
    uit = await werk(tx)
    if (terug) throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
// Een vaste pot voor org-tweede: zo is "over" exact te sturen.
const zetPot = (tx: any, pot: number, verbruikt = 0) => tx.execute(sql`insert into org_settings (organisation_id, key, value) values ('org-tweede', 'aiCredits', ${JSON.stringify({ vastePot: pot, verbruikt })}::jsonb)
  on conflict (organisation_id, key) do update set value = excluded.value`)
beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 22 }) })
afterAll(async () => {
  await inOrg('org-tweede', async (tx) => { await tx.execute(sql`delete from ai_reserveringen`); await tx.execute(sql`delete from org_settings where key = 'aiCredits'`) }, false)
  await pool.end()
})

describe('AI-credits', () => {
  it('twintig gelijktijdige vragen bij 10 credits over: precies tien reserveringen, nooit onder 0', async () => {
    await inOrg('org-tweede', async (tx) => { await tx.execute(sql`delete from ai_reserveringen`); await zetPot(tx, 10) }, false)
    const uit = await Promise.allSettled(Array.from({ length: 20 }, () => inOrg('org-tweede', (tx) => reserveer(tx, 'org-tweede', { soort: 'assistent', gebruikerId: 'u-t2' }), false)))
    const gelukt = uit.filter((u) => u.status === 'fulfilled').length
    const geweigerd = uit.filter((u) => u.status === 'rejected').map((u: any) => u.reason?.statusCode)
    expect(gelukt).toBe(10)
    expect(geweigerd.every((c) => c === 402)).toBe(true)
    const s = await inOrg('org-tweede', (tx) => stand(tx, 'org-tweede'))
    expect(s.over).toBe(0)
    await inOrg('org-tweede', async (tx) => { await tx.execute(sql`delete from ai_reserveringen`); await tx.execute(sql`delete from org_settings where key = 'aiCredits'`) }, false)
  })

  it('reserveren, boeken en vrijgeven; een mislukte aanroep kost niets', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      const voor = await stand(tx, 'org-voltvast')
      const a = await reserveer(tx, 'org-voltvast', { soort: 'assistentUitgebreid', gebruikerId: 'u-02' })
      const tijdens = await stand(tx, 'org-voltvast')
      await boek(tx, a, { agent: 'gids' })
      const b = await reserveer(tx, 'org-voltvast', { soort: 'assistent', gebruikerId: 'u-02' })
      await geefVrij(tx, b)
      const na = await stand(tx, 'org-voltvast')
      const eigen = await verbruikGebruiker(tx, 'org-voltvast', 'u-02')
      return { voor, tijdens, na, eigen }
    })
    expect(r.tijdens.over).toBe(r.voor.over - 2)
    expect(r.na.verbruikt).toBe(r.voor.verbruikt + 2)
    expect(r.na.over).toBe(r.voor.over - 2)
    expect(r.eigen.verbruikt).toBeGreaterThanOrEqual(2)
  })

  it('0 credits: 402 met de schermtekst; belscript-AI weigert, de rest werkt door', async () => {
    const r = await inOrg('org-tweede', async (tx) => {
      await zetPot(tx, 100, 100)
      const e = await reserveer(tx, 'org-tweede', { soort: 'assistent', gebruikerId: 'u-t2' }).catch((x: any) => x)
      const stap = await voerAiStapUit(tx, 'org-tweede', { soort: 'assistent', prompt: 'x', schema: { type: 'object' }, materiaal: {}, gebruiker: { id: 'u-t2', niveau: 'beginner' } }).catch((x: any) => x)
      const taak = await tx.execute(sql`insert into tasks (organisation_id, owner_id, title, action_type) values ('org-tweede', 'u-t2', 'Gewoon werk', 'taak') returning id`)
      return { e, stap, taak: taak.rows.length }
    })
    expect(r.e.statusCode).toBe(402)
    expect(r.e.statusMessage).toBe('De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen.')
    expect(r.stap.statusCode).toBe(402)
    expect(r.taak).toBe(1)
  })

  it('plafond van 300: daarna 402 voor die gebruiker, een collega gaat door', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      await tx.execute(sql`insert into ai_credit_plafonds (organisation_id, gebruiker_id, plafond) values ('org-voltvast', 'u-02', 300)`)
      await tx.execute(sql`insert into agent_runs (organisation_id, agent, handeling, mandaat_niveau, uitkomst, gebruiker_id, kosten) values ('org-voltvast', 'gids', 'ai:assistent', 'A', 'uitgevoerd', 'u-02', ${JSON.stringify({ soort: 'assistent', credits: 300, door: 'gebruiker' })}::jsonb)`)
      const bram = await reserveer(tx, 'org-voltvast', { soort: 'assistent', gebruikerId: 'u-02' }).catch((x: any) => x)
      const sanne = await reserveer(tx, 'org-voltvast', { soort: 'assistent', gebruikerId: 'u-01' })
      return { bram, sanne }
    })
    expect(r.bram.statusCode).toBe(402)
    expect(r.bram.statusMessage).toBe('Je hebt je AI-credits voor deze maand gebruikt. Je beheerder kan je plafond verhogen.')
    expect(r.sanne.credits).toBe(1)
  })

  it('agentgrens bij 10 procent; een gebruiker gaat door', async () => {
    const r = await inOrg('org-tweede', async (tx) => {
      await zetPot(tx, 100, 90)
      const agent = await reserveer(tx, 'org-tweede', { soort: 'inzichtBeoordeling', automatisch: true }).catch((x: any) => x)
      const mens = await reserveer(tx, 'org-tweede', { soort: 'assistent', gebruikerId: 'u-t2' })
      return { agent, mens }
    })
    expect(r.agent.data.reden).toBe('agentgrens')
    expect(r.mens.credits).toBe(1)
  })

  it('80 procent: precies één melding per maand aan iedereen', async () => {
    const n = await inOrg('org-tweede', async (tx) => {
      await zetPot(tx, 100, 79)
      for (let i = 0; i < 3; i++) await boek(tx, await reserveer(tx, 'org-tweede', { soort: 'assistent', gebruikerId: 'u-t2' }), { agent: 'gids' })
      return (await tx.execute(sql`select count(*)::int n from notificaties where titel = 'AI-credits op 80 procent'`)).rows[0] as any
    })
    expect(n.n).toBe(2) // u-t1 en u-t2, één keer
  })

  it('gesprekken: een andere organisatie ziet ze niet; opruimen na 30 dagen', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      await tx.execute(sql`insert into ai_chats (id, organisation_id, gebruiker_id, verloopt_op) values ('chat-oud', 'org-voltvast', 'u-02', now() - interval '1 day'), ('chat-nieuw', 'org-voltvast', 'u-02', now() + interval '29 days')`)
      await tx.execute(sql`insert into ai_chat_berichten (organisation_id, chat_id, rol, tekst) values ('org-voltvast', 'chat-nieuw', 'gebruiker', 'Geheime vraag')`)
      const opruim = await ruimOp(tx)
      const over = (await tx.execute(sql`select id from ai_chats`)).rows.map((x: any) => x.id)
      await tx.execute(sql`select set_config('app.organisation_id', 'org-tweede', true)`)
      const ander = (await tx.execute(sql`select count(*)::int n from ai_chat_berichten`)).rows[0] as any
      return { opruim, over, ander: ander.n }
    })
    expect(r.opruim.chats).toBeGreaterThanOrEqual(1)
    expect(r.over).toContain('chat-nieuw')
    expect(r.over).not.toContain('chat-oud')
    expect(r.ander).toBe(0)
  })

  it('de app mag de prijs per handeling niet schrijven; de platformfunctie geeft tellingen, geen berichten', async () => {
    const r = await inOrg('org-voltvast', async (tx) => {
      const e = await tx.execute(sql`insert into credit_instellingen (sleutel, waarde) values ('prijs:assistent', 0)`).catch((x: any) => x)
      return String(e?.cause?.message ?? e?.message)
    })
    expect(r).toMatch(/permission denied/)
    const f = await inOrg('org-voltvast', (tx) => tx.execute(sql`select * from dealtrace_platform_credits()`).catch((x: any) => x))
    expect(String((f as any)?.cause?.message ?? (f as any)?.message)).toMatch(/permission denied/)
  })
})
