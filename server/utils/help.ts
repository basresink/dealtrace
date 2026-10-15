// Helpcenter op de server: artikelen lezen (platform en eigen, zonder wat de beheerder
// verborg), gelezen markeren en zoeken met Postgres full-text search zonder accenten.
import { eq, sql } from 'drizzle-orm'
import type { HelpArtikel } from '../../shared/help'
import { schema } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = typeof schema.helpArtikelen.$inferSelect

export function naarArtikel(r: Rij): HelpArtikel & { id: string; versie: number } {
  return {
    id: r.id, slug: r.slug, titel: r.titel, categorie: r.categorie, collectie: r.collectie as HelpArtikel['collectie'], samenvatting: r.data.samenvatting ?? '',
    inhoud: r.data.inhoud ?? '', routes: r.data.routes ?? [], features: r.data.features ?? [], niveau: r.niveau, organisationId: r.organisationId, bijgewerktOp: r.bijgewerktOp, versie: r.versie,
  }
}

export async function helpVerborgen(tx: Tx): Promise<string[]> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'helpVerborgen'))
  return (r?.value as string[] | undefined) ?? []
}

/** Gepubliceerde artikelen voor deze organisatie (RLS: platform plus eigen). */
export async function leesArtikelen(tx: Tx, opties: { metVerborgen?: boolean } = {}) {
  const rijen = await tx.select().from(schema.helpArtikelen).where(eq(schema.helpArtikelen.status, 'gepubliceerd'))
  const verborgen = new Set(await helpVerborgen(tx))
  return rijen.map(naarArtikel).filter((a) => opties.metVerborgen || !verborgen.has(a.id)).map((a) => ({ ...a, verborgen: verborgen.has(a.id) }))
}

export async function gelezenDoor(tx: Tx, gebruikerId: string): Promise<Set<string>> {
  return new Set((await tx.select({ id: schema.helpGelezen.artikelId }).from(schema.helpGelezen).where(eq(schema.helpGelezen.gebruikerId, gebruikerId))).map((r) => r.id))
}

/** Idempotent per gebruiker en artikel. Geeft false bij een onbekend artikel. */
export async function markeerGelezen(tx: Tx, org: string, gebruikerId: string, artikelId: string): Promise<boolean> {
  const [a] = await tx.select({ id: schema.helpArtikelen.id }).from(schema.helpArtikelen).where(eq(schema.helpArtikelen.id, artikelId))
  if (!a) return false
  await tx.insert(schema.helpGelezen).values({ organisationId: org, gebruikerId, artikelId }).onConflictDoNothing()
  return true
}

/** Zoeken: full-text in titel, samenvatting en inhoud, en een deel van de titel; zonder accenten en hoofdletters. */
export async function zoek(tx: Tx, term: string): Promise<string[]> {
  const rijen = (await tx.execute(sql`
    select id, ts_rank(to_tsvector('dutch', dealtrace_zoektekst(titel || ' ' || coalesce(data->>'samenvatting', '') || ' ' || coalesce(data->>'inhoud', ''))), plainto_tsquery('dutch', dealtrace_zoektekst(${term})))
      + case when dealtrace_zoektekst(titel) like '%' || dealtrace_zoektekst(${term}) || '%' then 1 else 0 end as score
    from help_artikelen
    where status = 'gepubliceerd' and (
      to_tsvector('dutch', dealtrace_zoektekst(titel || ' ' || coalesce(data->>'samenvatting', '') || ' ' || coalesce(data->>'inhoud', ''))) @@ plainto_tsquery('dutch', dealtrace_zoektekst(${term}))
      or dealtrace_zoektekst(titel || ' ' || coalesce(data->>'samenvatting', '')) like '%' || dealtrace_zoektekst(${term}) || '%')
    order by score desc limit 50`)).rows as { id: string }[]
  return rijen.map((r) => r.id)
}
