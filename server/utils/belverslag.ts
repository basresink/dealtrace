// Transcript en gespreksverslag bij een beltaak (taakvenster, in de opzet van het afspraakvenster): alleen
// taken van het type Bellen. Lezen mag iedereen die de taak ziet; schrijven de eigenaar, de salesmanager
// van zijn team en de beheerder (dezelfde regel als afronden). Het verslag staat bij de taak en gaat bij
// afronden mee naar de belactiviteit; de accountkaart en de contactkaart tonen het (van de taak) op het
// tabblad Gespreksverslagen.
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
