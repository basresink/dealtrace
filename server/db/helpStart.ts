// Laadt de platformartikelen uit content/help/ in help_artikelen (organisation_id null).
// Draait na elke migratie en bij elke Netlify-build; een gewijzigd artikel krijgt een
// nieuwe versie en "Laatst bijgewerkt". Een artikel dat uit content/help verdween, wordt
// gearchiveerd.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type pg from 'pg'
import { leesArtikel } from '../../shared/help'

export const HELP_MAP = join(import.meta.dirname, '../../content/help')

export function helpBestanden(map = HELP_MAP) {
  return readdirSync(map).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const bron = readFileSync(join(map, f), 'utf8')
    return { ...leesArtikel(f.slice(0, -3), bron), hash: createHash('sha256').update(bron).digest('hex').slice(0, 16) }
  })
}

export async function zorgVoorHelp(client: Pick<pg.Client, 'query'>): Promise<{ nieuw: number; bijgewerkt: number }> {
  const artikelen = helpBestanden()
  const bestaand = new Map(((await client.query(`select slug, data->>'hash' as hash from help_artikelen where organisation_id is null`)).rows as { slug: string; hash: string }[]).map((r) => [r.slug, r.hash]))
  let nieuw = 0
  let bijgewerkt = 0
  for (const a of artikelen) {
    const data = JSON.stringify({ samenvatting: a.samenvatting, inhoud: a.inhoud, routes: a.routes, features: a.features, vragen: a.vragen ?? [], bron: a.bron ?? null, hash: a.hash })
    if (!bestaand.has(a.slug)) {
      await client.query(`insert into help_artikelen (organisation_id, collectie, categorie, slug, titel, niveau, data) values (null, $1, $2, $3, $4, $5, $6)`,
        [a.collectie, a.categorie, a.slug, a.titel, a.niveau ?? null, data])
      nieuw++
    } else if (bestaand.get(a.slug) !== a.hash) {
      await client.query(`update help_artikelen set collectie = $1, categorie = $2, titel = $3, niveau = $4, data = $5, status = 'gepubliceerd', versie = versie + 1, bijgewerkt_op = now()
        where organisation_id is null and slug = $6`, [a.collectie, a.categorie, a.titel, a.niveau ?? null, data, a.slug])
      bijgewerkt++
    }
  }
  await client.query(`update help_artikelen set status = 'gearchiveerd' where organisation_id is null and status <> 'gearchiveerd' and not (slug = any($1))`, [artikelen.map((a) => a.slug)])
  return { nieuw, bijgewerkt }
}
