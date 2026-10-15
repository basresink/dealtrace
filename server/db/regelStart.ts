// De starterset van 23 regels (seed/regels-starterset.json) voor elke klantorganisatie
// zonder regels. Idempotent; draait na elke migratie.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type pg from 'pg'

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

/** P11: de SBI-mapping per branche (vv_branche_mapping) in een verkoopverhaal met de Voltvast-branches (tot P28). */
export async function zorgVoorBrancheMapping(client: Pick<pg.Client, 'query'>): Promise<number> {
  const vv = JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/voltvast.json'), 'utf8')).verkoopverhaal
  const mapping = (vv?.eigen_aanvullingen?.vv_branche_mapping ?? []).map((m: any) => ({ brancheId: m.branche_id, sbiCodes: m.sbi_codes ?? [], trefwoorden: m.trefwoorden ?? [] }))
  const r = await client.query(`update org_settings set value = value || $1 where key = 'verkoopverhaal' and not (value ? 'brancheMapping') and value->'branches' @> '[{"id": "br-01"}]'`, [JSON.stringify({ brancheMapping: mapping })])
  return r.rowCount ?? 0
}
