// P16: campagnes voor Voltvast (Bijlage C). Een lopende koude belcampagne op br-01 met winpunt wp-01
// (30 accounts van Eva met een fictief nummer, verspreid over de kolommen) en een concept op br-03 voor de dekkingsmelding:
// br-03 heeft geen eigen verhaal of belofte. Taken staan er nog niet; het bord toont "Zet om naar taken".
import type pg from 'pg'
import { nlMoment, plusDagen } from '../../shared/datum'
import { CAMPAGNESOORTEN_START } from '../../shared/campagnes'

export async function seedCampagnes(client: pg.Client, orgId: string, nu = new Date()) {
  const vandaag = nlMoment(nu).datum
  const koud = CAMPAGNESOORTEN_START.find((s) => s.sleutel === 'koude-belcampagne')!
  const { rows: versies } = await client.query(`select onderdeel, versie from vv_sublagen where organisation_id = $1 and status = 'bevestigd'`, [orgId])
  const vvVersies = Object.fromEntries(versies.map((r) => [r.onderdeel, r.versie]))
  await client.query(`insert into campagnes (id, organisation_id, naam, soort, status, eigenaar_id, started_at, ends_at, data) values ('cp-01', $1, 'Koude belronde installateurs', 'koude-belcampagne', 'actief', 'u-07', $2, $3, $4) on conflict (id) do nothing`,
    [orgId, plusDagen(vandaag, -7), plusDagen(vandaag, 14), JSON.stringify({ winpuntId: 'wp-01', scriptId: null, boodschap: null, mailreeks: [], ritme: { bron: koud.ritme, pogingen: koud.pogingen }, tussendoelen: [], doel: koud.standaardDoel, capaciteit: null, verdeling: null, brancheId: 'br-01', jaarkeuze: null, varianten: [], vvVersies, bron: { soort: 'vrij' }, kanaalVia: 'direct', planStart: null })])
  const { rows: accounts } = await client.query(`select id from accounts where organisation_id = $1 and account_kind = 'prospect' and vv_branche_id = 'br-01' and owner_id = 'u-07' and not coalesce((data->'reis'->'ritme'->>'actief')::boolean, false) order by name limit 30`, [orgId])
  // Verdeling over de kolommen: 4 afspraak, 2 geparkeerd, 1 afgewezen, 5 in gesprek, 8 benaderd, de rest gespot.
  const plan: [string, number][] = [['afspraak', 4], ['geparkeerd', 2], ['afgewezen', 1], ['in-gesprek', 5], ['benaderd', 8]]
  let i = 0
  for (const a of accounts) {
    let kolom = 'gespot'
    let n = 0
    for (const [k, aantal] of plan) { if (i < n + aantal) { kolom = k; break } n += aantal }
    const poging = kolom === 'gespot' ? 0 : kolom === 'benaderd' ? 1 + (i % 2) : kolom === 'geparkeerd' ? koud.pogingen : 2
    // Een koude belcampagne start pas als 80 procent een nummer heeft (15.1); deze accounts krijgen een fictief nummer.
    await client.query(`update accounts set data = data || jsonb_build_object('telefoon', $2::text) where id = $1 and coalesce(data->>'telefoon', '') = ''`, [a.id, `+3185000${String(100 + i).padStart(4, '0')}`])
    await client.query(`insert into campagne_items (organisation_id, campagne_id, account_id, kolom, poging, eigenaar_id, einddoel_gehaald, winpunt_uitgevoerd) values ($1, 'cp-01', $2, $3, $4, 'u-07', $5, $6) on conflict (campagne_id, account_id) do nothing`,
      [orgId, a.id, kolom, poging, kolom === 'afspraak', kolom === 'afspraak' ? i !== 0 : null])
    i++
  }
  await client.query(`insert into campagnes (id, organisation_id, naam, soort, status, eigenaar_id, ends_at, data) values ('cp-02', $1, 'Woningcorporaties verkennen', 'bezoektour', 'concept', 'u-05', $2, $3) on conflict (id) do nothing`,
    [orgId, plusDagen(vandaag, 28), JSON.stringify({ winpuntId: null, ritme: { bron: 'koud', pogingen: 3 }, doel: { type: 'afspraken', waarde: 1 }, brancheId: 'br-03', varianten: [], vvVersies, bron: { soort: 'vrij' }, kanaalVia: 'direct' })])
  const { rows: br3 } = await client.query(`select id from accounts where organisation_id = $1 and vv_branche_id = 'br-03' order by name`, [orgId])
  for (const a of br3) await client.query(`insert into campagne_items (organisation_id, campagne_id, account_id, eigenaar_id) values ($1, 'cp-02', $2, 'u-05') on conflict (campagne_id, account_id) do nothing`, [orgId, a.id])
}
