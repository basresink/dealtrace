// Startset voor een nieuwe organisatie (F23). Register waar elke prompt zijn
// onderdeel aan toevoegt: klassen, reis, regels, belscripts, ritmes, meetingsoorten,
// campagnesoorten, redenen voor nee, signaalregels, eigen velden, help-artikelen.
// Elk onderdeel is idempotent; "Startset aanvullen" draait alles opnieuw.
import { sql } from 'drizzle-orm'
import type { alsPlatform } from './platform'
import { schema } from './db'
import { startersetRijen } from './motor'
import { RITMES_STARTSET } from '../../shared/hercontact'
import { STARTSET_SCRIPTS } from '../../shared/belscripts'
import { AFKOELING_STANDAARD } from '../../shared/nbStatus'
import { STANDAARD_ACTIVITEITEN, STANDAARDREIS_NAAM, standaardReisData, standaardReisId } from '../../shared/reis'

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
  {
    sleutel: 'reis',
    naam: 'Standaardreis met startactiviteiten en afkoelperiodes (P05)',
    async voerUit(tx, org) {
      const id = standaardReisId(org)
      await tx.execute(sql`insert into reistemplates (id, organisation_id, naam, versie, status, is_standaard, data)
        select ${id}, ${org}, ${STANDAARDREIS_NAAM}, 1, 'actief', true, ${JSON.stringify(standaardReisData())}::jsonb
        where not exists (select 1 from reistemplates where organisation_id = ${org} and is_standaard)`)
      await tx.execute(sql`insert into activiteitstemplates (organisation_id, reistemplate_id, fase_id, versie, data)
        select ${org}, ${id}, x->>'faseId', 1, x from jsonb_array_elements(${JSON.stringify(STANDAARD_ACTIVITEITEN)}::jsonb) x
        where exists (select 1 from reistemplates where id = ${id}) and not exists (select 1 from activiteitstemplates where reistemplate_id = ${id})`)
      await tx.execute(sql`insert into org_settings (organisation_id, key, value) values (${org}, 'afkoeling', ${JSON.stringify(AFKOELING_STANDAARD)}::jsonb)
        on conflict (organisation_id, key) do nothing`)
    },
  },
  {
    sleutel: 'regels',
    naam: 'Starterset van 23 regels voor de motor (P06)',
    async voerUit(tx, org) {
      const [r] = (await tx.execute(sql`select count(*)::int as n from activity_rules where organisation_id = ${org}`)).rows as { n: number }[]
      if (r && r.n > 0) return
      await tx.insert(schema.activityRules).values(startersetRijen(org))
    },
  },
  {
    sleutel: 'ritmes',
    naam: 'Vier hercontactritmes: Koud, Warm, Winback, Buitendienst koud (P07)',
    async voerUit(tx, org) {
      const [r] = (await tx.execute(sql`select count(*)::int as n from hercontactritmes where organisation_id = ${org}`)).rows as { n: number }[]
      if (r && r.n > 0) return
      await tx.insert(schema.hercontactritmes).values(RITMES_STARTSET.map((x) => ({ organisationId: org, naam: x.naam, bron: x.bron, data: { stappen: x.stappen, parkeerDagen: x.parkeerDagen, werkplek: x.werkplek ?? 'alle' } })))
    },
  },
  {
    sleutel: 'belscripts',
    naam: 'Zes belscripts, actief in versie 1 (P10)',
    async voerUit(tx, org) {
      const [r] = (await tx.execute(sql`select count(*)::int as n from belscripts where organisation_id = ${org} and startset is not null`)).rows as { n: number }[]
      if (r && r.n > 0) return
      for (const [i, s] of STARTSET_SCRIPTS.entries()) {
        const [b] = await tx.insert(schema.belscripts).values({ organisationId: org, naam: s.naam, doel: s.doel, status: 'actief', versie: 1, startset: `start-${i + 1}`, data: s.data }).returning({ id: schema.belscripts.id })
        await tx.insert(schema.belscriptVersies).values({ organisationId: org, belscriptId: b!.id, versie: 1, naam: s.naam, doel: s.doel, data: s.data, geactiveerdDoor: 'startset' })
      }
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
