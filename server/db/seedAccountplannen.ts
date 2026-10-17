// Fictief accountplan voor Testgebruiker Eva Ervaren (u-07, Expert): één actueel plan voor haar topprospect
// Testtechniek Leusden over het lopende jaar, met alle blokken, twee beslissers en drie acties als taak op
// het account (één klaar). Een plan is voor een topprospect; plannen voor klanten horen in DealDrive. Idempotent: vaste id's, on conflict do nothing. Wordt aangeroepen vanuit seedEva,
// met de datumhulpjes van die seed (werkdagen tussen 08:00 en 18:00).
import type pg from 'pg'

export async function seedAccountplannenEva(client: pg.Client, orgId: string, h: { vandaag: string; wd: (n: number) => string; om: (dag: string, uur: number, minuut?: number) => string }) {
  const jaar = h.vandaag.slice(0, 4)
  const secties = {
    klantinformatie: 'Installatiebedrijf in Leusden en omgeving, vooral nieuwbouw en renovatie van scholen en kantoren. Corine Testleusden (directeur) beslist, Olaf Testleusden (projectleider) bepaalt wat er per bouwfase op de bouw moet zijn.',
    doelstellingen: 'Voor 31 december het eerste project binnen met een levering per bouwfase, en daarna een vaste leverafspraak voor de projecten van volgend jaar.',
    kansen: 'Er starten in het voorjaar twee renovaties van scholen in de regio. De projectleider wil minder wachttijd op de bouw en vraagt om levering per bouwfase.',
    bedreigingen: 'Hun huidige groothandel levert de bulkartikelen tegen een scherpe prijs. Zonder bewijs van betere levertijden blijft de directeur bij wat hij kent.',
    strategieen: 'Eerst de projectleider helpen met een leverplan per bouwfase voor één renovatie, daarna met de directeur het voorstel voor het eerste project bespreken. In elk gesprek de levertijden van vergelijkbare projecten als bewijs gebruiken.',
    evaluatie: '',
  }
  const r = await client.query(
    `insert into accountplannen (id, organisation_id, account_id, owner_id, titel, status, geldig_van, geldig_tot, data, door, created_at, updated_at)
     values ('eva-plan-01', $1, 'eva-a07', 'u-07', $2, 'actueel', $3, $4, $5, 'u-07', $6, $6) on conflict do nothing`,
    [orgId, `Accountplan ${jaar}: eerste project`, `${jaar}-01-01`, `${jaar}-12-31`, JSON.stringify({ secties, contactIds: ['eva-a07-c1', 'eva-a07-c2'] }), h.om(h.wd(-15), 9)],
  )
  if (!r.rowCount) return 0
  const ACTIES: [string, string, number, number, string | null, boolean][] = [
    ['eva-tplan-01', 'Kennismaking plannen met de directeur', -5, 10, 'eva-a07-c1', true],
    ['eva-tplan-02', 'Voorstel voor het eerste project sturen', 3, 10, 'eva-a07-c1', false],
    ['eva-tplan-03', 'Leverplan per bouwfase doornemen met de projectleider', 12, 14, 'eva-a07-c2', false],
  ]
  for (const [id, titel, dag, uur, contact, klaar] of ACTIES) {
    await client.query(
      `insert into tasks (id, organisation_id, owner_id, account_id, contact_id, accountplan_id, action_type, title, status, priority, due_date, executor, data, updated_at)
       values ($1, $2, 'u-07', 'eva-a07', $3, 'eva-plan-01', 'taak', $4, $5, 'middel', $6, 'mens', $7, $8) on conflict do nothing`,
      [id, orgId, contact, titel, klaar ? 'klaar' : 'open', h.om(h.wd(dag), uur), JSON.stringify({ herkomst: { bron: 'accountplan', actiesoort: 'taak', uitvoerder: 'u-07' }, aanleiding: `Actieplan: Accountplan ${jaar}: eerste project` }), klaar ? h.om(h.wd(dag), uur + 1) : h.om(h.wd(-15), 9)],
    )
  }
  return 1
}
