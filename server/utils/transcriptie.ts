// Transcriptie (P31, 8.9, 12): de opname gaat alleen naar een dienst in de EU, achter één adapter.
// Uitvoering via TRANSCRIPTIE_MODUS: `mock` (standaard, netwerkloos) of `eu` met TRANSCRIPTIE_URL op
// een host uit de EU-lijst en TRANSCRIPTIE_SLEUTEL. Kosten: 1 credit per begonnen minuut via de
// reservering uit P33. Na succes wordt de opname gewist, tenzij de organisatie bewaren aanzet.
import { sql } from 'drizzle-orm'
import { boek, geefVrij, reserveer } from './credits'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

/** Alleen deze hosts zijn toegestaan: diensten met verwerking in de EU (open vraag 17 kiest er één). */
export const EU_HOSTS = ['eu.api.speechmatics.com', 'eu2.rt.speechmatics.com', 'api.eu.assemblyai.com', 'westeurope.stt.speech.microsoft.com', 'swedencentral.stt.speech.microsoft.com', 'api.gladia.io']
export function isEuDienst(url: string | null | undefined): boolean {
  try { const u = new URL(String(url)); return u.protocol === 'https:' && EU_HOSTS.includes(u.hostname) } catch { return false }
}
export const transcriptieModus = () => (process.env.TRANSCRIPTIE_MODUS === 'eu' ? 'eu' : 'mock')
/** Mock: vaste tekst per opname-id, of een standaardverslag. */
export const MOCK_TRANSCRIPTEN: Record<string, string> = {}
export const MOCK_STANDAARD = 'Goed gesprek gehad met de bedrijfsleider. Ze willen een vervolg in november. Actiepunt: leverplan per bouwfase opsturen.'

async function dienst(inhoud: Buffer, mime: string, bijlageId: string): Promise<{ tekst: string; dienst: string }> {
  if (transcriptieModus() === 'mock') return { tekst: MOCK_TRANSCRIPTEN[bijlageId] ?? MOCK_STANDAARD, dienst: 'mock' }
  const url = process.env.TRANSCRIPTIE_URL
  if (!isEuDienst(url)) throw Object.assign(new Error('De transcriptiedienst staat niet in de EU'), { statusCode: 502, statusMessage: 'De transcriptiedienst staat niet in de EU' })
  const r = await fetch(url!, { method: 'POST', headers: { authorization: `Bearer ${process.env.TRANSCRIPTIE_SLEUTEL ?? ''}`, 'content-type': mime }, body: new Uint8Array(inhoud), signal: AbortSignal.timeout(60_000) })
  if (!r.ok) throw Object.assign(new Error(`transcriptie ${r.status}`), { statusCode: 502, statusMessage: 'De transcriptie lukte niet. Je opname is bewaard.' })
  const j: any = await r.json()
  return { tekst: String(j.text ?? j.tekst ?? j.transcript ?? ''), dienst: new URL(url!).hostname }
}

/** Duur uit de grootte: opnames zijn 24 kbit/s (P30). */
export const duurVan = (bytes: number) => Math.max(1, Math.round((bytes * 8) / 24000))

/**
 * Een opname transcriberen. Credits op: de opname blijft staan en wacht (`wacht: true`). Langer dan
 * 15 minuten: 413. De tekst komt in transcripten (12 maanden).
 */
export async function transcribeer(tx: Tx, org: string, gebruikerId: string, bijlageId: string, nu = new Date()): Promise<{ tekst: string | null; wacht?: boolean; reden?: string; seconden: number }> {
  const [b] = await rijen(tx, sql`select id, soort, mime, grootte, inhoud, record_soort, record_id, status from bijlagen where id = ${bijlageId}`)
  if (!b || b.soort !== 'opname') throw Object.assign(new Error('Opname niet gevonden'), { statusCode: 404, statusMessage: 'Opname niet gevonden' })
  const [al] = await rijen(tx, sql`select tekst, duur_sec from transcripten where bijlage_id = ${bijlageId}`)
  if (al) return { tekst: al.tekst, seconden: al.duur_sec }
  if (!b.inhoud) throw Object.assign(new Error('Opname al gewist'), { statusCode: 410, statusMessage: 'Deze opname is al verwerkt en gewist' })
  const seconden = duurVan(b.grootte)
  if (seconden > 15 * 60) throw Object.assign(new Error('Te lang'), { statusCode: 413, statusMessage: 'Een opname is hooguit 15 minuten' })
  let r
  try { r = await reserveer(tx, org, { soort: 'transcriptie', gebruikerId, context: { seconden } }, nu) } catch (e: any) {
    if (e?.statusCode === 402) return { tekst: null, wacht: true, reden: 'De AI-credits zijn op. Je opname is bewaard en wordt omgezet zodra er weer credits zijn.', seconden }
    throw e
  }
  let uit
  try { uit = await dienst(b.inhoud as Buffer, b.mime, b.id) } catch (e) { await geefVrij(tx, r); throw e }
  await boek(tx, r, { agent: 'gebruiker', handeling: 'transcriptie' }, nu)
  await tx.execute(sql`insert into transcripten (organisation_id, bijlage_id, record_soort, record_id, tekst, dienst, duur_sec) values (${org}, ${b.id}, ${b.record_soort}, ${b.record_id}, ${uit.tekst}, ${uit.dienst}, ${seconden})`)
  const [inst] = await rijen(tx, sql`select value from org_settings where key = 'spraak'`)
  const bewaren = !!(inst?.value as any)?.opnamesBewaren
  await tx.execute(sql`update bijlagen set status = 'verwerkt', inhoud = ${bewaren ? sql`inhoud` : null} where id = ${b.id}`)
  if (bewaren) await tx.execute(sql`update bijlagen set bewaren_tot = current_date + make_interval(days => ${Number((inst?.value as any)?.bewaartermijnDagen) || 90}) where id = ${b.id}`)
  return { tekst: uit.tekst, seconden }
}
