// Startdata laden: pnpm seed
//
// Testbedrijf Voltvast uit seed/voltvast.json (fictief, Bijlage C) met teams en
// gebruikers, aangevuld met een beheerder, een Expert-accountmanager en een
// founder, plus een tweede testorganisatie voor de cross-tenanttests.
// Alle namen en e-mailadressen zijn verzonnen (eindigen op .test).
// Idempotent: bestaande rijen worden bijgewerkt, niet verdubbeld.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { verbindingsopties } from '../../shared/verbinding'
import { BEHEER_URL } from './omgeving'

interface SeedGebruiker {
  id: string; naam: string; rol: string; team: string | null; werkplek: string; niveau: string; email: string
}

const ROLMAP: Record<string, string> = {
  'rol-accountmanager': 'accountmanager',
  'rol-binnendienst': 'accountmanager',
  'rol-business-developer': 'accountmanager',
  'rol-salesmanager': 'salesmanager',
}

export async function seed(url = BEHEER_URL, opties: { stil?: boolean } = {}) {
  const log = (t: string) => { if (!opties.stil) console.log(t) }
  const voltvast = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/voltvast.json'), 'utf8'))
  const org = voltvast.organisatie
  const client = new pg.Client(verbindingsopties(url))
  await client.connect()
  try {
    await client.query('begin')

    // Organisaties
    await client.query(
      `insert into organisations (id, name, pakket, data) values ($1, $2, 'compleet', $3)
       on conflict (id) do update set name = excluded.name, data = excluded.data`,
      [org.id, org.naam, { werkgebied: org.werkgebied, omschrijving: org.omschrijving }],
    )
    await client.query(
      `insert into organisations (id, name, pakket, data) values ('org-tweede', 'Testorganisatie Tweede', 'starter', '{}')
       on conflict (id) do nothing`,
    )

    // Teams van Voltvast; de salesmanager (u-04) beheert ze.
    for (const t of org.teams as { id: string; naam: string }[]) {
      await client.query(
        `insert into teams (id, organisation_id, naam, manager_ids) values ($1, $2, $3, $4)
         on conflict (id) do update set naam = excluded.naam, manager_ids = excluded.manager_ids`,
        [t.id, org.id, t.naam, t.id === 'team-organisatie' ? [] : ['u-04']],
      )
    }
    await client.query(
      `insert into teams (id, organisation_id, naam, manager_ids) values ('team-tweede', 'org-tweede', 'Team Tweede', '{}')
       on conflict (id) do nothing`,
    )

    // Gebruikers
    const extra: SeedGebruiker[] = [
      { id: 'u-06', naam: 'Testgebruiker Mira Beheer', rol: 'beheerder', team: 'team-organisatie', werkplek: 'binnendienst', niveau: 'expert', email: 'mira@voltvast.test' },
      { id: 'u-07', naam: 'Testgebruiker Eva Ervaren', rol: 'accountmanager', team: 'team-binnendienst', werkplek: 'binnendienst', niveau: 'expert', email: 'eva@voltvast.test' },
    ]
    const gebruikers: SeedGebruiker[] = [...(voltvast.gebruikers as SeedGebruiker[]), ...extra]
    for (const g of gebruikers) {
      const rol = ROLMAP[g.rol] ?? g.rol
      await client.query(
        `insert into users (id, organisation_id, email, name, role, niveau, team_id, werkplek, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'actief')
         on conflict (id) do update set name = excluded.name, role = excluded.role, niveau = excluded.niveau,
           team_id = excluded.team_id, werkplek = excluded.werkplek, email = excluded.email`,
        [g.id, org.id, g.email, g.naam, rol, g.niveau, g.team, g.werkplek],
      )
    }
    await client.query(
      `insert into users (id, organisation_id, email, name, role, niveau, team_id, werkplek)
       values ('u-t1', 'org-tweede', 'beheer@tweede.test', 'Testgebruiker Tom Tweede', 'beheerder', 'expert', 'team-tweede', 'binnendienst'),
              ('u-t2', 'org-tweede', 'am@tweede.test', 'Testgebruiker Tess Tweede', 'accountmanager', 'beginner', 'team-tweede', 'buitendienst'),
              ('u-founder', null, 'founder@dealtrace.test', 'Testfounder Dealtrace', 'founder', 'expert', null, 'binnendienst')
       on conflict (id) do nothing`,
    )

    // Instellingen
    for (const [orgId, key, value] of [
      [org.id, 'organisatie', { naam: org.naam, land: 'NL', verkoopjaarStartmaand: 1 }],
      [org.id, 'niveaus', { iedereenAlles: false, standaardNiveauNieuweGebruiker: 'beginner' }],
      [org.id, 'werkdagen', { werkdagen: [1, 2, 3, 4, 5], bevrijdingsdag: 'lustrum' }],
      ['org-tweede', 'niveaus', { iedereenAlles: false, standaardNiveauNieuweGebruiker: 'beginner' }],
    ] as const) {
      await client.query(
        `insert into org_settings (organisation_id, key, value) values ($1, $2, $3)
         on conflict (organisation_id, key) do nothing`,
        [orgId, key, value],
      )
    }

    // Een paar meldingen om de pagina Meldingen te laten zien.
    const meldingen = [
      ['m-1', 'u-02', 'dagstart', 'Je dag staat klaar', '3 afspraken, 5 belacties. Eerst: Testbrontsma Installatietechniek om 09:30.', '/'],
      ['m-2', 'u-02', 'hot', 'Nieuwe aanleiding bij Testbrontsma Installatietechniek', 'Vacature servicemonteur (12 okt).', '/prospects'],
      ['m-3', 'u-02', 'herinnering', 'Terugbellen: Testoldenhave Klimaattechniek', 'Vandaag 14:00.', '/acties'],
      ['m-4', 'u-03', 'inzicht', 'Concept klaar ter goedkeuring', 'Opvolgmail aan Testmarskamp Installaties.', '/acties'],
    ]
    for (const [id, gebruiker, soort, titel, tekst, link] of meldingen) {
      await client.query(
        `insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing`,
        [id, org.id, gebruiker, soort, titel, tekst, link],
      )
    }

    await client.query('commit')
    log(`Startdata geladen: ${org.naam} met ${gebruikers.length} gebruikers, Testorganisatie Tweede en een founder.`)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    await client.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((e) => {
    console.error('Seed mislukt:', e.message)
    process.exit(1)
  })
}
