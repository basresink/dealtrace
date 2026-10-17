// Reacties herkennen in de mailbox (F7). Een antwoord van een contact met een lopende opvolgreeks stopt die reeks en
// maakt een taak "bel terug binnen twee uur". Twee ingangen, één verwerking:
// 1. De webhook POST /api/mail/inkomend: de mailprovider van de organisatie stuurt inkomende mail door (ondertekende
//    URL per organisatie, te vinden op /instellingen/mail).
// 2. De poll in de cron van de reeksen (reeksSweep) via de adapter van de mailkoppeling. Modus mock leest het
//    postvak in het geheugen (lokaal en in tests, te vullen met POST /api/mail/inkomend/mock); voor smtp volgt een
//    IMAP-adapter, tot die tijd loopt het via de webhook.
// Zonder mailkoppeling of zonder inkomende mail blijven de bestaande stopregels gelden (afspraak, nee, afmelding,
// een gelogde reactie). Een automatisch antwoord (afwezig, bezorgfout) stopt de reeks niet. Elke mail wordt één keer
// verwerkt (uniek op bericht-id) en alleen met een fragment bewaard.
import { sql } from 'drizzle-orm'
import { isAutoAntwoord, mailAdres } from '../../shared/opvolgreeks'
import { onderteken } from './geheimen'
import { mailKoppeling } from './mail'
import { stopDoorMail } from './opvolgreeks'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

export interface InkomendeMail { berichtId?: string | null; van: string; aan?: string | null; onderwerp?: string | null; tekst?: string | null; op?: string | null; headers?: Record<string, string> | null }
export type Verwerking = 'gestopt' | 'auto-antwoord' | 'geen-reeks' | 'onbekend'
export interface VerwerkUitkomst { verwerking: Verwerking; dubbel: boolean; reeksen: string[]; belTerugTaken: string[] }

/** Het postvak van de mock-adapter per organisatie (in het geheugen, zoals MOCK_POSTVAK voor uitgaande mail). */
export const MOCK_INKOMEND: Record<string, InkomendeMail[]> = {}
export function zetInMockPostvak(org: string, m: InkomendeMail) {
  ;(MOCK_INKOMEND[org] ??= []).push(m)
  if (MOCK_INKOMEND[org]!.length > 200) MOCK_INKOMEND[org]!.shift()
}

/** De ondertekening van de webhook-URL per organisatie. */
export const inkomendToken = (org: string) => onderteken(`mail-inkomend:${org}`)
export const inkomendUrl = (basis: string, org: string) => `${basis}/api/mail/inkomend?o=${encodeURIComponent(org)}&t=${inkomendToken(org)}`

/** Velden van gangbare providers (Postmark, Resend, SendGrid, Mailgun) naar één vorm. */
export function leesWebhook(b: any): InkomendeMail | null {
  if (!b || typeof b !== 'object') return null
  const van = String(b.van ?? b.from ?? b.From ?? b.sender ?? b.FromFull?.Email ?? '')
  if (!mailAdres(van)) return null
  const headers: Record<string, string> = {}
  const h = b.headers ?? b.Headers
  if (Array.isArray(h)) for (const x of h) { if (x?.Name ?? x?.name) headers[String(x.Name ?? x.name)] = String(x.Value ?? x.value ?? '') }
  else if (h && typeof h === 'object') for (const [k, v] of Object.entries(h)) headers[k] = String(v)
  return {
    berichtId: String(b.berichtId ?? b.messageId ?? b.MessageID ?? b['Message-Id'] ?? headers['Message-ID'] ?? headers['message-id'] ?? '') || null,
    van, aan: String(b.aan ?? b.to ?? b.To ?? '') || null, onderwerp: String(b.onderwerp ?? b.subject ?? b.Subject ?? '') || null,
    tekst: String(b.tekst ?? b.text ?? b.TextBody ?? b['stripped-text'] ?? '') || null, op: b.op ?? b.date ?? b.Date ?? null, headers,
  }
}

/**
 * Eén inkomende mail verwerken binnen de organisatie (RLS). Zoekt het contact op het afzenderadres; heeft zijn account
 * een lopende of gepauzeerde reeks, dan stopt die met een taak bel terug (behalve bij een automatisch antwoord).
 */
export async function verwerkInkomend(tx: Tx, org: string, m: InkomendeMail, bron: 'webhook' | 'mock' | 'poll', nu = new Date()): Promise<VerwerkUitkomst> {
  const adres = mailAdres(m.van)
  const op = m.op && !Number.isNaN(Date.parse(m.op)) ? new Date(Math.min(Date.parse(m.op), nu.getTime())) : nu
  const berichtId = (m.berichtId?.trim() || `${adres}:${m.onderwerp ?? ''}:${op.toISOString()}`).slice(0, 300)
  if ((await rijen(tx, sql`select 1 from inkomende_mails where bericht_id = ${berichtId}`)).length) return { verwerking: 'onbekend', dubbel: true, reeksen: [], belTerugTaken: [] }
  const contacten = adres ? await rijen(tx, sql`select c.id, c.account_id from contacts c where lower(c.email) = ${adres} and c.status <> 'vertrokken'`) : []
  const accountIds = [...new Set(contacten.map((c) => c.account_id as string))]
  const reeksen = accountIds.length ? await rijen(tx, sql`select id, account_id, contact_id from reeksen where account_id in ${accountIds} and status in ('loopt', 'gepauzeerd')`) : []
  const auto = isAutoAntwoord(m)
  let verwerking: Verwerking = !contacten.length ? 'onbekend' : auto ? 'auto-antwoord' : reeksen.length ? 'gestopt' : 'geen-reeks'
  const gestopt: string[] = []
  const taken: string[] = []
  if (verwerking === 'gestopt') {
    for (const r of reeksen) {
      const c = contacten.find((x) => x.id === r.contact_id) ?? contacten.find((x) => x.account_id === r.account_id)
      const u = await stopDoorMail(tx, org, r.id, { van: adres!, onderwerp: m.onderwerp ?? null, fragment: m.tekst ?? null, contactId: c?.id ?? null }, op)
      if (u.gestopt) gestopt.push(r.id)
      if (u.belTerugTaakId) taken.push(u.belTerugTaakId)
    }
    if (!gestopt.length) verwerking = 'geen-reeks'
  }
  const eerste = reeksen[0] ?? null
  const contact = (eerste && contacten.find((x) => x.account_id === eerste.account_id)) ?? contacten[0] ?? null
  await tx.execute(sql`insert into inkomende_mails (organisation_id, bericht_id, van, onderwerp, fragment, ontvangen_op, bron, account_id, contact_id, reeks_id, verwerking)
    values (${org}, ${berichtId}, ${adres ?? String(m.van).slice(0, 200)}, ${m.onderwerp?.slice(0, 300) ?? null}, ${m.tekst?.slice(0, 500) ?? null}, ${op.toISOString()}, ${bron},
    ${contact?.account_id ?? null}, ${contact?.id ?? null}, ${gestopt[0] ?? null}, ${verwerking}) on conflict (organisation_id, bericht_id) do nothing`)
  return { verwerking, dubbel: false, reeksen: gestopt, belTerugTaken: taken }
}

/** De poll via de adapter van de mailkoppeling: mock leegt het postvak in het geheugen; smtp heeft (nog) geen lezer. */
export async function pollPostvak(tx: Tx, org: string, nu = new Date()) {
  const k = await mailKoppeling(tx)
  if (!k || k.modus !== 'mock') return { gelezen: 0, gestopt: 0 }
  const mails = (MOCK_INKOMEND[org] ?? []).splice(0)
  let gestopt = 0
  for (const m of mails) gestopt += (await verwerkInkomend(tx, org, m, 'mock', nu)).reeksen.length
  return { gelezen: mails.length, gestopt }
}

/** De laatste inkomende mails voor de instellingen (alleen de afzender, het onderwerp en wat ermee gebeurde). */
export async function laatsteInkomend(tx: Tx, n = 10) {
  return (await rijen(tx, sql`select van, onderwerp, ontvangen_op, verwerking, reeks_id from inkomende_mails order by ontvangen_op desc limit ${n}`)).map((r) => ({
    van: r.van as string, onderwerp: r.onderwerp as string | null, op: new Date(r.ontvangen_op).toISOString(), verwerking: r.verwerking as Verwerking, reeksId: r.reeks_id as string | null,
  }))
}
