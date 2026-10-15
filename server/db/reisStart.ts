// De standaardreis als echte rij per organisatie (F05), en een reis voor accounts
// die er nog geen hebben. Idempotent; draait na elke migratie en in de seed.
// Gebruikt een gewone pg-client met de eigenaarsrol (RLS-regel beheer_eigenaar).
import type pg from 'pg'
import { STANDAARD_ACTIVITEITEN, STANDAARDREIS_NAAM, faseVoorStatus, standaardReisData, standaardReisId } from '../../shared/reis'

type Client = Pick<pg.Client, 'query'>

export async function maakStandaardreis(client: Client, org: string): Promise<boolean> {
  const id = standaardReisId(org)
  const res = await client.query(
    `insert into reistemplates (id, organisation_id, naam, versie, status, is_standaard, data)
     select $1, $2, $3, 1, 'actief', true, $4
     where not exists (select 1 from reistemplates where organisation_id = $2 and is_standaard)`,
    [id, org, STANDAARDREIS_NAAM, standaardReisData()],
  )
  if (!res.rowCount) return false
  for (const a of STANDAARD_ACTIVITEITEN) {
    await client.query(
      `insert into activiteitstemplates (organisation_id, reistemplate_id, fase_id, versie, data) values ($1, $2, $3, 1, $4)`,
      [org, id, a.faseId, a],
    )
  }
  return true
}

/** Elke klantorganisatie een standaardreis; prospects zonder reis krijgen een fase volgens hun status. */
export async function zorgVoorReizen(client: Client): Promise<{ reizen: number; accounts: number }> {
  let reizen = 0
  const orgs = (await client.query(`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  for (const o of orgs) if (await maakStandaardreis(client, o.id)) reizen++
  const zonder = (await client.query(
    `select a.id, a.organisation_id, a.nb_status, coalesce(a.fase_sinds, a.created_at) as sinds, r.id as reis_id
       from accounts a join reistemplates r on r.organisation_id = a.organisation_id and r.is_standaard
      where a.account_kind = 'prospect' and a.reis_id is null`,
  )).rows as { id: string; organisation_id: string; nb_status: string; sinds: Date; reis_id: string }[]
  for (const a of zonder) {
    const fase = faseVoorStatus(a.nb_status)
    if (!fase) continue
    const eind = fase === 'overgedragen' || fase === 'verloren'
    await client.query(`update accounts set reis_id = $2, fase_id = $3, fase_sinds = $4 where id = $1`, [a.id, a.reis_id, fase, a.sinds])
    const pr = await client.query(
      `insert into prospectreizen (organisation_id, reistemplate_id, template_versie, account_id, fase_id, nb_status, fase_sinds, gestart_op, afgerond_op)
       values ($1, $2, 1, $3, $4, $5, $6, $6, $7) returning id`,
      [a.organisation_id, a.reis_id, a.id, fase, a.nb_status, a.sinds, eind ? a.sinds : null],
    )
    await client.query(
      `insert into reisgeschiedenis (organisation_id, account_id, prospectreis_id, versie, van_fase_id, naar_fase_id, naar_status, gebeurtenis, door, op, reden)
       values ($1, $2, $3, 1, null, $4, $5, 'handmatig', 'motor', $6, 'Startstand bij invoering van de prospectreis')`,
      [a.organisation_id, a.id, pr.rows[0].id, fase, a.nb_status, a.sinds],
    )
  }
  return { reizen, accounts: zonder.length }
}
