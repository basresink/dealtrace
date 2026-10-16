// Fictief accountplan voor Testgebruiker Eva Ervaren (u-07, Expert): één actueel plan voor haar klant
// Testwarmte Harderwijk over het lopende jaar, met alle blokken, twee beslissers en drie acties als taak op
// het account (één klaar). Idempotent: vaste id's, on conflict do nothing. Wordt aangeroepen vanuit seedEva,
// met de datumhulpjes van die seed (werkdagen tussen 08:00 en 18:00).
import type pg from 'pg'

export async function seedAccountplannenEva(client: pg.Client, orgId: string, h: { vandaag: string; wd: (n: number) => string; om: (dag: string, uur: number, minuut?: number) => string }) {
  const jaar = h.vandaag.slice(0, 4)
  const secties = {
    klantinformatie: 'Installatiebedrijf met 28 monteurs in Harderwijk en omgeving, vooral onderhoud en vervanging bij woningcorporaties. Lotte Testharder (inkoop) beslist, Daan Testharder (magazijn) bepaalt wat er op voorraad ligt.',
    doelstellingen: 'Voor 31 december de winterlevering vastleggen voor alle onderhoudsbussen, en het aandeel van onze levering in het onderhoud verhogen van een kwart naar de helft van de bestellingen.',
    kansen: 'De corporatie in de regio start in het voorjaar met een vervangingsprogramma voor ketels. Het magazijn wil minder spoedbestellingen en vraagt om vaste leverdagen.',
    bedreigingen: 'Een tweede groothandel levert de bulkartikelen tegen een scherpe prijs. Bij late leveringen in de winter schuift inkoop snel door naar die leverancier.',
    strategieen: 'Eerst het magazijn ontzorgen met vaste leverdagen per bus, daarna met inkoop het voorstel voor de winterlevering bespreken. In elk gesprek de levertijden van vorig seizoen als bewijs gebruiken.',
    evaluatie: '',
  }
  const r = await client.query(
    `insert into accountplannen (id, organisation_id, account_id, owner_id, titel, status, geldig_van, geldig_tot, data, door, created_at, updated_at)
     values ('eva-plan-01', $1, 'eva-k01', 'u-07', $2, 'actueel', $3, $4, $5, 'u-07', $6, $6) on conflict do nothing`,
    [orgId, `Accountplan ${jaar}: winterlevering`, `${jaar}-01-01`, `${jaar}-12-31`, JSON.stringify({ secties, contactIds: ['eva-k01-c1', 'eva-k01-c2'] }), h.om(h.wd(-15), 9)],
  )
  if (!r.rowCount) return 0
  const ACTIES: [string, string, number, number, string | null, boolean][] = [
    ['eva-tplan-01', 'Jaargesprek plannen met inkoop', -5, 10, 'eva-k01-c1', true],
    ['eva-tplan-02', 'Voorstel winterlevering sturen', 3, 10, 'eva-k01-c1', false],
    ['eva-tplan-03', 'Magazijn inventariseren voor vaste leverdagen', 12, 14, 'eva-k01-c2', false],
  ]
  for (const [id, titel, dag, uur, contact, klaar] of ACTIES) {
    await client.query(
      `insert into tasks (id, organisation_id, owner_id, account_id, contact_id, accountplan_id, action_type, title, status, priority, due_date, executor, data, updated_at)
       values ($1, $2, 'u-07', 'eva-k01', $3, 'eva-plan-01', 'taak', $4, $5, 'middel', $6, 'mens', $7, $8) on conflict do nothing`,
      [id, orgId, contact, titel, klaar ? 'klaar' : 'open', h.om(h.wd(dag), uur), JSON.stringify({ herkomst: { bron: 'accountplan', actiesoort: 'taak', uitvoerder: 'u-07' }, aanleiding: `Actieplan: Accountplan ${jaar}: winterlevering` }), klaar ? h.om(h.wd(dag), uur + 1) : h.om(h.wd(-15), 9)],
    )
  }
  return 1
}
