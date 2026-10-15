// P05-testdata: afkoelperiodes, terugkomregels (tot P28 in org_settings), de
// standaardreis met fases, en een reden en terugkomdatum voor accounts op nee of
// wachtend. Idempotent; draait in de seed en bij elke Netlify-build.
import type pg from 'pg'
import { AFKOELING_STANDAARD, afkoelingVoorNee } from '../../shared/nbStatus'
import { terugkomDatum, verkoopverhaalUitSeed } from '../../shared/verkoopverhaal'
import { zorgVoorReizen } from './reisStart'

export async function seedReis(client: Pick<pg.Client, 'query'>, orgId: string, voltvast: any) {
  const vv = verkoopverhaalUitSeed(voltvast.verkoopverhaal)
  for (const [o, key, value] of [
    [orgId, 'afkoeling', AFKOELING_STANDAARD], [orgId, 'verkoopverhaal', vv], ['org-tweede', 'afkoeling', AFKOELING_STANDAARD],
  ] as const) {
    await client.query(`insert into org_settings (organisation_id, key, value) values ($1, $2, $3) on conflict (organisation_id, key) do nothing`, [o, key, JSON.stringify(value)])
  }
  await zorgVoorReizen(client)
  // Accounts op nee of wachtend krijgen een reden en een terugkomdatum, zoals na "Zet nee".
  const open = (await client.query(`select id, nb_status, fase_sinds, owner_id from accounts where organisation_id = $1 and nb_status in ('nee', 'wachtend') and terug_op is null`, [orgId])).rows
  for (const [i, a] of open.entries()) {
    const reden = a.nb_status === 'nee' ? ['Verkeerd moment', 'Tevreden met huidige leverancier', 'Geen budget'][i % 3]! : 'Geen reactie na laatste poging'
    const op = new Date(a.fase_sinds)
    const v = terugkomDatum(a.nb_status === 'nee' ? reden : 'Beslissing uitgesteld', vv, op, AFKOELING_STANDAARD)
    const extra = a.nb_status === 'nee'
      ? { nee: { reden, op: op.toISOString(), door: a.owner_id, afkoeling: afkoelingVoorNee(reden), ...(reden.startsWith('Tevreden') ? { verlorenAan: 'cc-05' } : {}) } }
      : { wachtendTot: v.datum }
    await client.query(`update accounts set terug_op = $2, terug_regel_id = $3, data = data || $4 where id = $1`,
      [a.id, v.datum, v.regel?.id ?? null, JSON.stringify({ ...extra, terugkom: { datum: v.datum, regelId: v.regel?.id ?? null, reden: v.regel?.reden ?? reden, aanpak: v.regel?.aanpak ?? null, kanaal: v.kanaal } })])
  }
}
