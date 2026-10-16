// Transcript en gespreksverslag bij een beltaak (taakvenster, in de opzet van het afspraakvenster): alleen
// taken van het type Bellen. Lezen mag iedereen die de taak ziet; schrijven de eigenaar, de salesmanager
// van zijn team en de beheerder (dezelfde regel als afronden). Het verslag staat bij de taak en gaat bij
// afronden mee naar de belactiviteit (activiteiten.data.verslag). Wordt het na het afronden bewaard of
// gewijzigd, dan komt het als nieuwe regel in activiteit_verslagen (migratie 0063, alleen-toevoegen) bij die
// belactiviteit; de nieuwste regel geldt. Het transcript blijft bij de taak (transcripten) en hoort via
// activiteiten.task_id bij de belactiviteit. De tijdlijn en het tabblad Gespreksverslagen van account- en
// contactkaart tonen verslag en transcript samen bij de belactiviteit (kaartTabbladen.ts).
import { sql } from 'drizzle-orm'
import { telWoorden } from '../../shared/transcript'
import type { gebruikDb } from './db'
import { magTaak } from './taken'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
export interface BeltaakRij { id: string; owner_id: string | null; account_id: string | null; contact_id: string | null; action_type: string; status: string; data: any }

/** De beltaak, of 404 (onbekend), 422 (geen beltaak) of 403 (niet jouw taak). */
export async function vereisBeltaak(tx: Tx, ctx: any, id: string): Promise<BeltaakRij> {
  const [t] = (await tx.execute(sql`select id, owner_id, account_id, contact_id, action_type, status, data from tasks where id = ${id}`)).rows as any[]
  if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
  if (t.action_type !== 'bellen') throw createError({ statusCode: 422, statusMessage: 'Een gespreksverslag hoort bij een beltaak' })
  if (t.owner_id && !(await magTaak(tx, ctx, t.owner_id))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
  return t as BeltaakRij
}

/** Het transcript bij de taak (geplakt of geüpload), voor het taakvenster. */
export async function transcriptVanTaak(tx: Tx, id: string, bestandsnaam: string | null) {
  const [tr] = (await tx.execute(sql`select id, tekst, dienst, op from transcripten where record_soort = 'tasks' and record_id = ${id} and bijlage_id is null order by op desc limit 1`)).rows as any[]
  return tr ? { id: tr.id as string, tekst: tr.tekst as string, bestandsnaam, bron: tr.dienst as string, op: new Date(tr.op).toISOString(), woorden: telWoorden(tr.tekst) } : null
}

/** De analyse van de Notulist zoals het venster hem toont. */
export function analyseVan(n: any) {
  return n ? { samenvatting: n.samenvatting || null, perAgendapunt: n.perAgendapunt ?? [], actiepunten: n.actiepunten ?? [], koopsignalen: n.koopsignalen ?? [], bezwaren: n.bezwaren ?? [], openVragen: n.openVragen ?? [], concurrenten: n.concurrenten ?? [], voorgesteldeUitkomst: n.voorgesteldeUitkomst ?? null, op: n.op ?? null, basis: n.basis ?? null } : null
}

/** De belactiviteit die bij het afronden van deze taak is vastgelegd (de nieuwste), of null zolang de taak open is. */
export async function belactiviteitVanTaak(tx: Tx, taakId: string): Promise<{ id: string; organisation_id: string } | null> {
  const [a] = (await tx.execute(sql`select id, organisation_id from activiteiten where task_id = ${taakId} order by op desc limit 1`)).rows as any[]
  return a ?? null
}

/**
 * Een verslag dat na het afronden wordt bewaard, bij de belactiviteit: een nieuwe regel in activiteit_verslagen
 * (de log blijft alleen-toevoegen). Leeg betekent gewist. Geeft het id van de belactiviteit, of null als de taak
 * nog open is (dan staat het verslag alleen bij de taak en gaat het bij afronden mee).
 */
export async function verslagNaAfronden(tx: Tx, taakId: string, verslag: { tekst: string; bron: string } | null, door: string): Promise<string | null> {
  const act = await belactiviteitVanTaak(tx, taakId)
  if (!act) return null
  await tx.execute(sql`insert into activiteit_verslagen (organisation_id, activiteit_id, task_id, tekst, bron, door, op)
    values (${act.organisation_id}, ${act.id}, ${taakId}, ${verslag?.tekst ?? ''}, ${verslag?.bron === 'ingesproken' ? 'ingesproken' : 'getypt'}, ${door}, clock_timestamp())`)
  return act.id
}

/** Het geldende verslag per activiteit: de nieuwste regel uit activiteit_verslagen, anders data.verslag van de activiteit. */
export function geldendVerslag(activiteit: { data?: any }, laatsteRegel: { tekst: string; op: string | Date } | undefined): string | null {
  if (laatsteRegel) return laatsteRegel.tekst.trim() || null
  const v = activiteit.data?.verslag
  return (typeof v === 'string' ? v : v?.tekst ?? '').trim() || null
}
