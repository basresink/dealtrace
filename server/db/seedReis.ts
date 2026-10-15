// P05-testdata: afkoelperiodes, terugkomregels (tot P28 in org_settings), de
// standaardreis met fases, en een reden en terugkomdatum voor accounts op nee of
// wachtend. Idempotent; draait in de seed en bij elke Netlify-build.
import { CAMPAGNESOORTEN_START } from '../../shared/campagnes'
import type pg from 'pg'
import { AFKOELING_STANDAARD, afkoelingVoorNee } from '../../shared/nbStatus'
import { drizzle } from 'drizzle-orm/node-postgres'
import { terugkomDatum, verkoopverhaalUitSeed } from '../../shared/verkoopverhaal'
import { laadStartsetBevestigd } from '../utils/vvProjectie'
import * as schema from './schema'
import { zorgVoorReizen } from './reisStart'
import { zorgVoorBelscripts, zorgVoorMeetingsoorten, zorgVoorCampagnesoorten, zorgVoorRegels, zorgVoorRitmes } from './regelStart'
import { STARTSET_SCRIPTS } from '../../shared/belscripts'
import { MEETINGSOORTEN_START } from '../../shared/agenda'
import { RITMES_STARTSET, kiesRitme, startRitme, type Ritme } from '../../shared/hercontact'

export async function seedReis(client: Pick<pg.Client, 'query'>, orgId: string, voltvast: any) {
  for (const [o, key, value] of [[orgId, 'afkoeling', AFKOELING_STANDAARD], ['org-tweede', 'afkoeling', AFKOELING_STANDAARD]] as const) {
    await client.query(`insert into org_settings (organisation_id, key, value) values ($1, $2, $3) on conflict (organisation_id, key) do nothing`, [o, key, JSON.stringify(value)])
  }
  // P28: het verkoopverhaal van Voltvast als eigen inrichting uit de startset (Bijlage C), bevestigd.
  // Testorganisatie Tweede heeft een lege inrichting.
  const db = drizzle(client as any, { schema })
  const [heeft] = (await client.query(`select 1 from vv_sublagen where organisation_id = $1 limit 1`, [orgId])).rows
  if (!heeft) await laadStartsetBevestigd(db as any, orgId, voltvast.verkoopverhaal, 'u-06')
  const vv = verkoopverhaalUitSeed(voltvast.verkoopverhaal)
  // Vast geval voor de Bewaker (P08): een fictieve prospect in br-02 op nee met reden
  // "Geen behoefte" en een lopende afkoelperiode voor mail en bellen.
  const neeOp = new Date(Date.now() - 10 * 864e5).toISOString()
  const bewakerTerug = new Date(Date.parse(neeOp) + 180 * 864e5).toISOString().slice(0, 10)
  await client.query(`insert into accounts (id, organisation_id, name, account_kind, owner_id, nb_status, city, nb_bron, fase_sinds, vv_branche_id, terug_op, data)
    values ('acc-bewaker', $1, 'Installatiebedrijf Rietkraag BV', 'prospect', 'u-03', 'nee', 'Zwolle', 'handmatig', $2, 'br-02', $3, $4) on conflict (id) do nothing`,
    [orgId, neeOp, bewakerTerug, JSON.stringify({
      nee: { reden: 'Geen behoefte', op: neeOp, door: 'u-03', afkoeling: { ...AFKOELING_STANDAARD, mail: 60 } },
      terugkom: { datum: bewakerTerug, regelId: null, reden: 'Geen behoefte', aanpak: null, kanaal: 'bellen' },
    })])
  // P12: prospectplanning. De Voltvast-klassen A en B tellen als groot, C als middel; 50 extra
  // fictieve prospects van u-07, waarvan 36 grote zonder poging in het lopende verkoopjaar.
  await client.query(`insert into org_settings (organisation_id, key, value) values ($1, 'prospectplanning', $2) on conflict (organisation_id, key) do nothing`,
    [orgId, JSON.stringify({ startmaand: 1, vensters: { groot: 2, middel: 5, klein: 12 }, potentieBron: 'klasse', klassePotentie: { 'kl-a-prospects': 'groot', 'kl-b-prospects': 'groot', 'kl-c-prospects': 'middel' } })])
  const PLAATSEN = ['Zwolle', 'Assen', 'Groningen', 'Leeuwarden', 'Emmen', 'Meppel', 'Kampen', 'Deventer', 'Apeldoorn', 'Amersfoort']
  for (let i = 1; i <= 50; i++) {
    const klasse = i <= 18 ? 'kl-a-prospects' : i <= 36 ? 'kl-b-prospects' : i <= 46 ? 'kl-c-prospects' : null
    await client.query(`insert into accounts (id, organisation_id, name, account_kind, owner_id, nb_status, klasse, city, nb_bron, fase_sinds, vv_branche_id, data)
      values ($1, $2, $3, 'prospect', 'u-07', 'nieuw', $4, $5, 'import', now(), $6, '{"customFields": {}}') on conflict (id) do nothing`,
      [`pl-${String(i).padStart(2, '0')}`, orgId, `Testplanning Installatie ${String(i).padStart(2, '0')}`, klasse, PLAATSEN[i % PLAATSEN.length], i % 3 === 0 ? 'br-02' : 'br-01'])
  }
  await zorgVoorReizen(client)
  await zorgVoorRegels(client)
  await zorgVoorRitmes(client, RITMES_STARTSET)
  await zorgVoorBelscripts(client, STARTSET_SCRIPTS)
  await zorgVoorMeetingsoorten(client, MEETINGSOORTEN_START)
  await zorgVoorCampagnesoorten(client, CAMPAGNESOORTEN_START)
  // Prospects in Gekwalificeerd lopen in een hercontactritme (P07), poging 1 is nu aan de beurt.
  const ritmes = (await client.query(`select id, naam, bron, status, data from hercontactritmes where organisation_id = $1`, [orgId])).rows
    .map((r: any) => ({ id: r.id, naam: r.naam, bron: r.bron, status: r.status, werkplek: r.data.werkplek, stappen: r.data.stappen, parkeerDagen: r.data.parkeerDagen })) as Ritme[]
  const zonderRitme = (await client.query(`select a.id, u.werkplek from accounts a left join users u on u.id = a.owner_id
    where a.organisation_id = $1 and a.nb_status = 'in reis' and a.fase_id = 'gekwalificeerd' and not (a.data ? 'reis')`, [orgId])).rows as { id: string; werkplek: string | null }[]
  for (const a of zonderRitme) {
    const r = kiesRitme(ritmes, 'koud', (a.werkplek as any) ?? 'binnendienst')
    if (r) await client.query(`update accounts set data = data || $2 where id = $1`, [a.id, JSON.stringify({ reis: { ritme: startRitme(r, new Date()) } })])
  }
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
