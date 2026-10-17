// Eva Ervaren (u-07): vier verloren prospects die deze week terug in beeld komen, zodat Terug in beeld
// meteen iets laat zien (over tijd, vandaag, nog in afkoeling, klaar om te starten). Fictief; de namen
// beginnen met Test. Idempotent: vaste id's, on conflict do nothing. Als sjabloon dient een bestaande
// prospect van Eva; ontbreekt die, dan gebeurt er niets.
import type pg from 'pg'
import { nlMoment, plusDagen } from '../../shared/datum'

const EVA = 'u-07'
const SJABLOON = 'pr-g10'

export async function seedEvaTerug(client: pg.Client, orgId: string, nu = new Date()): Promise<number> {
  if (!(await client.query(`select 1 from accounts where id = $1 and organisation_id = $2`, [SJABLOON, orgId])).rowCount) return 0
  const vandaag = nlMoment(nu).datum
  const dag = (n: number) => plusDagen(vandaag, n)
  const afkoeling = { mail: 60, kaart: 365, bellen: 90, bezoek: 180, linkedin: 90, whatsapp: 180 }
  const lijst = [
    { id: 'eva-t01', naam: 'Testinstallatie Weerzien', slug: 'weerzien', plaats: 'Houten', contact: ['Iris', 'Testweerzien'], reden: 'Verkeerd moment', regel: 'hc-02', verloren: -64, terug: -3 },
    { id: 'eva-t02', naam: 'Testtechniek Terugveld', slug: 'terugveld', plaats: 'Zeist', contact: ['Daan', 'Testveld'], reden: 'Verkeerd moment', regel: 'hc-02', verloren: -61, terug: 0 },
    { id: 'eva-t03', naam: 'Testklimaat Opnieuw', slug: 'klimaatopnieuw', plaats: 'Bunnik', contact: ['Fleur', 'Testnieuw'], reden: 'Verkeerd moment', regel: 'hc-02', verloren: -59, terug: 2 },
    { id: 'eva-t04', naam: 'Testenergie Tweede Kans', slug: 'tweedekans', plaats: 'Nieuwegein', contact: ['Ruben', 'Testkans'], reden: 'Tevreden met huidige leverancier', regel: 'hc-06', verloren: -360, terug: 5 },
  ]
  let n = 0
  for (const [i, p] of lijst.entries()) {
    const [voornaam = 'Test', achternaam = 'Testcontact'] = p.contact
    const { rows: [r] } = await client.query(`select extern_id, reden, aanpak, kanaal from vv_terugkomregels where organisation_id = $1 and extern_id = $2`, [orgId, p.regel])
    const kanaal = r?.kanaal === 'E-mail' ? 'mail' : r?.kanaal === 'Bezoek' ? 'bezoek' : 'bellen'
    const nee = { op: `${dag(p.verloren)}T15:00:00.000Z`, door: EVA, reden: p.reden, afkoeling }
    const terugkom = { datum: dag(p.terug), reden: r?.reden ?? p.reden, aanpak: r?.aanpak ?? null, kanaal, regelId: p.regel }
    const tel = (k: number) => `+3161200${String(k).padStart(4, '0')}`
    const res = await client.query(
      `insert into accounts select (jsonb_populate_record(null::accounts, to_jsonb(a) || jsonb_build_object(
          'id', $2::text, 'name', $3::text, 'city', $4::text, 'owner_id', $5::text, 'nb_status', 'nee', 'terug_op', $6::text, 'terug_regel_id', $7::text,
          'domein', $11::text, 'gedeactiveerd_op', null, 'created_at', $10::text, 'updated_at', $10::text,
          'data', a.data || jsonb_build_object('telefoon', $12::text, 'nee', $8::jsonb, 'terugkom', $9::jsonb)))).*
        from accounts a where a.id = $1 on conflict do nothing`,
      [SJABLOON, p.id, p.naam, p.plaats, EVA, dag(p.terug), p.regel, JSON.stringify(nee), JSON.stringify(terugkom), nee.op, `${p.slug}.test`, tel(900 + i)],
    )
    if (!res.rowCount) continue
    // Een contactpersoon en de inschrijving in de reis, zoals bij elke prospect van Eva.
    await client.query(
      `insert into contacts select (jsonb_populate_record(null::contacts, to_jsonb(c) || jsonb_build_object(
          'id', $2::text, 'account_id', $3::text, 'first_name', $4::text, 'last_name', $5::text, 'email', $6::text,
          'data', c.data || jsonb_build_object('telefoon', $7::text)))).*
        from contacts c where c.account_id = $1 order by c.id limit 1 on conflict do nothing`,
      [SJABLOON, `${p.id}-c1`, p.id, voornaam, achternaam, `${voornaam.toLowerCase()}@${p.slug}.test`, tel(950 + i)],
    )
    await client.query(
      `insert into prospectreizen select (jsonb_populate_record(null::prospectreizen, to_jsonb(r) || jsonb_build_object('id', $2::text, 'account_id', $3::text))).*
        from prospectreizen r where r.account_id = $1 limit 1 on conflict do nothing`,
      [SJABLOON, `${p.id}-reis`, p.id],
    )
    n += res.rowCount ?? 0
  }
  return n
}
