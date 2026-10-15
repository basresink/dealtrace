// P14: gebieden en regiodagen voor Voltvast (Bijlage C.1): Regio Noord, Oost en Midden, met de
// buitendienst als eigenaar en vaste regiodagen. Elk account krijgt een punt (terugval op postcode
// of plaats) en een regio. Daarnaast twee bezoektaken en een kans die de binnendienst klaarzette.
import type pg from 'pg'
import { regioVan, type Regio } from '../../shared/gebieden'
import { geocodeerTerugval } from '../../shared/route'

export const REGIOS_VOLTVAST: Regio[] = [
  { id: 'regio-noord', naam: 'Regio Noord', reeksen: [{ van: 7800, tot: 7999 }, { van: 9000, tot: 9999 }], plaatsen: ['Groningen', 'Assen', 'Emmen', 'Hoogeveen', 'Meppel', 'Leeuwarden', 'Drachten'], eigenaren: { buitendienst: ['u-01', 'u-05'], binnendienst: ['u-03'] }, dagen: [{ gebruikerId: 'u-05', weekdag: 2, weken: 'alle' }, { gebruikerId: 'u-05', weekdag: 4, weken: 'alle' }, { gebruikerId: 'u-01', weekdag: 1, weken: 'alle' }, { gebruikerId: 'u-01', weekdag: 3, weken: 'alle' }] },
  { id: 'regio-oost', naam: 'Regio Oost', reeksen: [{ van: 7300, tot: 7499 }, { van: 8000, tot: 8299 }], plaatsen: ['Zwolle', 'Apeldoorn', 'Deventer', 'Kampen', 'Lelystad'], eigenaren: { buitendienst: ['u-02'], binnendienst: ['u-03'] }, dagen: [{ gebruikerId: 'u-02', weekdag: 2, weken: 'alle' }, { gebruikerId: 'u-02', weekdag: 4, weken: 'alle' }, { gebruikerId: 'u-05', weekdag: 1, weken: 'oneven' }] },
  { id: 'regio-midden', naam: 'Regio Midden', reeksen: [{ van: 3500, tot: 3999 }], plaatsen: ['Utrecht', 'Amersfoort', 'Zeist', 'Veenendaal', 'Harderwijk'], eigenaren: { buitendienst: ['u-02'], binnendienst: ['u-07'] }, dagen: [{ gebruikerId: 'u-02', weekdag: 1, weken: 'alle' }, { gebruikerId: 'u-05', weekdag: 5, weken: 'alle' }] },
]

export async function seedGebieden(client: pg.Client, orgId: string) {
  await client.query(`insert into org_settings (organisation_id, key, value) values ($1, 'gebieden', $2) on conflict (organisation_id, key) do nothing`, [orgId, JSON.stringify(REGIOS_VOLTVAST)])
  const { rows } = await client.query(`select id, postcode, city from accounts where organisation_id = $1`, [orgId])
  for (const a of rows) {
    const p = geocodeerTerugval({ postcode: a.postcode, plaats: a.city })
    const r = regioVan({ postcode: a.postcode, plaats: a.city }, REGIOS_VOLTVAST)
    await client.query(`update accounts set lat = coalesce(lat, $2), lng = coalesce(lng, $3), geo_bron = coalesce(geo_bron, $4), gebied_id = $5 where id = $1`, [a.id, p?.lat ?? null, p?.lng ?? null, p?.bron ?? null, r])
  }
  await client.query(`update users set data = data || '{"thuisbasis": {"lat": 52.51, "lng": 6.09, "plaats": "Zwolle"}}' where id = 'u-02' and not (data ? 'thuisbasis')`)
  const taken: [string, string, string][] = [['bz-1', 'pr-g29', 'Bezoek: kennismaken op locatie'], ['bz-2', 'pr-12', 'Bezoek: leverplan bespreken']]
  for (const [id, acc, titel] of taken) {
    await client.query(`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values ($1, $2, 'u-05', $3, 'bezoek', $4, 'open', 'middel', now() + interval '3 days', 'mens', '{"herkomst": {"bron": "seed"}}') on conflict (id) do nothing`, [id, orgId, acc, titel])
  }
  await client.query(`insert into klaargezet_voor (id, organisation_id, account_id, van_gebruiker, voor_gebruiker, regio_id, reden) values ('kz-1', $1, 'pr-08', 'u-03', 'u-05', 'regio-noord', 'Wil een monteur langs voor een offerte') on conflict (id) do nothing`, [orgId])
}
