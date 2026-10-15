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
