// Dealtrace: regels aan de prospectreis en winpunten aan de activiteit, op databaseniveau. Een regel met een
// overgang in de reis als trigger en een gekoppeld winpunt maakt via de motor een taak met dat winpunt als
// aanleiding; de briefing en het belscript van die taak nemen hetzelfde winpunt. De droogloop noemt het
// winpunt per geraakt account. Elke test rolt terug.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { droogloop } from '../../shared/regelPatronen'

;(globalThis as any).createError ??= (o: { statusCode: number; statusMessage: string }) => Object.assign(new Error(o.statusMessage), o)
const m = await import('../../server/utils/motor')
const br = await import('../../server/utils/briefing')
const bel = await import('../../server/utils/bellen')

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
const rij = async (tx: any, q: any) => ((await tx.execute(q)).rows as any[])[0]
const NU = new Date('2026-10-14T08:00:00Z')

/** Eén prospect in de reis, net gekwalificeerd, zonder lopend ritme, van een gevorderde accountmanager; alle andere regels uit. */
async function zetKlaar(tx: any) {
  const a = await rij(tx, sql`select id, name from accounts where account_kind = 'prospect' and gedeactiveerd_op is null order by id limit 1`)
  await tx.execute(sql`select set_config('dealtrace.meldpunt', 'aan', true)`)
  await tx.execute(sql`update accounts set owner_id = 'u-01', nb_status = 'in reis', reis_id = 'reis-standaard-org-voltvast', fase_id = 'gekwalificeerd', fase_sinds = ${NU.toISOString()},
    data = (coalesce(data, '{}'::jsonb) - 'nee' - 'wachtendTot') #- '{reis,ritme}' where id = ${a.id}`)
  await tx.execute(sql`update contacts set data = coalesce(data, '{}'::jsonb) - 'belMeNiet' where account_id = ${a.id}`)
  await tx.execute(sql`insert into reisgeschiedenis (organisation_id, account_id, van_fase_id, naar_fase_id, gebeurtenis, door, op) values (${ORG}, ${a.id}, 'dossier-compleet', 'gekwalificeerd', 'gekwalificeerd', 'u-01', ${new Date(NU.getTime() - 3600e3).toISOString()})`)
  await tx.execute(sql`update activity_rules set actief = false`)
  const data = {
    omschrijving: 'Net gekwalificeerd: bel voor een kennismaking.', activiteit: 'taak', bron: 'intern',
    trigger: { patroon: 'reis-overgang', parameters: { vanFase: null, naarFase: 'gekwalificeerd', gebeurtenis: null } },
    afbakening: { accounttypes: ['prospect'], faseIds: ['gekwalificeerd'] },
    gevolg: { actiesoort: 'bellen', uitvoerderrol: 'eigenaar', termijnWerkdagen: 1, taaksjabloon: 'Bel {account} over {winpunt}', winpuntIds: ['wp-02'] },
  }
  const r = await rij(tx, sql`insert into activity_rules (organisation_id, naam, categorie, actief, cadans_dagen, prioriteit, reis_id, data) values (${ORG}, 'Na gekwalificeerd bellen', 'Bewerken', true, 0, 'hoog', 'reis-standaard-org-voltvast', ${JSON.stringify(data)}::jsonb) returning id`)
  return { accountId: a.id as string, naam: a.name as string, regelId: r.id as string }
}

describe('regels aan de prospectreis met winpunten', () => {
  it('de motor maakt een taak met het winpunt als aanleiding; briefing en belscript nemen hetzelfde winpunt', async () => {
    await inOrg(ORG, async (tx) => {
      const k = await zetKlaar(tx)
      // De gebeurtenisrun maakt ook de startactiviteiten van de fase; van deze regel precies één taak.
      await m.draaiMotor(tx, ORG, { soort: 'gebeurtenis', accountIds: [k.accountId], nu: NU })
      const tel = async () => (await rij(tx, sql`select count(*)::int as n from tasks where rule_id = ${k.regelId}`)).n
      expect(await tel()).toBe(1)
      const t = await rij(tx, sql`select id, title, data from tasks where rule_id = ${k.regelId} and account_id = ${k.accountId}`)
      expect(t.title).toBe(`Bel ${k.naam} over Levering op het uur`)
      expect(t.data.winpunt).toMatchObject({ id: 'wp-02', titel: 'Levering op het uur' })
      expect(t.data.aanleiding).toBe('Gespreksonderwerp: Levering op het uur')
      const b = await br.briefing(tx, { soort: 'taak', id: t.id })
      expect(b.winpuntId).toBe('wp-02')
      const scripts = await bel.laadScripts(tx)
      const [item] = await bel.belmodusItems(tx, { gebruiker: { id: 'u-01', naam: 'Testgebruiker Anouk', niveau: 'gevorderd', teamId: null }, organisatie: { naam: 'Testorganisatie' } },
        [{ accountId: k.accountId, accountNaam: k.naam, taskId: t.id } as any], { scripts })
      expect(item!.winpuntId).toBe('wp-02')
      expect(item!.waarden['winpunt.naam']).toBe('Levering op het uur')
      // Een tweede run maakt voor dezelfde overgang geen tweede taak.
      await m.draaiMotor(tx, ORG, { soort: 'gebeurtenis', accountIds: [k.accountId], nu: NU })
      expect(await tel()).toBe(1)
    })
  })

  it('de droogloop raakt de prospect met het winpunt; in een andere fase raakt hij niets', async () => {
    await inOrg(ORG, async (tx) => {
      const k = await zetKlaar(tx)
      const { invoer } = await m.laadMotorInvoer(tx, ORG, NU, [k.accountId])
      const regel = invoer.regels.find((r) => r.id === k.regelId)!
      const d = droogloop(regel, invoer.accounts, NU, { laatst: invoer.laatst, open: invoer.open }, undefined, {}, invoer.winpunten)
      expect(d.accounts).toEqual([expect.objectContaining({ id: k.accountId, winpuntId: 'wp-02', maaktTaak: true })])
      regel.data.afbakening.faseIds = ['benaderd']
      expect(droogloop(regel, invoer.accounts, NU, { laatst: invoer.laatst, open: invoer.open }, undefined, {}, invoer.winpunten).geraakt).toBe(0)
    })
  })
})
