// P32: een fixturedag voor Vandaag op de telefoon (acceptatiecriterium 18). Fictief en relatief
// aan de dag van de seed: voor Lieke (u-05, buitendienst) drie afspraken, waarvan één eerste
// afspraak die nog bevestigd moet worden, vijf belacties (één achterstallig, twee uit het ritme)
// en een terugkomregel (hc-02, "Beslissing uitgesteld") die vandaag afloopt; voor Ruben (u-03,
// binnendienst) vijf belacties.
import type pg from 'pg'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'

export async function seedDag(client: pg.Client, orgId: string, nu = new Date()) {
  const vandaag = nlMoment(nu).datum
  const om = (uur: number, minuut = 0, dag = vandaag) => nlTijdstip(dag, uur, minuut).toISOString()
  const adressen: [string, string][] = [['pr-g39', 'Testlaan 12'], ['pr-g44', 'Proefweg 3'], ['pr-10', 'Voorbeeldstraat 40']]
  for (const [id, adres] of adressen) await client.query(`update accounts set data = data || $2 where id = $1 and organisation_id = $3`, [id, JSON.stringify({ adres }), orgId])
  const taken: [string, string, string, string, string, string, Record<string, unknown>][] = [
    // id, eigenaar, account, soort, titel, moment, data
    ['dag-a1', 'u-05', 'pr-g39', 'bezoek', 'Eerste afspraak: kennismaking en projectschouw', om(10), { soort: 'afspraak', duurMinuten: 60 }],
    ['dag-a2', 'u-05', 'pr-g44', 'bezoek', 'Afspraak: leverplan per bouwfase', om(13, 30), { soort: 'afspraak', duurMinuten: 60 }],
    ['dag-a3', 'u-05', 'pr-10', 'bezoek', 'Afspraak: renovatieproject bespreken', om(15, 30), { soort: 'afspraak', duurMinuten: 45 }],
    ['dag-t1', 'u-05', 'pr-g39', 'taak', 'Afspraak bevestigen met Testinstallatie Leidingdal', om(9), {}],
    ['dag-b1', 'u-05', 'pr-08', 'bellen', 'Bel over de onderhoudsplanning', om(9, 0, plusDagen(vandaag, -1)), {}],
    ['dag-b2', 'u-05', 'pr-09', 'bellen', 'Bel: tweede poging na de mail', om(11), { poging: { n: 2, van: 4, kanaal: 'bellen', vorige: 'mail' } }],
    ['dag-b3', 'u-05', 'pr-11', 'bellen', 'Bel: eerste kennismaking', om(11, 30), { poging: { n: 1, van: 4, kanaal: 'bellen' } }],
    ['dag-b4', 'u-05', 'pr-12', 'bellen', 'Bel over het zonneproject', om(14, 30), {}],
    ['dag-b5', 'u-05', 'pr-g19', 'bellen', 'Bel terug op de vraag over levertijden', om(16), {}],
    ['dag-r1', 'u-03', 'pr-01', 'bellen', 'Bel: vervolg op de offerteaanvraag', om(9, 30), { poging: { n: 2, van: 4, kanaal: 'bellen' } }],
    ['dag-r2', 'u-03', 'pr-03', 'bellen', 'Bel: eerste kennismaking', om(10), {}],
    ['dag-r3', 'u-03', 'pr-g03', 'bellen', 'Bel over de warmtepompen', om(10, 30), {}],
    ['dag-r4', 'u-03', 'pr-g28', 'bellen', 'Bel: isolatieproject', om(11), {}],
    ['dag-r5', 'u-03', 'pr-g43', 'bellen', 'Bel na het bezoek van de buitendienst', om(9, 0, plusDagen(vandaag, -2)), {}],
  ]
  for (const [id, eigenaar, account, soort, titel, moment, data] of taken) {
    await client.query(`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data)
      values ($1, $2, $3, $4, $5, $6, 'open', 'middel', $7, 'mens', $8) on conflict (id) do nothing`, [id, orgId, eigenaar, account, soort, titel, moment, JSON.stringify({ ...data, herkomst: { bron: 'seed' } })])
  }
  // De terugkomregel hc-02 loopt vandaag af bij een account van Lieke.
  await client.query(`update accounts set terug_op = $2, data = data || $3 where id = 'pr-g09' and organisation_id = $1`, [orgId, vandaag, JSON.stringify({ terugkom: { regelId: 'hc-02', reden: 'Beslissing uitgesteld' } })])
}
