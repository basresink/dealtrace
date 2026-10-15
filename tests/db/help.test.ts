// P09 op databaseniveau: platform- en eigen artikelen (RLS), gelezen per organisatie,
// functies_per_niveau alleen via de platformrol, en een afwijking die alleen voor één
// organisatie geldt.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FUNCTIES, startindeling } from '../../shared/functies'

let app: pg.Client
let beheer: pg.Client
async function alsOrg<T>(org: string, werk: () => Promise<T>): Promise<T> {
  await app.query('begin')
  try { await app.query(`select set_config('app.organisation_id', $1, true)`, [org]); return await werk() } finally { await app.query('rollback') }
}
beforeAll(async () => {
  app = new pg.Client({ connectionString: process.env.TEST_APP_URL }); await app.connect()
  beheer = new pg.Client({ connectionString: process.env.TEST_BEHEER_URL }); await beheer.connect()
})
afterAll(async () => { await app.end(); await beheer.end() })

describe('helpcenter', () => {
  it('de platformartikelen staan erin, voor beide organisaties leesbaar', async () => {
    const n = (await beheer.query(`select count(*)::int n from help_artikelen where organisation_id is null`)).rows[0].n
    expect(n).toBeGreaterThanOrEqual(40)
    expect(await alsOrg('org-tweede', async () => (await app.query(`select count(*)::int n from help_artikelen`)).rows[0].n)).toBe(n)
  })
  it('een eigen artikel van A is onzichtbaar voor B; de app maakt geen platformartikel', async () => {
    await beheer.query(`insert into help_artikelen (organisation_id, categorie, slug, titel) values ('org-voltvast', 'Inrichten', 'alleen-voltvast', 'Alleen Voltvast') on conflict do nothing`)
    expect(await alsOrg('org-voltvast', async () => (await app.query(`select count(*)::int n from help_artikelen where slug = 'alleen-voltvast'`)).rows[0].n)).toBe(1)
    expect(await alsOrg('org-tweede', async () => (await app.query(`select count(*)::int n from help_artikelen where slug = 'alleen-voltvast'`)).rows[0].n)).toBe(0)
    await expect(alsOrg('org-voltvast', () => app.query(`insert into help_artikelen (organisation_id, categorie, slug, titel) values (null, 'x', 'nep', 'Nep')`))).rejects.toThrow(/row-level security/)
    await expect(alsOrg('org-voltvast', () => app.query(`update help_artikelen set titel = 'x' where organisation_id is null returning id`).then((r) => { if (r.rowCount) throw new Error('row-level security: platformartikel gewijzigd') }))).resolves.toBeUndefined()
  })
  it('gelezen en zoekopdrachten zijn per organisatie', async () => {
    const id = (await beheer.query(`select id from help_artikelen where slug = 'vandaag'`)).rows[0].id
    await beheer.query(`insert into help_gelezen (organisation_id, gebruiker_id, artikel_id) values ('org-voltvast', 'u-01', $1) on conflict do nothing`, [id])
    expect(await alsOrg('org-tweede', async () => (await app.query(`select count(*)::int n from help_gelezen`)).rows[0].n)).toBe(0)
    await expect(alsOrg('org-tweede', () => app.query(`insert into help_gelezen (organisation_id, gebruiker_id, artikel_id) values ('org-voltvast', 'u-01', $1)`, [id]))).rejects.toThrow(/row-level security/)
  })
  it('zoeken zonder accenten en hoofdletters vindt "poging"', async () => {
    const r = await alsOrg('org-voltvast', () => app.query(`select titel from help_artikelen where to_tsvector('dutch', dealtrace_zoektekst(titel || ' ' || coalesce(data->>'inhoud', ''))) @@ plainto_tsquery('dutch', dealtrace_zoektekst('Pógíng'))`))
    expect(r.rows.map((x) => x.titel)).toContain('Wat betekent poging 3 van 5')
  })
})

describe('features per niveau', () => {
  it('na de seed: drie rijen per catalogussleutel voor alle organisaties, Expert alles aan', async () => {
    const r = await beheer.query(`select functie, count(*)::int n, bool_and(aan) filter (where niveau = 'expert') expert from functies_per_niveau where organisation_id is null group by 1`)
    const per = new Map(r.rows.map((x) => [x.functie, x]))
    for (const s of new Set(startindeling().map((x) => x.functie))) {
      expect(per.get(s)?.n, s).toBe(3)
      expect(per.get(s)?.expert, s).toBe(true)
    }
    expect(per.size).toBe(FUNCTIES.filter((f) => !(f.rollen !== 'iedereen' && f.rollen.every((x) => x === 'founder'))).length)
  })
  it('de app schrijft functies_per_niveau nooit; de platformrol wel', async () => {
    await expect(alsOrg('org-voltvast', () => app.query(`insert into functies_per_niveau (functie, niveau, aan, organisation_id) values ('nav.funnel', 'beginner', false, 'org-voltvast')`))).rejects.toThrow(/permission denied/)
    await expect(alsOrg('org-voltvast', () => app.query(`update functies_per_niveau set aan = true`))).rejects.toThrow(/permission denied/)
  })
  it('een afwijking voor Voltvast geldt alleen voor Voltvast', async () => {
    await app.query('begin')
    try {
      await app.query('set local role dealtrace_platform')
      await app.query(`insert into functies_per_niveau (functie, niveau, aan, organisation_id, gewijzigd_door) values ('nav.leadgenerator', 'beginner', true, 'org-voltvast', 'test')`)
      await app.query('reset role')
      await app.query(`select set_config('app.organisation_id', 'org-voltvast', true)`)
      const v = (await app.query(`select aan from functies_per_niveau where functie = 'nav.leadgenerator' and niveau = 'beginner' and organisation_id is not null`)).rows
      await app.query(`select set_config('app.organisation_id', 'org-tweede', true)`)
      const t = (await app.query(`select aan from functies_per_niveau where functie = 'nav.leadgenerator' and niveau = 'beginner' and organisation_id is not null`)).rows
      expect([v, t]).toEqual([[{ aan: true }], []])
    } finally { await app.query('rollback') }
  })
})
