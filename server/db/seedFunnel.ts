// P17: testdata voor de funnel en de overdracht (Voltvast, fictief). Elk prospect krijgt een
// reisgeschiedenis die eindigt in zijn huidige fase (vóór de startstand uit reisStart), met af en toe
// een overgeslagen fase en bij Verloren een reden. Testinstallatie Vonkenburg (pr-02) had gisteren de
// eerste afspraak met vervolg en wacht op de overdracht.
import type pg from 'pg'
import { FUNNEL_FASES } from '../../shared/funnel'
import { NEE_REDENEN } from '../../shared/nbStatus'

const GEBEURTENIS: Record<string, string> = { gevonden: 'import', 'dossier-compleet': 'dossier-compleet', gekwalificeerd: 'gekwalificeerd', benaderd: 'eerste-contact', 'in-gesprek': 'gesprek-gevoerd', 'afspraak-gepland': 'eerste-afspraak-gepland', 'afspraak-gehouden': 'eerste-afspraak-gehouden', overgedragen: 'overgedragen' }

export async function seedFunnel(client: pg.Client, orgId: string, nu = new Date()) {
  const { rows } = await client.query(`select a.id, a.fase_id, a.data, g.op as sinds, g.id as gid from accounts a join reisgeschiedenis g on g.account_id = a.id and g.gebeurtenis = 'handmatig'
    where a.organisation_id = $1 and a.account_kind = 'prospect' order by a.id`, [orgId])
  for (const [i, a] of rows.entries()) {
    const eind = ['verloren', 'geparkeerd'].includes(a.fase_id)
    const tot = eind ? ['gekwalificeerd', 'benaderd', 'in-gesprek'][i % 3]! : a.fase_id
    const k = FUNNEL_FASES.indexOf(tot as any)
    if (k < 0) continue
    const pad = FUNNEL_FASES.slice(0, eind ? k + 1 : k).filter((f) => !(f === 'dossier-compleet' && i % 3 === 0))
    const stap = 2 + (i % 4)
    for (const [j, f] of pad.entries()) {
      const op = new Date(new Date(a.sinds).getTime() - (pad.length - j) * stap * 864e5)
      await client.query(`insert into reisgeschiedenis (organisation_id, account_id, versie, van_fase_id, naar_fase_id, naar_status, gebeurtenis, door, op) values ($1, $2, 1, $3, $4, 'in reis', $5, 'motor', $6)`,
        [orgId, a.id, j ? pad[j - 1] : null, f, GEBEURTENIS[f], op.toISOString()])
    }
    if (eind) await client.query(`update reisgeschiedenis set reden = $2 where id = $1`, [a.gid, a.fase_id === 'geparkeerd' ? 'Geen reactie na de laatste poging' : a.data?.nee?.reden ?? NEE_REDENEN[i % 4]])
  }

  // Testinstallatie Vonkenburg: eerste afspraak gisteren gehouden, vervolg afgesproken, nog niet overgedragen.
  const { rows: [ms] } = await client.query(`select id from meetingsoorten where organisation_id = $1 and slug = 'kennismaking'`, [orgId])
  const gisteren = new Date(nu.getTime() - 864e5)
  gisteren.setUTCHours(8, 0, 0, 0)
  const data = { herkomst: 'seed', overdragen: true, vervolgstap: 'Gratis projectschouw op locatie', verslag: { tekst: 'Twee nieuwbouwprojecten in 2027; de monteurs wachten nu vaak op materiaal. Marloes beslist samen met de werkvoorbereider.', bron: 'getypt', perAgendapunt: [] } }
  await client.query(`insert into appointments (id, organisation_id, owner_id, gepland_door, account_id, contact_id, meetingsoort_id, vorm, status, start_at, end_at, uitkomst_code, uitkomst_op, data)
    values ('afs-vonkenburg', $1, 'u-01', 'u-01', 'pr-02', 'ct-03', $2, 'bezoek', 'afgerond', $3, $4, 'vervolg', $4, $5) on conflict (id) do nothing`,
    [orgId, ms?.id, gisteren.toISOString(), new Date(gisteren.getTime() + 3600e3).toISOString(), JSON.stringify(data)])
  const { rowCount } = await client.query(`update accounts set fase_id = 'afspraak-gehouden', fase_sinds = $2 where id = $1 and fase_id = 'afspraak-gepland'`, ['pr-02', gisteren.toISOString()])
  if (rowCount) {
    await client.query(`insert into reisgeschiedenis (organisation_id, account_id, versie, van_fase_id, naar_fase_id, naar_status, gebeurtenis, door, op) values ($1, 'pr-02', 1, 'afspraak-gepland', 'afspraak-gehouden', 'gescoord', 'eerste-afspraak-gehouden', 'u-01', $2)`, [orgId, new Date(gisteren.getTime() + 3600e3).toISOString()])
    await client.query(`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values ('t-overdragen-vonkenburg', $1, 'u-01', 'pr-02', 'taak', 'Overdragen: Testinstallatie Vonkenburg (Gratis projectschouw op locatie)', 'open', 'middel', $2, 'mens', '{"herkomst": {"bron": "afspraak"}, "afspraakId": "afs-vonkenburg"}') on conflict (id) do nothing`, [orgId, nu.toISOString()])
  }
}
