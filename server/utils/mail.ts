// Mail versturen (P18, 12): via de mailkoppeling van de organisatie (koppelingen, soort mail). Modus
// mock (lokaal, in tests en in de seed: niets verlaat de server, het postvak staat in het geheugen) of
// smtp (nodemailer; eerst testen, dan opslaan; SPF, DKIM en DMARC als voorwaarde). Een eerste mail
// krijgt de afmeldlink; een afgemeld adres staat gehasht op de onderdrukkingslijst en krijgt nooit meer mail.
import { resolveTxt } from 'node:dns/promises'
import { sql } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import { afmeldVoet, controleerDomeinRecords } from '../../shared/schrijver'
import { gebruikDb } from './db'
import { ontsleutel, onderteken } from './geheimen'
import { emailHash } from './importer'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

export interface MailInstelling { modus: 'mock' | 'smtp'; host?: string; poort?: number; gebruiker?: string; van: string; naam?: string; domein?: string; dkimSelector?: string }
export interface Bericht { aan: string; onderwerp: string; tekst: string }
export const MOCK_POSTVAK: (Bericht & { van: string; org: string; op: string })[] = []

export async function mailKoppeling(tx: Tx): Promise<(MailInstelling & { id: string }) | null> {
  const [k] = await rijen(tx, sql`select id, status, instellingen from koppelingen where soort = 'mail'`)
  return k && k.status === 'actief' ? { id: k.id, ...(k.instellingen as MailInstelling) } : null
}

/** SPF, DKIM en DMARC van het domein; de resolver is in te wisselen voor tests. */
export async function controleerDomein(domein: string, selector = 'default', resolver: (naam: string) => Promise<string[][]> = resolveTxt) {
  const lees = async (naam: string) => (await resolver(naam).catch(() => [] as string[][])).map((r) => r.join(''))
  return controleerDomeinRecords({ root: await lees(domein), dmarc: await lees(`_dmarc.${domein}`), dkim: await lees(`${selector}._domainkey.${domein}`) })
}

/** Test eerst (domein, dan de SMTP-verbinding); de fout in gewone taal. */
export async function testMail(i: MailInstelling, wachtwoord: string | null, resolver?: (naam: string) => Promise<string[][]>): Promise<{ ok: boolean; tekst: string }> {
  if (i.modus === 'mock') return { ok: true, tekst: 'De testmailbox werkt. Er gaat geen echte mail de deur uit.' }
  const domein = i.domein || i.van.split('@')[1] || ''
  const d = await controleerDomein(domein, i.dkimSelector || 'default', resolver)
  if (d.ontbreekt.length) return { ok: false, tekst: `Voor ${domein} ontbreekt ${d.ontbreekt.join(', ')}. Vraag je IT-beheerder dit in te stellen; zonder kun je niet versturen.` }
  try {
    await nodemailer.createTransport({ host: i.host, port: i.poort ?? 587, secure: (i.poort ?? 587) === 465, auth: i.gebruiker ? { user: i.gebruiker, pass: wachtwoord ?? '' } : undefined, connectionTimeout: 8000 }).verify()
    return { ok: true, tekst: 'De verbinding werkt.' }
  } catch {
    return { ok: false, tekst: 'De mailserver weigert de verbinding. Controleer het wachtwoord van het verzendadres.' }
  }
}

export function afmeldUrl(basis: string, org: string, email: string) {
  const h = emailHash(email)
  return `${basis}/api/afmelden?o=${encodeURIComponent(org)}&h=${h}&t=${onderteken(`${org}:${h}`)}`
}
export const isOndertekend = (org: string, h: string, t: string) => onderteken(`${org}:${h}`) === t

export async function isAfgemeld(tx: Tx, email: string) {
  return !!(await rijen(tx, sql`select 1 from onderdrukkingslijst where email_hash = ${emailHash(email)} limit 1`)).length
}

/**
 * Zonder mailkoppeling (alleen voor opvolgreeksen, `terugval`): via Resend met de platformafzender en de verkoper als
 * antwoordadres als RESEND_API_KEY er is, anders in de mock-outbox. Een .test-adres gaat nooit naar buiten.
 */
async function verstuurZonderKoppeling(org: string, b: Bericht & { tekst: string }, antwoordAan: string | null, nu: Date): Promise<{ ok: true } | { ok: false; status: number; tekst: string }> {
  const sleutel = process.env.RESEND_API_KEY
  if (sleutel && !b.aan.endsWith('.test')) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${sleutel}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_AFZENDER || 'Dealtrace <verkoop@dealtrace.nl>', to: [b.aan], subject: b.onderwerp, text: b.tekst, ...(antwoordAan ? { reply_to: antwoordAan } : {}) }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null)
    return res?.ok ? { ok: true } : { ok: false, status: 502, tekst: 'De mailserver nam de mail niet aan. Probeer het later opnieuw.' }
  }
  MOCK_POSTVAK.push({ ...b, van: antwoordAan ?? 'outbox', org, op: nu.toISOString() })
  if (MOCK_POSTVAK.length > 500) MOCK_POSTVAK.shift()
  return { ok: true }
}

/** Versturen: weigert een afgemeld adres; een eerste mail krijgt de informatieplicht. */
export async function verstuurMail(tx: Tx, org: string, b: Bericht, opties: { eersteMail: boolean; basisUrl: string; terugval?: boolean; antwoordAan?: string | null }, nu = new Date()): Promise<{ ok: true } | { ok: false; status: number; tekst: string }> {
  const k = await mailKoppeling(tx)
  if (!k && !opties.terugval) return { ok: false, status: 409, tekst: 'Er is nog geen mailkoppeling. Gebruik "Verstuur via je mail" of vraag je beheerder de mail te koppelen.' }
  if (await isAfgemeld(tx, b.aan)) return { ok: false, status: 403, tekst: 'Dit adres heeft zich afgemeld en krijgt geen mail meer.' }
  const tekst = opties.eersteMail ? `${b.tekst}${afmeldVoet(afmeldUrl(opties.basisUrl, org, b.aan), `${opties.basisUrl}/privacy`)}` : b.tekst
  if (!k) return verstuurZonderKoppeling(org, { ...b, tekst }, opties.antwoordAan ?? null, nu)
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start) values (${org}, ${k.id}, 'mail', 'versturen', ${nu.toISOString()}) returning id`)
  try {
    if (k.modus === 'mock') MOCK_POSTVAK.push({ ...b, tekst, van: k.van, org, op: nu.toISOString() })
    else {
      const [g] = await rijen(tx, sql`select geheimen from koppelingen where id = ${k.id}`)
      const pass = ontsleutel(g?.geheimen, 'mail')?.wachtwoord ?? ''
      await nodemailer.createTransport({ host: k.host, port: k.poort ?? 587, secure: (k.poort ?? 587) === 465, auth: k.gebruiker ? { user: k.gebruiker, pass } : undefined }).sendMail({ from: k.naam ? `"${k.naam}" <${k.van}>` : k.van, to: b.aan, subject: b.onderwerp, text: tekst })
    }
    await tx.execute(sql`update koppeling_runs set eind = now(), geschreven = 1 where id = ${run!.id}`)
    return { ok: true }
  } catch (e: any) {
    await tx.execute(sql`update koppeling_runs set eind = now(), fouten = ${JSON.stringify(['De mailserver gaf een fout'])}::jsonb where id = ${run!.id}`)
    return { ok: false, status: 502, tekst: 'De mailserver nam de mail niet aan. Probeer het later opnieuw.' }
  }
}
