// Onderweg (P30, 8.5.2, 8.5.3, 8.8): het dagpakket waarmee een hele dag offline lukt, "In de buurt",
// bezoek afronden en het inloopbezoek. Eén schrijfweg: dezelfde functies achter de sync-wachtrij en
// de directe endpoints. De locatie van de gebruiker komt alleen binnen als parameter en wordt nergens
// opgeslagen of gelogd.
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { catalogusVoor } from '../../shared/functies'
import { NEE_REDENEN } from '../../shared/nbStatus'
import { kansScore, schatReistijd, type Punt } from '../../shared/route'
import { nlMoment, plusDagen } from '../../shared/datum'
import { meetingsoorten, rondAfAfspraak, type AfrondInvoer } from './agenda'
import { bezoekDag, gebiedenInstelling, geocodeerOntbrekend, laadKandidaten, type Gebruiker } from './bezoeken'
import { leesArtikelen } from './help'
import { gebruikDb } from './db'
import { reistijden } from './routedienst'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
export const DAGPAKKET_MAX = 5 * 1024 * 1024

/** Accountkaarten voor offline: contacten, laatste tien contactmomenten, open taken en afspraken. */
async function accountkaarten(tx: Tx, ids: string[]) {
  if (!ids.length) return []
  const lijst = ids.join(',')
  const accs = await rijen(tx, sql`select id, name, city, postcode, fase_id, nb_status, score, lat, lng, data->>'adres' as adres, data->>'telefoon' as telefoon, laatste_contact_op from accounts where id = any(string_to_array(${lijst}, ','))`)
  const cs = await rijen(tx, sql`select id, account_id, first_name, last_name, rol, email, status, data->>'telefoon' as telefoon, data->>'mobiel' as mobiel, data->>'functie' as functie from contacts where account_id = any(string_to_array(${lijst}, ',')) and status <> 'vertrokken'`)
  const ms = await rijen(tx, sql`select * from (select account_id, soort, kanaal, uitkomst, op, data->>'tekst' as tekst, row_number() over (partition by account_id order by op desc) as n from activiteiten where account_id = any(string_to_array(${lijst}, ','))) x where n <= 10`)
  const ts = await rijen(tx, sql`select id, account_id, title, action_type, due_date from tasks where account_id = any(string_to_array(${lijst}, ',')) and status in ('open', 'bezig')`)
  const ap = await rijen(tx, sql`select id, account_id, start_at, status from appointments where account_id = any(string_to_array(${lijst}, ',')) and status = 'gepland'`)
  return accs.map((a) => ({
    id: a.id, naam: a.name, plaats: a.city, postcode: a.postcode, adres: a.adres, telefoon: a.telefoon, fase: a.fase_id, status: a.nb_status, score: a.score, punt: a.lat != null ? { lat: a.lat, lng: a.lng } : null, laatsteContactOp: iso(a.laatste_contact_op),
    contacten: cs.filter((c) => c.account_id === a.id).map((c) => ({ id: c.id, naam: [c.first_name, c.last_name].filter(Boolean).join(' '), rol: c.rol, functie: c.functie, email: c.email, telefoon: c.mobiel ?? c.telefoon })),
    momenten: ms.filter((m) => m.account_id === a.id).map((m) => ({ soort: m.soort, kanaal: m.kanaal, uitkomst: m.uitkomst, op: iso(m.op), tekst: m.tekst })),
    taken: ts.filter((t) => t.account_id === a.id).map((t) => ({ id: t.id, titel: t.title, soort: t.action_type, op: iso(t.due_date) })),
    afspraken: ap.filter((x) => x.account_id === a.id).map((x) => ({ id: x.id, start: iso(x.start_at) })),
  }))
}

/**
 * Het dagpakket (8.8): vandaag en morgen (route, kansen, bellijst), de accountkaarten daarvan,
 * meetingsoorten met uitkomsten, redenen voor nee en de helpartikelen van de functies die aan staan.
 * Hooguit 5 MB zonder foto's; daarboven worden eerst kansen en bellijst ingekort.
 */
export async function dagpakket(tx: Tx, org: string, g: Gebruiker, ctx: { gebruiker: any; organisatie: any; stand: any }, datum: string, extra: string[] = [], nu = new Date()) {
  const filters = { alleenMijn: true, alleenProspects: true, maxOmrij: 20, aantal: 10, ongepland: false }
  const vandaag = await bezoekDag(tx, g, datum, filters, nu)
  const morgen = await bezoekDag(tx, g, plusDagen(datum, new Date(`${datum}T12:00:00Z`).getUTCDay() === 5 ? 3 : 1), filters, nu, { bellijst: false, teplannen: false, kansenAlle: true })
  const ids = [...new Set([...[vandaag, morgen].flatMap((d) => [...d.stops.map((s) => s.accountId), ...d.kansen.map((k) => k.id), ...d.bellijst.map((b: any) => b.accountId)]), ...extra].filter(Boolean) as string[])]
  const kaarten = await accountkaarten(tx, ids)
  const catalogus = catalogusVoor(ctx.gebruiker, ctx.organisatie, ctx.stand)
  const aan = new Set(catalogus.filter((f: any) => f.beschikbaar).map((f: any) => f.helpartikel).filter(Boolean))
  const help = (await leesArtikelen(tx)).filter((a) => aan.has(a.slug)).map((a) => ({ slug: a.slug, titel: a.titel, samenvatting: a.samenvatting, inhoud: a.inhoud }))
  const pakket: any = { datum, dagen: [vandaag, morgen], accounts: kaarten, meetingsoorten: (await meetingsoorten(tx)).filter((m) => m.actief), neeRedenen: NEE_REDENEN, help }
  let json = JSON.stringify(pakket)
  if (json.length > DAGPAKKET_MAX) {
    for (const d of pakket.dagen) { d.kansen = d.kansen.slice(0, 3); d.bellijst = d.bellijst.slice(0, 5) }
    pakket.help = pakket.help.map((h: any) => ({ ...h, inhoud: h.inhoud.slice(0, 2000) }))
    json = JSON.stringify(pakket)
  }
  const versie = createHash('sha256').update(json).digest('hex').slice(0, 16)
  await tx.execute(sql`insert into dagpakket_versies (organisation_id, gebruiker_id, datum, versie, grootte, accounts) values (${org}, ${g.id}, ${datum}, ${versie}, ${json.length}, ${kaarten.length})
    on conflict (gebruiker_id, datum) do update set versie = excluded.versie, grootte = excluded.grootte, accounts = excluded.accounts, gemaakt_op = now()`)
  return { ...pakket, versie, grootte: json.length, gemaaktOp: nu.toISOString() }
}

/** In de buurt: eigen prospects en klanten binnen `minuten` reistijd, op kansscore, met reden. De plek wordt niet bewaard. */
export async function inDeBuurt(tx: Tx, ik: string, plek: Punt, minuten = 15, alleenProspects = false, nu = new Date()) {
  await geocodeerOntbrekend(tx)
  const { regels } = await gebiedenInstelling(tx)
  const kand = (await laadKandidaten(tx, ik, nlMoment(nu).datum, null, false, nu))
    .filter((k) => k.punt && k.ownerId === ik && k.nbStatus !== 'nee' && (!alleenProspects || k.soort === 'prospect') && !(k.afkoelingBezoekTot && Date.parse(k.afkoelingBezoekTot) > nu.getTime()))
  const voor = kand.map((k) => ({ k, t: schatReistijd(plek, k.punt!).minuten })).filter((x) => x.t <= minuten * 1.3).sort((a, b) => a.t - b.t).slice(0, 20)
  const fn = await reistijden(tx, voor.map((x) => [plek, x.k.punt!] as [Punt, Punt]))
  return voor.map(({ k }) => {
    const t = fn(plek, k.punt!)
    const { score } = kansScore(k.basisscore, k.bronnen, t.minuten, false, regels.gewichten)
    const reden = k.bronnen[0]?.label ?? (k.laatsteContactOp ? `Laatste contact ${new Date(k.laatsteContactOp).toLocaleDateString('nl-NL')}` : 'Nog nooit gesproken')
    return { id: k.id, naam: k.naam, soort: k.soort, punt: k.punt, minuten: t.minuten, schatting: t.schatting, score, reden, contact: k.contact, geoBron: k.geoBron }
  }).filter((x) => x.minuten <= minuten).sort((a, b) => b.score - a.score || a.minuten - b.minuten)
}

export interface BezoekAfronden extends AfrondInvoer { afspraakId: string; bijlagen?: string[]; volgendeStap?: { titel: string; datum: string; soort?: string } | null; nieuwContact?: { naam: string; functie?: string | null; telefoon?: string | null } | null }
/** Bezoek afronden (8.5.3): de uitkomst via "Rond af" van P13, plus bijlagen, nieuwe contactpersoon en een eigen volgende stap. */
export async function bezoekAfronden(tx: Tx, org: string, door: string, b: BezoekAfronden, nu = new Date()) {
  const [ap] = await rijen(tx, sql`select id, account_id, owner_id, status, uitkomst_code from appointments where id = ${b.afspraakId}`)
  if (!ap) fout(404, 'Afspraak niet gevonden')
  const r = await rondAfAfspraak(tx, org, ap!.id, door, { ...b, sleutel: b.sleutel ?? null }, nu)
  if (r.alAfgerond) return r
  if (b.bijlagen?.length) {
    await tx.execute(sql`update appointments set data = data || ${JSON.stringify({ bijlagen: b.bijlagen })}::jsonb where id = ${ap!.id}`)
    await tx.execute(sql`update bijlagen set record_soort = 'appointments', record_id = ${ap!.id} where id = any(string_to_array(${b.bijlagen.join(',')}, ','))`)
  }
  if (b.nieuwContact?.naam?.trim() && ap!.account_id) {
    const delen = b.nieuwContact.naam.trim().split(/\s+/)
    await tx.execute(sql`insert into contacts (organisation_id, account_id, first_name, last_name, status, data) values (${org}, ${ap!.account_id}, ${delen.length > 1 ? delen[0] : null}, ${delen.length > 1 ? delen.slice(1).join(' ') : delen[0]}, 'actief', ${JSON.stringify({ functie: b.nieuwContact.functie ?? null, telefoon: b.nieuwContact.telefoon ?? null, bron: 'bezoek', herkomst: { naam: 'Bezoek', op: nu.toISOString() } })}::jsonb)`)
  }
  if (b.volgendeStap?.titel?.trim() && b.volgendeStap.datum && ap!.account_id) {
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${org}, ${ap!.owner_id}, ${ap!.account_id}, ${b.volgendeStap.soort ?? 'bellen'}, ${b.volgendeStap.titel.trim()}, 'open', 'middel', ${new Date(`${b.volgendeStap.datum}T07:00:00Z`).toISOString()}, 'mens', ${JSON.stringify({ herkomst: { bron: 'bezoek' }, afspraakId: ap!.id })}::jsonb)`)
  }
  // De verslaganalyse (Notulist) loopt in rondAfAfspraak (P19).
  return r
}

/** Inloopbezoek: een afspraak "Ongepland bezoek" op dit moment, die je daarna afrondt. Idempotent op het id. */
export async function legInloopVast(tx: Tx, org: string, door: string, i: { id?: string | null; accountId: string; tijd?: string | null }) {
  const id = i.id && /^[0-9a-f-]{36}$/i.test(i.id) ? i.id : crypto.randomUUID()
  const [al] = await rijen(tx, sql`select id from appointments where id = ${id}`)
  if (al) return { id, nieuw: false }
  const [a] = await rijen(tx, sql`select id, name, city, data->>'adres' as adres from accounts where id = ${i.accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  const [ms] = await rijen(tx, sql`select id from meetingsoorten where slug = 'ongepland-bezoek'`)
  if (!ms) fout(422, 'De meetingsoort Ongepland bezoek ontbreekt. Vul de startset aan.')
  const start = i.tijd && !Number.isNaN(Date.parse(i.tijd)) ? new Date(i.tijd) : new Date()
  await tx.execute(sql`insert into appointments (id, organisation_id, owner_id, gepland_door, account_id, meetingsoort_id, vorm, status, start_at, end_at, data) values (${id}, ${org}, ${door}, ${door}, ${a!.id}, ${ms!.id}, 'bezoek', 'gepland', ${start.toISOString()}, ${new Date(start.getTime() + 30 * 60_000).toISOString()}, ${JSON.stringify({ inloop: true, locatie: [a!.adres, a!.city].filter(Boolean).join(', ') || null })}::jsonb)`)
  return { id, nieuw: true, accountNaam: a!.name }
}
