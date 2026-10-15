// P18: de mailkoppeling van Voltvast staat op de testmailbox (mock, er gaat geen echte mail uit), twee
// mailsjablonen en een opvolgmail na een voicemail die de Schrijver voor Anouk klaarzette (fictief).
import type pg from 'pg'

export async function seedConcepten(client: pg.Client, orgId: string, nu = new Date()) {
  await client.query(`insert into koppelingen (organisation_id, soort, status, instellingen, getest_op) values ($1, 'mail', 'actief', '{"modus": "mock", "van": "verkoop@voltvast.test", "naam": "Voltvast"}', now()) on conflict (organisation_id, soort) do nothing`, [orgId])
  const sjablonen: [string, string, string, string][] = [
    ['sj-kennismaking', 'Eerste mail kennismaking', 'Even voorstellen', 'Hoi {contact.voornaam},\n\nIk zag {aanleiding}. Wij helpen installateurs met {winpunt}.\n\nPast een kwartier volgende week?\n\nGroet,\n{gebruiker.voornaam}'],
    ['sj-voicemail', 'Opvolgmail na voicemail', 'Ik sprak je voicemail in', 'Hoi {contact.voornaam},\n\nIk sprak net je voicemail in. Kort: {winpunt}.\n\nZal ik je donderdag nog even bellen?\n\nGroet,\n{gebruiker.voornaam}'],
  ]
  for (const [id, naam, onderwerp, tekst] of sjablonen) {
    await client.query(`insert into mailsjablonen (id, organisation_id, naam, kanaal, data) values ($1, $2, $3, 'mail', $4) on conflict (id) do nothing`, [id, orgId, naam, JSON.stringify({ onderwerp, tekst, variabelen: [...new Set(tekst.match(/\{[a-z.]+\}/gi) ?? [])] })])
  }
  const concept = { type: 'mail', onderwerp: 'Ik sprak je voicemail in', tekst: 'Hoi Wietse, ik sprak net je voicemail in. Ik zag dat jullie planning vaak om materiaal draait. Wij leveren per bouwfase op de bouwplaats, zodat je monteurs niet wachten. Zal ik je donderdag nog even bellen?', stijlscore: 8, woorden: 40, grens: 120, winpuntId: 'wp-01', vvVersies: {}, bronnen: [{ soort: 'winpunt', titel: 'Gratis projectschouw binnen 48 uur' }], aanleiding: 'Voicemail ingesproken bij Testtechniek Gevelpunt' }
  await client.query(`insert into concepten (id, organisation_id, agent, handeling, gebruiker_id, account_id, concept, status, op) values ('cr-voicemail', $1, 'schrijver', 'opvolgmail:voicemail', 'u-01', 'pr-06', $2, 'klaar', $3) on conflict (id) do nothing`, [orgId, JSON.stringify(concept), new Date(nu.getTime() - 3600e3).toISOString()])
}
