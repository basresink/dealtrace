// Fictieve kennisbank voor Testbedrijf Voltvast: vijf documenten als tekst of Markdown (zodat de AI de inhoud
// kan lezen), een paar gekoppeld aan prospects en een contact, de rest algemeen. Geen bestaande bedrijven; alle
// namen zijn testnamen. Idempotent: vaste id's, on conflict do nothing.
import type pg from 'pg'

const DOCS: { id: string; naam: string; type: string; versie: string; mime: string; eigenaar: string; beschrijving: string | null; dagenTerug: number; inhoud: string; accounts?: string[]; contacten?: [string, string][] }[] = [
  {
    id: 'kb-seed-01', naam: 'Case Testkolk Installatie: onderhoud op vaste dagen.md', type: 'case', versie: '1', mime: 'text/markdown', eigenaar: 'u-04', dagenTerug: 12,
    beschrijving: 'Hoe een installateur met twaalf monteurs zijn spoedbestellingen halveerde. Gebruik bij prospects met veel onderhoud.',
    inhoud: '# Case Testkolk Installatie\n\nTestkolk Installatie onderhoudt cv-ketels en warmtepompen voor drie woningcorporaties.\n\n## De vraag\n\nDe monteurs reden gemiddeld twee keer per week naar de groothandel voor spoedmateriaal.\n\n## De aanpak\n\nWe spraken vaste leverdagen af per bus en een vaste voorraad per monteur.\n\n## Het resultaat\n\nNa drie maanden daalden de spoedbestellingen met de helft. De planner bespaarde vier uur per week.',
    accounts: ['pr-01'],
  },
  {
    id: 'kb-seed-02', naam: 'Standaardofferte onderhoudscontract 2027.md', type: 'offerte', versie: '3', mime: 'text/markdown', eigenaar: 'u-06', dagenTerug: 4,
    beschrijving: 'De standaardofferte voor een onderhoudscontract met vaste leverdagen.',
    inhoud: '# Offerte onderhoudscontract 2027\n\nLooptijd: 36 maanden, daarna steeds een jaar verlengd.\n\nOpzegtermijn: drie maanden voor het einde van de looptijd.\n\nPrijs: vaste maandprijs per bus van 145 euro, inclusief twee vaste leverdagen per week.\n\nKorting: 5 procent bij meer dan tien bussen.',
  },
  {
    id: 'kb-seed-03', naam: 'Productinfo hybride warmtepomp.txt', type: 'productinfo', versie: '2', mime: 'text/plain', eigenaar: 'u-04', dagenTerug: 30,
    beschrijving: null,
    inhoud: 'Hybride warmtepomp voor bestaande woningen.\nVermogen 4 tot 8 kW, werkt samen met de bestaande cv-ketel.\nGeschikt voor woningen met energielabel C of beter.\nLevertijd uit voorraad: twee werkdagen.',
  },
  {
    id: 'kb-seed-04', naam: 'Prijslijst installatiemateriaal Q4.csv', type: 'prijslijst', versie: '1', mime: 'text/csv', eigenaar: 'u-06', dagenTerug: 20,
    beschrijving: 'Netto prijzen voor vaste klanten, geldig tot en met december.',
    inhoud: 'artikel;eenheid;prijs\nKoppeling 15 mm;doos van 10;12,40\nExpansievat 18 liter;stuk;38,95\nThermostaatkraan;stuk;21,10',
  },
  {
    id: 'kb-seed-05', naam: 'Presentatie eerste afspraak (tekst).md', type: 'presentatie', versie: '1', mime: 'text/markdown', eigenaar: 'u-04', dagenTerug: 2,
    beschrijving: 'De tekst van de vijf dia\'s voor een eerste afspraak.',
    inhoud: '# Eerste afspraak\n\n1. Wie wij zijn: een groothandel voor installateurs in de regio.\n2. Wat we horen: monteurs verliezen tijd met spoedbestellingen.\n3. Onze aanpak: vaste leverdagen per bus.\n4. Bewijs: de case van Testkolk Installatie.\n5. Voorstel: een proefperiode van zes weken.',
    accounts: ['pr-02'], contacten: [['pr-02', 'ct-03']],
  },
]

export async function seedKennisbank(client: pg.Client, orgId: string) {
  let n = 0
  for (const d of DOCS) {
    const inhoud = Buffer.from(d.inhoud, 'utf8')
    const op = new Date(Date.now() - d.dagenTerug * 864e5).toISOString()
    const r = await client.query(
      `insert into documenten (id, organisation_id, naam, type, versie, beschrijving, mime, grootte, inhoud, tekst, tekst_status, eigenaar_id, gemaakt_op, bijgewerkt_op)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'gelezen', $11, $12, $12) on conflict do nothing`,
      [d.id, orgId, d.naam, d.type, d.versie, d.beschrijving, d.mime, inhoud.length, inhoud, d.inhoud, d.eigenaar, op],
    )
    if (!r.rowCount) continue
    n++
    for (const a of d.accounts ?? []) {
      if ((await client.query('select 1 from accounts where id = $1', [a])).rowCount) await client.query('insert into document_koppelingen (organisation_id, document_id, account_id) values ($1, $2, $3) on conflict do nothing', [orgId, d.id, a])
    }
    for (const [a, c] of d.contacten ?? []) {
      if ((await client.query('select 1 from contacts where id = $1 and account_id = $2', [c, a])).rowCount) await client.query('insert into document_koppelingen (organisation_id, document_id, account_id, contact_id) values ($1, $2, $3, $4) on conflict do nothing', [orgId, d.id, a, c])
    }
  }
  return n
}
