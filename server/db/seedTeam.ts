// P21: fictieve belactiviteit van de afgelopen vier weken voor het team (niet Eva: haar accounts zijn de planningstestset), een coachingsessie voor Sanne met
// een gedeeld punt, een afspraak en een privénotitie van Joost. Deterministisch, geen echte gegevens.
import type pg from 'pg'

const UITKOMSTEN = ['geen_reactie', 'voicemail', 'geen_reactie', 'later', 'afspraak', 'geen_interesse', 'geen_reactie', 'later'] as const
const BEZWAREN = ['We zijn tevreden met onze leverancier', 'Te duur', 'Geen tijd nu']

export async function seedTeam(client: pg.Client, orgId: string, nu = new Date()) {
  const al = await client.query(`select 1 from activiteiten where organisation_id = $1 and data->>'seed' = 'team' limit 1`, [orgId])
  const per: Record<string, number> = al.rowCount ? {} : { 'u-01': 4, 'u-03': 7, 'u-05': 3, 'u-02': 2 }
  for (const [gebruiker, perDag] of Object.entries(per)) {
    const accounts = (await client.query(`select a.id, (select c.id from contacts c where c.account_id = a.id order by (c.rol = 'beslisser') desc, c.id limit 1) as contact
      from accounts a where a.owner_id = $1 and a.account_kind = 'prospect' order by a.id limit 12`, [gebruiker])).rows
    if (!accounts.length) continue
    let n = 0
    for (let d = 28; d >= 2; d--) {
      const dag = new Date(nu.getTime() - d * 864e5)
      if ([0, 6].includes(dag.getUTCDay())) continue
      for (let i = 0; i < perDag; i++) {
        const a = accounts[(n + i) % accounts.length]
        const uitkomst = UITKOMSTEN[(n * 3 + i + gebruiker.length) % UITKOMSTEN.length]
        const op = new Date(Date.UTC(dag.getUTCFullYear(), dag.getUTCMonth(), dag.getUTCDate(), 8 + (i % 7), (i * 7) % 60))
        const data: Record<string, unknown> = { seed: 'team' }
        if (uitkomst === 'geen_interesse' || uitkomst === 'later') { data.tekst = `Gesprek over de levering. ${BEZWAREN[n % 3]}.`; data.bezwaar = BEZWAREN[n % 3] }
        if (uitkomst === 'afspraak') data.tekst = 'Afspraak gemaakt voor een kennismaking op locatie.'
        await client.query(`insert into activiteiten (organisation_id, account_id, contact_id, soort, kanaal, uitkomst, door, op, data) values ($1, $2, $3, 'gebeld', 'bellen', $4, $5, $6, $7)`, [orgId, a.id, uitkomst === 'geen_reactie' || uitkomst === 'voicemail' ? null : a.contact, uitkomst, gebruiker, op.toISOString(), JSON.stringify(data)])
      }
      n++
    }
  }
  const datum = new Date(nu.getTime() - 9 * 864e5).toISOString().slice(0, 10)
  await client.query(`insert into coaching_sessies (id, organisation_id, gebruiker_id, manager_id, datum, data) values ('cs-sanne-1', $1, 'u-03', 'u-04', $2, $3) on conflict (id) do nothing`, [orgId, datum, JSON.stringify({
    punten: [
      { tekst: 'Sluit elk gesprek af met een voorstel voor een afspraak.', onderbouwing: { cijfers: ['3 afspraken uit 21 gesprekken', 'team 18 procent'], bron: 'Activiteitenlog' }, artikelSleutel: 'een-belscript-kiezen', gedeeld: true },
      { tekst: 'Plan twee vaste belblokken per week.', onderbouwing: { cijfers: ['0 belblokken gehouden in 2 weken'], bron: 'Belblokken' }, artikelSleutel: 'belblokken', gedeeld: false },
    ],
  })])
  await client.query(`insert into coaching_notities (id, organisation_id, gebruiker_id, manager_id, soort, tekst, termijn, sessie_id) values
    ('cn-sanne-1', $1, 'u-03', 'u-04', 'afspraak', 'Elke dinsdag en donderdag een belblok van een uur.', $2, 'cs-sanne-1'),
    ('cn-sanne-2', $1, 'u-03', 'u-04', 'prive', 'Sanne twijfelt over de doelgroep; volgende keer naar vragen.', null, 'cs-sanne-1') on conflict (id) do nothing`, [orgId, new Date(nu.getTime() + 14 * 864e5).toISOString().slice(0, 10)])
}
