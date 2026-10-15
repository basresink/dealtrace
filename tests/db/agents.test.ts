// P08 op databaseniveau: agent_runs (RLS, alleen toevoegen), platformmaxima alleen voor
// de platformrol, executor_status alleen bekende waarden, en de Bewaker met de
// mock-Verzender en de AI-schil op een echte database.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { CREDITS_OP_TEKST } from '../../shared/credits'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)

const { verstuurVervolgmail, verstuurGoedgekeurd } = await import('../../server/utils/agents/verzender')
const { MOCK_FIXTURES, mockLog, voerAiStapUit } = await import('../../server/utils/llm-provider')

let app: pg.Client
let beheer: pg.Client
let pool: pg.Pool
const NU = new Date('2026-10-14T08:00:00Z') // woensdag 10:00 in Nederland
class Terug extends Error {}

async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
/** Werk via drizzle als de app in Voltvast; alles wordt aan het eind teruggedraaid. */
async function inVoltvast<T>(werk: (tx: any) => Promise<T>): Promise<T> {
  const db = drizzle(pool, { schema })
  let uit: T
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', 'org-voltvast', true)`)
    uit = await werk(tx)
    throw new Terug()
  }).catch((e) => { if (!(e instanceof Terug)) throw e })
  return uit!
}
const gebruiker = async (tx: any, id: string) => {
  const r = (await tx.execute(sql`select id, niveau, data from users where id = ${id}`)).rows[0]
  return { id: r.id, niveau: r.niveau, data: r.data }
}
const inReis = async (tx: any) => (await tx.execute(sql`select id from accounts where nb_status = 'in reis' order by id limit 1`)).rows[0].id as string
const zet = (tx: any, key: string, value: unknown) => tx.execute(sql`insert into org_settings (organisation_id, key, value) values ('org-voltvast', ${key}, ${JSON.stringify(value)}::jsonb) on conflict (organisation_id, key) do update set value = excluded.value`)

beforeAll(async () => {
  app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect()
  beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect()
  pool = new pg.Pool({ connectionString: process.env.TEST_APP_URL, max: 2 })
})
afterAll(async () => { await app.end(); await beheer.end(); await pool.end() })

describe('agent_runs en mandaten', () => {
  it('agent_runs van A zijn onzichtbaar voor B; schrijven voor een andere organisatie kan niet', async () => {
    await beheer.query(`insert into agent_runs (organisation_id, agent, handeling, mandaat_niveau, uitkomst, reden) values ('org-voltvast', 'planner', 'x', 'A', 'geblokkeerd', 'Alleen Voltvast')`)
    expect(await alsOrg('org-tweede', async () => (await app.query(`select count(*)::int n from agent_runs`)).rows[0].n)).toBe(0)
    await expect(alsOrg('org-tweede', () => app.query(`insert into agent_runs (organisation_id, agent, handeling, mandaat_niveau, uitkomst) values ('org-voltvast', 'x', 'x', 'A', 'fout')`))).rejects.toThrow(/row-level security/)
  })
  it('agent_runs is alleen toevoegen', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`update agent_runs set reden = 'x'`))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', () => app.query(`delete from agent_runs`))).rejects.toThrow(/permission denied/)
  })
  it('platformmaxima: de app leest, alleen de platformrol schrijft', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`insert into platform_agentmaxima (agent, max_mandaat) values ('verzender', 'C')`))).rejects.toThrow(/permission denied/)
    await app.query('begin')
    await app.query('set local role dealtrace_platform')
    await app.query(`insert into platform_agentmaxima (agent, max_mandaat) values ('verzender', 'C') on conflict (agent) do update set max_mandaat = 'C'`)
    await app.query('rollback')
  })
  it('executor_status kent alleen de vier waarden die de code zet (gat 22)', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`insert into tasks (organisation_id, title, executor_status) values ('org-voltvast', 'x', 'wacht')`))).rejects.toThrow(/check constraint/)
    await alsOrg('org-voltvast', () => app.query(`insert into tasks (organisation_id, title, executor, executor_status) values ('org-voltvast', 'x', 'ai', 'concept-klaar')`))
  })
})

describe('de Bewaker met de mock-Verzender', () => {
  it('afkoelperiode: geblokkeerd met reden in agent_runs, geen taak en geen mail (vast geval Rietkraag)', async () => {
    const r = await inVoltvast(async (tx) => {
      const u = await gebruiker(tx, 'u-03')
      const af = await verstuurVervolgmail(tx, 'org-voltvast', { gebruiker: u, accountId: 'acc-bewaker', campagneGoedgekeurd: true, onderwerp: 'Vervolg', tekst: 'Hallo' }, NU)
      const runs = (await tx.execute(sql`select uitkomst, reden, mandaat_niveau from agent_runs where account_id = 'acc-bewaker'`)).rows
      const taken = (await tx.execute(sql`select count(*)::int n from tasks where account_id = 'acc-bewaker'`)).rows[0].n
      const mails = (await tx.execute(sql`select count(*)::int n from activiteiten where account_id = 'acc-bewaker' and agent = 'verzender'`)).rows[0].n
      return { af, runs, taken, mails }
    })
    expect(r.af.uitkomst).toBe('geblokkeerd')
    expect(r.runs).toEqual([{ uitkomst: 'geblokkeerd', reden: expect.stringMatching(/^Afkoelperiode mail tot \d+ \w+$/), mandaat_niveau: 'B' }])
    expect([r.taken, r.mails]).toEqual([0, 0])
  })
  it('Gevorderd binnen een goedgekeurde campagne: B, direct verstuurd met activiteit en agent_runs', async () => {
    const r = await inVoltvast(async (tx) => {
      const acc = await inReis(tx)
      const af = await verstuurVervolgmail(tx, 'org-voltvast', { gebruiker: await gebruiker(tx, 'u-01'), accountId: acc, campagneGoedgekeurd: true, onderwerp: 'Vervolg', tekst: 'Hallo' }, NU)
      const act = (await tx.execute(sql`select uitvoerder, agent, data->>'mandaat' as mandaat from activiteiten where account_id = ${acc} and agent = 'verzender'`)).rows
      return { af, act }
    })
    expect(r.af.uitkomst).toBe('uitgevoerd')
    expect(r.act).toEqual([{ uitvoerder: 'ai', agent: 'verzender', mandaat: 'B' }])
  })
  it('Beginner: elke mail als concept (C); buiten een campagne ook voor Gevorderd', async () => {
    const r = await inVoltvast(async (tx) => {
      const acc = await inReis(tx)
      const beginner = await verstuurVervolgmail(tx, 'org-voltvast', { gebruiker: await gebruiker(tx, 'u-02'), accountId: acc, campagneGoedgekeurd: true, onderwerp: 'A', tekst: 'x' }, NU)
      const buiten = await verstuurVervolgmail(tx, 'org-voltvast', { gebruiker: await gebruiker(tx, 'u-01'), accountId: acc, onderwerp: 'B', tekst: 'x' }, NU)
      const t = (await tx.execute(sql`select executor, executor_status, data->>'mandaat' as mandaat from tasks where id = ${beginner.taskId}`)).rows[0]
      return { beginner, buiten, t }
    })
    expect([r.beginner.uitkomst, r.buiten.uitkomst]).toEqual(['als_taak', 'als_taak'])
    expect(r.t).toEqual({ executor: 'ai', executor_status: 'concept-klaar', mandaat: 'C' })
  })
  it('Agents pauzeren: de volgende vervolgmail wordt een taak voor de mens; goedkeuren verstuurt hem', async () => {
    const r = await inVoltvast(async (tx) => {
      await zet(tx, 'agentenGepauzeerd', { sinds: NU.toISOString(), door: 'Test' })
      const acc = await inReis(tx)
      const af = await verstuurVervolgmail(tx, 'org-voltvast', { gebruiker: await gebruiker(tx, 'u-01'), accountId: acc, campagneGoedgekeurd: true, onderwerp: 'Na de pauze', tekst: 'x' }, NU)
      await tx.execute(sql`update tasks set executor_status = 'goedgekeurd' where id = ${af.taskId}`)
      const na = await verstuurGoedgekeurd(tx, 'org-voltvast', af.taskId!, NU)
      const t = (await tx.execute(sql`select status, executor_status from tasks where id = ${af.taskId}`)).rows[0]
      return { af, na, t }
    })
    expect(r.af).toMatchObject({ uitkomst: 'als_taak', toets: { mandaat: 'C' } })
    expect(r.na?.uitkomst).toBe('uitgevoerd')
    expect(r.t).toEqual({ status: 'klaar', executor_status: 'uitgevoerd' })
  })
  it('organisatiemandaat D zet de Verzender op altijd mens', async () => {
    const r = await inVoltvast(async (tx) => {
      await zet(tx, 'agentmandaten', { verzender: { mandaat: 'D' } })
      return verstuurVervolgmail(tx, 'org-voltvast', { gebruiker: await gebruiker(tx, 'u-07'), accountId: await inReis(tx), campagneGoedgekeurd: true, onderwerp: 'x', tekst: 'x' }, NU)
    })
    expect(r).toMatchObject({ uitkomst: 'als_taak', toets: { mandaat: 'D', uitvoering: 'als_taak_mens' } })
  })
})

describe('AI-credits en de AI-schil', () => {
  const schemaBrief = { type: 'object' as const, required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string' as const } } }
  it('pot op 0: een gebruiker krijgt 402 met de vaste melding, vóór de aanroep', async () => {
    const voor = mockLog.length
    const fout = await inVoltvast(async (tx) => {
      await zet(tx, 'aiCredits', { vastePot: 0 })
      return voerAiStapUit(tx, 'org-voltvast', { soort: 'assistent', prompt: 'x', schema: schemaBrief, materiaal: {} }, NU).then(() => null, (e) => e)
    })
    expect(fout).toMatchObject({ statusCode: 402, statusMessage: CREDITS_OP_TEKST })
    expect(mockLog.length).toBe(voor)
  })
  it('een agent onder 10 procent: tegengehouden en gelogd; de motor draait door', async () => {
    const r = await inVoltvast(async (tx) => {
      await zet(tx, 'aiCredits', { vastePot: 100, verbruikt: 91 })
      const u = await voerAiStapUit(tx, 'org-voltvast', { soort: 'brief', prompt: 'x', schema: schemaBrief, materiaal: {}, agent: 'verrijker', accountId: await inReis(tx) }, NU)
      const runs = (await tx.execute(sql`select uitkomst, reden from agent_runs where agent = 'verrijker'`)).rows
      return { u, runs }
    })
    expect(r.u).toEqual({ ok: false, reden: 'Minder dan 10 procent AI-credits over' })
    expect(r.runs).toEqual([{ uitkomst: 'geblokkeerd', reden: 'Minder dan 10 procent AI-credits over' }])
  })
  it('geen geldig antwoord na twee pogingen: fout gelogd zonder kosten; privégegevens nooit naar de provider', async () => {
    MOCK_FIXTURES.notulist = [{ verkeerd: 1 }, { verkeerd: 2 }]
    const r = await inVoltvast(async (tx) => {
      await zet(tx, 'aiCredits', { vastePot: 10000 })
      const u = await voerAiStapUit(tx, 'org-voltvast', { soort: 'notulist', prompt: 'Vat samen', schema: schemaBrief, agent: 'notulist', materiaal: { notitie: 'Privé 06-11223344, mail piet@gmail.com', priveMobiel: '0611223344' } }, NU)
      const runs = (await tx.execute(sql`select uitkomst, kosten from agent_runs where agent = 'notulist'`)).rows
      return { u, runs }
    })
    expect(r.u.ok).toBe(false)
    expect(r.runs).toEqual([{ uitkomst: 'fout', kosten: null }])
    const gezien = JSON.stringify(mockLog.filter((m) => m.soort === 'notulist'))
    expect(gezien).toContain('[privémobiel]')
    expect(gezien).not.toMatch(/11223344|gmail/)
  })
})
