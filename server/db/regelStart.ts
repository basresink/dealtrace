// De starterset van 23 regels (seed/regels-starterset.json) voor elke klantorganisatie
// zonder regels. Idempotent; draait na elke migratie.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { laadStartsetBevestigd } from '../utils/vvProjectie'
import * as schema from './schema'

export async function zorgVoorRegels(client: Pick<pg.Client, 'query'>): Promise<number> {
  const set = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/regels-starterset.json'), 'utf8')) as any[]
  const orgs = (await client.query(`select o.id from organisations o where o.status <> 'systeem' and not exists (select 1 from activity_rules r where r.organisation_id = o.id)`)).rows as { id: string }[]
  for (const o of orgs) {
    for (const r of set) {
      await client.query(
        `insert into activity_rules (organisation_id, code, naam, categorie, actief, motor, scope, cadans_dagen, prioriteit, data) values ($1, $2, $3, $4, true, $5, 'organisatie', $6, $7, $8)`,
        [o.id, r.code, r.naam, r.categorie, r.motor, r.cadansDagen, r.prioriteit, r.data],
      )
    }
  }
  return orgs.length
}

/** De vier hercontactritmes van de startset (shared/hercontact.ts) voor organisaties zonder ritmes. */
export async function zorgVoorRitmes(client: Pick<pg.Client, 'query'>, startset: { naam: string; bron: string; werkplek?: string; stappen: unknown[]; parkeerDagen: number }[]): Promise<number> {
  const orgs = (await client.query(`select o.id from organisations o where o.status <> 'systeem' and not exists (select 1 from hercontactritmes r where r.organisation_id = o.id)`)).rows as { id: string }[]
  for (const o of orgs) {
    for (const r of startset) {
      await client.query(`insert into hercontactritmes (organisation_id, naam, bron, data) values ($1, $2, $3, $4)`, [o.id, r.naam, r.bron, { stappen: r.stappen, parkeerDagen: r.parkeerDagen, werkplek: r.werkplek ?? 'alle' }])
    }
  }
  return orgs.length
}

/** P10: de zes belscripts van de startset, actief in versie 1, voor organisaties zonder startset. */
export async function zorgVoorBelscripts(client: Pick<pg.Client, 'query'>, startset: { naam: string; doel: string; data: unknown }[]): Promise<number> {
  const orgs = (await client.query(`select o.id from organisations o where o.status <> 'systeem' and not exists (select 1 from belscripts b where b.organisation_id = o.id and b.startset is not null)`)).rows as { id: string }[]
  for (const o of orgs) {
    for (const [i, s] of startset.entries()) {
      const r = await client.query(`insert into belscripts (organisation_id, naam, doel, status, versie, startset, data) values ($1, $2, $3, 'actief', 1, $4, $5) on conflict do nothing returning id`, [o.id, s.naam, s.doel, `start-${i + 1}`, s.data])
      if (r.rows[0]) await client.query(`insert into belscript_versies (organisation_id, belscript_id, versie, naam, doel, data, geactiveerd_door) values ($1, $2, 1, $3, $4, $5, 'startset')`, [o.id, r.rows[0].id, s.naam, s.doel, s.data])
    }
  }
  return orgs.length
}

/** P13: de zes meetingsoorten uit de startset voor elke organisatie (idempotent op slug). */
export async function zorgVoorMeetingsoorten(client: Pick<pg.Client, 'query'>, startset: { slug: string; naam: string; type: string; duurMin: number; vorm: string; data: unknown }[]): Promise<number> {
  // Elke organisatie krijgt de soorten uit de startset die ze nog niet heeft (P30: Ongepland bezoek);
  // bestaande soorten, ook uitgezette, blijven zoals de beheerder ze maakte.
  const orgs = (await client.query(`select o.id from organisations o where o.status <> 'systeem'`)).rows as { id: string }[]
  let n = 0
  for (const o of orgs) {
    for (const m of startset) n += (await client.query(`insert into meetingsoorten (organisation_id, slug, naam, type, duur_min, vorm, data) values ($1, $2, $3, $4, $5, $6, $7) on conflict (organisation_id, slug) do nothing`, [o.id, m.slug, m.naam, m.type, m.duurMin, m.vorm, m.data])).rowCount ?? 0
  }
  return n
}

/** P28: een organisatie met het oude verkoopverhaal in org_settings (P10 tot P12) krijgt het leesmodel uit de startset, bevestigd. */
export async function zorgVoorVerkoopverhaal(client: pg.Client): Promise<number> {
  const orgs = (await client.query(`select s.organisation_id as id from org_settings s where s.key = 'verkoopverhaal'
    and not exists (select 1 from vv_sublagen v where v.organisation_id = s.organisation_id)`)).rows as { id: string }[]
  if (!orgs.length) return 0
  const vv = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/voltvast.json'), 'utf8')).verkoopverhaal
  const db = drizzle(client as any, { schema })
  for (const o of orgs) await laadStartsetBevestigd(db as any, o.id, vv, 'systeem')
  return orgs.length
}
