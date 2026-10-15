// Spraak (P31, 8.5.6): een ingesproken zin wordt via de AI (Notulist-familie, mandaat A voor het
// concept) één concept, dat de server controleert: het account komt uit de eigen lijst, de persoon
// uit de contacten van dat account. "Bewaar" schrijft direct een echte taak, notitie of afspraak;
// een mail blijft een concept. Het visitekaartje (Profielbouwer-familie) wordt een conceptcontact.
import { sql } from 'drizzle-orm'
import type { JsonSchema } from '../../shared/aiStap'
import { normaliseerTelefoon } from '../../shared/contactgegevens'
import { nlTijdstip } from '../../shared/datum'
import { normaliseerVisitekaartje, visitekaartjeDuplicaat } from '../../shared/ontdubbelen'
import { controleerOpdracht, type Concept, type OpdrachtAntwoord, type OpdrachtSoort, type Uitkomst } from '../../shared/spraakOpdracht'
import { planAfspraak } from './agenda'
import { gebruikDb } from './db'
import { voerAiStapUit } from './llm-provider'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }

export const OPDRACHT_SCHEMA: JsonSchema = {
  type: 'object', required: ['soort', 'accountNaam', 'titel'], additionalProperties: false,
  properties: { soort: { type: 'string', enum: ['taak', 'notitie', 'afspraak', 'mail'] }, accountNaam: { type: ['string', 'null'] as any }, persoonNaam: { type: ['string', 'null'] as any }, titel: { type: 'string', maxLength: 200 }, datum: { type: ['string', 'null'] as any }, tijd: { type: ['string', 'null'] as any } },
}
export const OPDRACHT_PROMPT = `Je zet één ingesproken zin om in één opdracht: taak, notitie, afspraak of mail.
Kies het account alleen uit de meegegeven lijst; staat het er niet in, geef dan null. Verzin geen namen.
Datum als JJJJ-MM-DD (vandaag staat in het materiaal), tijd als UU:MM. De titel is kort, in de je-vorm.`
export const VISITEKAARTJE_SCHEMA: JsonSchema = {
  type: 'object', required: ['naam'], additionalProperties: false,
  properties: { naam: { type: 'string', maxLength: 120 }, functie: { type: ['string', 'null'] as any }, bedrijf: { type: ['string', 'null'] as any }, telefoon: { type: ['string', 'null'] as any }, email: { type: ['string', 'null'] as any } },
}
export const VISITEKAARTJE_PROMPT = 'Lees alleen wat op dit visitekaartje staat: naam, functie, bedrijf, telefoon, e-mail. Vul niets aan van buiten het kaartje.'

export interface Spreker { id: string; niveau: string; data?: any }
export const toegestaneSoorten = (uitgebreid: boolean): OpdrachtSoort[] => (uitgebreid ? ['taak', 'notitie', 'afspraak', 'mail'] : ['taak', 'notitie'])

/** Eigen accounts (eigenaar, of een open taak of afspraak van jou) met naam en plaats: de lijst voor het model. */
async function eigenAccounts(tx: Tx, gebruikerId: string) {
  return (await rijen(tx, sql`select id, name, city from accounts where owner_id = ${gebruikerId}
    or id in (select account_id from tasks where owner_id = ${gebruikerId} and status in ('open', 'bezig'))
    or id in (select account_id from appointments where owner_id = ${gebruikerId} and status = 'gepland') order by name limit 400`)).map((a) => ({ id: a.id as string, naam: a.name as string, plaats: a.city as string | null }))
}
async function contactenVan(tx: Tx, accountIds: string[]) {
  if (!accountIds.length) return new Map<string, { id: string; naam: string }[]>()
  const cs = await rijen(tx, sql`select id, account_id, first_name, last_name from contacts where account_id = any(string_to_array(${accountIds.join(',')}, ',')) and status <> 'vertrokken'`)
  const m = new Map<string, { id: string; naam: string }[]>()
  for (const c of cs) m.set(c.account_id, [...(m.get(c.account_id) ?? []), { id: c.id, naam: [c.first_name, c.last_name].filter(Boolean).join(' ') }])
  return m
}

/** Een zin interpreteren: AI-stap (1 credit), daarna de controle op account, persoon, soort en datum. */
export async function interpreteer(tx: Tx, org: string, g: Spreker, zin: string, opties: { accountId?: string | null; uitgebreid: boolean; kandidaatId?: string | null }, nu = new Date()): Promise<Uitkomst> {
  const tekst = zin.trim()
  if (tekst.length < 3) return { soort: 'fout', tekst: 'Dat verstond ik niet. Probeer het nog eens of typ je opdracht.' }
  const accounts = await eigenAccounts(tx, g.id)
  const vast = opties.kandidaatId ?? opties.accountId ?? null
  if (vast && !accounts.some((a) => a.id === vast)) {
    const [a] = await rijen(tx, sql`select id, name, city from accounts where id = ${vast}`)
    if (a) accounts.push({ id: a.id, naam: a.name, plaats: a.city })
  }
  const r = await voerAiStapUit<OpdrachtAntwoord>(tx, org, { soort: 'spraakopdracht', prompt: OPDRACHT_PROMPT, schema: OPDRACHT_SCHEMA, materiaal: { zin: tekst, vandaag: nu.toISOString(), accounts: accounts.map((a) => ({ naam: a.naam, plaats: a.plaats })) }, gebruiker: g as any, accountId: vast, boekAls: 'gebruiker' }, nu)
  if (!r.ok) return { soort: 'fout', tekst: 'Dat lukte niet. Typ je opdracht of probeer het opnieuw.' }
  const contacten = await contactenVan(tx, accounts.map((a) => a.id))
  return controleerOpdracht(r.antwoord, accounts, (id) => contacten.get(id) ?? [], toegestaneSoorten(opties.uitgebreid), nu, vast)
}

/** "Bewaar": een echte taak, notitie of afspraak via dezelfde schrijfwegen; een mail blijft concept. Idempotent op de sleutel. */
export async function bewaarConcept(tx: Tx, org: string, g: { id: string; naam: string; rol: string; mag: { voorCollega: boolean } }, c: Concept, opties: { sleutel?: string | null; uitgebreid: boolean }, nu = new Date()) {
  if (!toegestaneSoorten(opties.uitgebreid).includes(c.soort)) fout(403, 'Deze soort opdracht staat voor jou nog niet aan')
  const [a] = await rijen(tx, sql`select id, name from accounts where id = ${c.accountId}`)
  if (!a) fout(422, 'Kies een bestaand account')
  if (c.contactId) { const [k] = await rijen(tx, sql`select id from contacts where id = ${c.contactId} and account_id = ${c.accountId}`); if (!k) fout(422, 'Die persoon hoort niet bij dit account') }
  const sleutel = opties.sleutel ?? null
  if (sleutel) {
    const [al] = await rijen(tx, sql`select id from tasks where data->>'spraakSleutel' = ${sleutel} union all select id::text from activiteiten where data->>'spraakSleutel' = ${sleutel} union all select id from appointments where data->>'spraakSleutel' = ${sleutel}`)
    if (al) return { soort: c.soort, id: al.id as string, tekst: 'Deze opdracht stond er al.' }
  }
  const herkomst = { bron: 'spraak', spraakSleutel: sleutel }
  if (c.soort === 'notitie') {
    const [n] = await rijen(tx, sql`insert into activiteiten (organisation_id, account_id, contact_id, soort, door, op, data) values (${org}, ${a!.id}, ${c.contactId}, 'notitie', ${g.id}, ${nu.toISOString()}, ${JSON.stringify({ tekst: c.titel, herkomst: 'spraak', spraakSleutel: sleutel })}::jsonb) returning id`)
    return { soort: c.soort, id: String(n!.id), tekst: `Notitie bewaard bij ${a!.name}.` }
  }
  if (c.soort === 'afspraak') {
    const [ms] = await rijen(tx, sql`select id from meetingsoorten where slug = ${/\bbel/i.test(c.titel) ? 'belafspraak' : 'kennismaking'} and actief`)
    if (!ms) fout(422, 'Er is geen passende meetingsoort')
    const r = await planAfspraak(tx, org, g, { accountId: a!.id, contactId: c.contactId, meetingsoortId: ms!.id, start: nlTijdstip(c.datum!, Number(c.tijd!.slice(0, 2)), Number(c.tijd!.slice(3, 5))).toISOString(), aanleiding: c.titel }, nu)
    if (sleutel) await tx.execute(sql`update appointments set data = data || ${JSON.stringify({ spraakSleutel: sleutel })}::jsonb where id = ${r.id}`)
    return { soort: c.soort, id: r.id, tekst: r.tekst }
  }
  const actie = c.soort === 'mail' ? 'mailen' : /^bel\b/i.test(c.titel) ? 'bellen' : /^(mail|stuur)\b/i.test(c.titel) ? 'mailen' : 'taak'
  const id = crypto.randomUUID()
  const data = c.soort === 'mail'
    ? { herkomst, spraakSleutel: sleutel, concept: { onderwerp: c.titel, tekst: '' }, aanleiding: 'Ingesproken mailopdracht; versturen wacht op jou.' }
    : { herkomst, spraakSleutel: sleutel, aanleiding: 'Ingesproken' }
  await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, contact_id, action_type, title, status, priority, due_date, executor, data) values (${id}, ${org}, ${g.id}, ${a!.id}, ${c.contactId}, ${actie}, ${c.titel}, 'open', 'middel', ${nlTijdstip(c.datum!, c.tijd ? Number(c.tijd.slice(0, 2)) : 9, c.tijd ? Number(c.tijd.slice(3, 5)) : 0).toISOString()}, 'mens', ${JSON.stringify(data)}::jsonb)`)
  return { soort: c.soort, id, tekst: c.soort === 'mail' ? `Mailconcept klaargezet voor ${a!.name}. Versturen doe je zelf.` : `Taak bewaard bij ${a!.name}.` }
}

/** Visitekaartje lezen (2 credits): conceptcontact met mogelijke duplicaten bij het account. */
export async function leesVisitekaartje(tx: Tx, org: string, g: Spreker, bijlageId: string, accountId: string | null, nu = new Date()) {
  const [b] = await rijen(tx, sql`select id, soort, mime, inhoud from bijlagen where id = ${bijlageId}`)
  if (!b || !['visitekaartje', 'foto'].includes(b.soort) || !b.inhoud) fout(404, 'Foto van het visitekaartje niet gevonden')
  const r = await voerAiStapUit<{ naam: string; functie?: string | null; bedrijf?: string | null; telefoon?: string | null; email?: string | null }>(tx, org, { soort: 'visitekaartje', prompt: VISITEKAARTJE_PROMPT, schema: VISITEKAARTJE_SCHEMA, materiaal: { bijlageId: b!.id, mime: b!.mime, beeld: (b!.inhoud as Buffer).toString('base64') }, gebruiker: g as any, accountId, boekAls: 'gebruiker' }, nu)
  if (!r.ok || !r.antwoord.naam?.trim()) fout(422, 'Dit kaartje is niet te lezen. Maak een scherpere foto of typ de gegevens.')
  const contact = normaliseerVisitekaartje((r as any).antwoord, (t) => { const n = normaliseerTelefoon(t); return n.ok ? n.e164 : null })
  let account: { id: string; naam: string } | null = null
  if (accountId) { const [a] = await rijen(tx, sql`select id, name from accounts where id = ${accountId}`); if (a) account = { id: a.id, naam: a.name } }
  if (!account && contact.bedrijf) { const [a] = await rijen(tx, sql`select id, name from accounts where lower(name) = lower(${contact.bedrijf}) limit 1`); if (a) account = { id: a.id, naam: a.name } }
  const bestaand = account ? (await rijen(tx, sql`select id, first_name, last_name, email, data->>'telefoon' as telefoon, data->>'mobiel' as mobiel from contacts where account_id = ${account.id}`)) : []
  const dubbel = visitekaartjeDuplicaat(contact, bestaand as any) as Rij | null
  await tx.execute(sql`update bijlagen set soort = 'visitekaartje', status = 'verwerkt' where id = ${bijlageId}`)
  return { contact, account, nieuwAccountVoorstel: !account && contact.bedrijf ? contact.bedrijf : null, duplicaat: dubbel ? { id: dubbel.id, naam: [dubbel.first_name, dubbel.last_name].filter(Boolean).join(' ') } : null }
}

/** Een contact uit een visitekaartje bewaren, of samenvoegen met het bestaande (alleen lege velden aanvullen). */
export async function bewaarVisitekaartje(tx: Tx, org: string, door: string, accountId: string, contact: ReturnType<typeof normaliseerVisitekaartje>, samenvoegenMet: string | null, nu = new Date()) {
  const [a] = await rijen(tx, sql`select id from accounts where id = ${accountId}`)
  if (!a) fout(422, 'Kies een account')
  const bestaand = await rijen(tx, sql`select id, first_name, last_name, email, data, data->>'telefoon' as telefoon, data->>'mobiel' as mobiel from contacts where account_id = ${accountId}`)
  const dubbel: Rij | null | undefined = samenvoegenMet ? bestaand.find((c) => c.id === samenvoegenMet) : visitekaartjeDuplicaat(contact, bestaand as any)
  const herkomst = { naam: 'Visitekaartje', op: nu.toISOString() }
  if (dubbel) {
    const d = { ...(dubbel.data ?? {}) }
    if (!d.functie && contact.functie) d.functie = contact.functie
    if (!d.telefoon && !d.mobiel && contact.telefoon) d[contact.telefoon.startsWith('+316') ? 'mobiel' : 'telefoon'] = contact.telefoon
    await tx.execute(sql`update contacts set email = coalesce(email, ${contact.email}), data = ${JSON.stringify(d)}::jsonb, updated_at = now() where id = ${dubbel.id}`)
    return { id: dubbel.id as string, samengevoegd: true, tekst: 'Samengevoegd met het bestaande contact.' }
  }
  const [c] = await rijen(tx, sql`insert into contacts (organisation_id, account_id, first_name, last_name, email, status, data) values (${org}, ${accountId}, ${contact.voornaam}, ${contact.achternaam}, ${contact.email}, 'actief',
    ${JSON.stringify({ functie: contact.functie, ...(contact.telefoon ? { [contact.telefoon.startsWith('+316') ? 'mobiel' : 'telefoon']: contact.telefoon } : {}), bron: 'visitekaartje', herkomst, toegevoegdDoor: door })}::jsonb) returning id`)
  return { id: c!.id as string, samengevoegd: false, tekst: 'Contact bewaard.' }
}

/**
 * Een opdracht die offline werd ingesproken: bij verbinding transcriberen en interpreteren, het
 * resultaat klaarzetten in spraak_concepten en een melding "Je opdracht van 10:42 staat klaar".
 * Daarna volgt "Bewaar" zoals altijd.
 */
export async function verwerkOfflineOpdracht(tx: Tx, org: string, g: Spreker, o: { bijlageId: string; accountId: string | null; op: Date; uitgebreid: boolean }, nu = new Date()) {
  const { transcribeer } = await import('./transcriptie')
  const t = await transcribeer(tx, org, g.id, o.bijlageId, nu)
  const uitkomst = t.tekst ? { ...(await interpreteer(tx, org, g, t.tekst, { accountId: o.accountId, uitgebreid: o.uitgebreid }, nu)), transcript: t.tekst } : { soort: 'fout', tekst: t.reden ?? 'De tekst volgt later.', transcript: null }
  const [c] = await rijen(tx, sql`insert into spraak_concepten (organisation_id, gebruiker_id, uitkomst) values (${org}, ${g.id}, ${JSON.stringify(uitkomst)}::jsonb) returning id`)
  const tijd = o.op.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
  await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${g.id}, 'herinnering', ${`Je opdracht van ${tijd} staat klaar`}, ${t.tekst ? t.tekst.slice(0, 140) : 'De tekst volgt zodra er weer credits zijn.'}, ${`/?spraak=${c!.id}`}, now(), '{}'::jsonb)`)
  return { id: c!.id as string }
}

/** Offline gescand kaartje: bij verbinding lezen en bewaren (dubbel wordt samengevoegd), met een melding. */
export async function leesEnBewaarVisitekaartje(tx: Tx, org: string, g: Spreker, accountId: string, bijlageId: string, nu = new Date()) {
  const r = await leesVisitekaartje(tx, org, g, bijlageId, accountId, nu)
  const b = await bewaarVisitekaartje(tx, org, g.id, accountId, r.contact, r.duplicaat?.id ?? null, nu)
  const naam = [r.contact.voornaam, r.contact.achternaam].filter(Boolean).join(' ')
  await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${g.id}, 'systeem', ${`Visitekaartje gelezen: ${naam}`}, ${b.samengevoegd ? 'Samengevoegd met het bestaande contact.' : 'Als contactpersoon bewaard.'}, ${`/accounts/${accountId}`}, now(), '{}'::jsonb)`)
  return b
}
