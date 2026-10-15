// Startset voor een nieuwe organisatie (F23). Register waar elke prompt zijn
// onderdeel aan toevoegt: klassen, reis, regels, belscripts, ritmes, meetingsoorten,
// campagnesoorten, redenen voor nee, signaalregels, eigen velden, help-artikelen.
// Elk onderdeel is idempotent; "Startset aanvullen" draait alles opnieuw.
import { sql } from 'drizzle-orm'
import type { alsPlatform } from './platform'

type Tx = Parameters<Parameters<typeof alsPlatform>[0]>[0]

export interface StartsetOnderdeel {
  sleutel: string
  naam: string
  voerUit(tx: Tx, organisatieId: string, opties: { naam: string }): Promise<void>
}

export const STARTSET: StartsetOnderdeel[] = [
  {
    sleutel: 'instellingen',
    naam: 'Basisinstellingen (organisatie, niveaus, werkdagen)',
    async voerUit(tx, org, { naam }) {
      const rijen: [string, unknown][] = [
        ['organisatie', { naam, land: 'NL', verkoopjaarStartmaand: 1 }],
        ['niveaus', { iedereenAlles: false, standaardNiveauNieuweGebruiker: 'beginner' }],
        ['werkdagen', { werkdagen: [1, 2, 3, 4, 5], bevrijdingsdag: 'lustrum' }],
      ]
      for (const [key, value] of rijen) {
        await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${org}, ${key}, ${JSON.stringify(value)}::jsonb)
          on conflict (organisation_id, key) do nothing`)
      }
    },
  },
  {
    sleutel: 'teams',
    naam: 'Eerste team',
    async voerUit(tx, org) {
      await tx.execute(sql`insert into teams (id, organisation_id, naam)
        select ${`${org}-team`}, ${org}, 'Team 1' where not exists (select 1 from teams where organisation_id = ${org})`)
    },
  },
]

/** Draait alle onderdelen; geeft terug welke onderdelen nu zijn uitgevoerd. */
export async function pasStartsetToe(tx: Tx, organisatieId: string, naam: string): Promise<string[]> {
  const gedaan: string[] = []
  for (const o of STARTSET) {
    await o.voerUit(tx, organisatieId, { naam })
    gedaan.push(o.sleutel)
  }
  await tx.execute(sql`update organisations set data = jsonb_set(data, '{startset}',
    coalesce(data->'startset', '{}'::jsonb) || ${JSON.stringify(Object.fromEntries(gedaan.map((g) => [g, new Date().toISOString()])))}::jsonb)
    where id = ${organisatieId}`)
  return gedaan
}
