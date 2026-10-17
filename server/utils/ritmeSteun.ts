// Steun bij het dagritme op de server: leest de artikelen die de gebruiker mag lezen (gepubliceerd, niet
// verborgen door de beheerder) en wat hij al las, en laat de pure kern in shared/ritmeSteun.ts kiezen.
import { sql } from 'drizzle-orm'
import { alleSteunSlugs, kiesRitmeSteun, type RitmeMoment, type RitmeSignalen, type RitmeSteun, type SteunBronArtikel } from '../../shared/ritmeSteun'
import { helpVerborgen } from './help'
import type { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]

export async function laadRitmeSteun(tx: Tx, gebruikerId: string, moment: RitmeMoment, werkplek: string | null | undefined, signalen: RitmeSignalen, zaad: string): Promise<RitmeSteun> {
  // In een savepoint: een fout hier laat de transactie van het dagritme heel.
  try { return await tx.transaction((sp) => lees(sp as unknown as Tx, gebruikerId, moment, werkplek, signalen, zaad)) } catch { return { tips: [], artikelen: [] } }
}

async function lees(tx: Tx, gebruikerId: string, moment: RitmeMoment, werkplek: string | null | undefined, signalen: RitmeSignalen, zaad: string): Promise<RitmeSteun> {
  const slugs = alleSteunSlugs()
  const rijen = (await tx.execute(sql`select id, slug, titel, collectie, organisation_id, data->>'samenvatting' as samenvatting, data->>'bron' as bron from help_artikelen
    where status = 'gepubliceerd' and slug = any(string_to_array(${slugs.join(',')}, ',')) order by organisation_id nulls last`)).rows as Record<string, any>[]
  const verborgen = new Set(await helpVerborgen(tx))
  const gelezenIds = new Set(((await tx.execute(sql`select artikel_id from help_gelezen where gebruiker_id = ${gebruikerId}`)).rows as { artikel_id: string }[]).map((r) => r.artikel_id))
  const perSlug = new Map<string, SteunBronArtikel & { id: string }>()
  for (const r of rijen) {
    if (verborgen.has(r.id) || perSlug.has(r.slug)) continue
    perSlug.set(r.slug, { id: r.id, slug: r.slug, titel: r.titel, collectie: r.collectie, samenvatting: r.samenvatting ?? '', bron: r.bron ?? null })
  }
  const artikelen = [...perSlug.values()]
  const gelezen = artikelen.filter((a) => gelezenIds.has(a.id)).map((a) => a.slug)
  return kiesRitmeSteun({ moment, werkplek, signalen, artikelen, gelezen, zaad })
}
