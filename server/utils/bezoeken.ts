// Bezoeken en kansen langs de route (P14, F10, F18). Geocodering met terugval, regio's toewijzen,
// de bezoekdag (route, statistiek, kansen, bellijst, te plannen) en de regio-analyse. De kansformule
// zelf staat in shared/route.ts (gat 16); de reistijden komen van de routedienst of de schatting.
import { sql } from 'drizzle-orm'
import { AFSPRAAKMATRIX_STANDAARD, geldendeCel, intervalDagen, klasseCode, leesMatrix, type Klasse } from '../../shared/ritmematrix'
import { bouwBellijst } from '../../shared/belblokken'
import { dekking, regioVan, regiodagVan, regiodagenVoor, type Regio } from '../../shared/gebieden'
import { afkoelingTot } from '../../shared/nbStatus'
import { bellijstNaastBezoeken, dagStatistiek, geocodeerTerugval, kansenLangsRoute, KANSREGELS_STANDAARD, schatReistijd, vrijeMomenten, type Kandidaat, type KansBron, type KansFilters, type KansRegels, type Punt, type RouteStop } from '../../shared/route'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { laadBelKandidaten } from './bellen'
import { gebruikDb } from './db'
import { reistijden, routedienstModus } from './routedienst'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))

async function instelling<T>(tx: Tx, key: string): Promise<T | undefined> {
  const [r] = await rijen(tx, sql`select value from org_settings where key = ${key}`)
  return r?.value as T | undefined
}
export async function gebiedenInstelling(tx: Tx): Promise<{ regios: Regio[]; synoniemen: Record<string, string>; regels: KansRegels }> {
  const regels = (await instelling<Partial<KansRegels>>(tx, 'kansRegels')) ?? {}
  return {
    regios: (await instelling<Regio[]>(tx, 'gebieden')) ?? [],
    synoniemen: (await instelling<Record<string, string>>(tx, 'plaatsSynoniemen')) ?? {},
    regels: { ...KANSREGELS_STANDAARD, ...regels, gewichten: { ...KANSREGELS_STANDAARD.gewichten, ...(regels.gewichten ?? {}) } },
  }
}

/** Coördinaten voor accounts zonder punt (adres, anders postcode, anders plaats), met de herkomst. */
export async function geocodeerOntbrekend(tx: Tx): Promise<number> {
  const { synoniemen } = await gebiedenInstelling(tx)
  const open = await rijen(tx, sql`select id, postcode, city, data->>'land' as land from accounts where lat is null limit 2000`)
  let n = 0
  for (const a of open) {
    const p = geocodeerTerugval({ postcode: a.postcode, plaats: a.city, land: a.land }, synoniemen)
    if (!p) continue
    await tx.execute(sql`update accounts set lat = ${p.lat}, lng = ${p.lng}, geo_bron = ${p.bron} where id = ${a.id}`)
    n++
  }
  return n
}

/** Elk account krijgt de regio op postcode, anders plaats; nieuwe prospects zonder eigenaar krijgen de eigenaar van de regio. */
export async function wijsRegiosToe(tx: Tx): Promise<number> {
  const { regios, synoniemen } = await gebiedenInstelling(tx)
  const alle = await rijen(tx, sql`select id, postcode, city, gebied_id, owner_id, account_kind, data->>'land' as land from accounts`)
  let n = 0
  for (const a of alle) {
    const r = regioVan({ postcode: a.postcode, plaats: a.city, land: a.land }, regios, synoniemen)
    if (r === a.gebied_id) continue
    const eigenaar = !a.owner_id && a.account_kind === 'prospect' ? regios.find((x) => x.id === r)?.eigenaren.buitendienst[0] ?? null : a.owner_id
    await tx.execute(sql`update accounts set gebied_id = ${r}, owner_id = ${eigenaar} where id = ${a.id}`)
    n++
  }
  return n
}

export interface BezoekFilters { alleenMijn: boolean; alleenProspects: boolean; maxOmrij: number; aantal: number | null; bron?: string | null; klasse?: string | null; brancheId?: string | null; ongepland: boolean }
export interface Gebruiker { id: string; naam: string; werkplek: string; data: any; niveau: 'beginner' | 'gevorderd' | 'expert' }

/** De stops van een dag: bezoekafspraken uit de agenda en (oude) bezoektaken met een tijd. */
async function stopsVan(tx: Tx, gebruikerId: string, dag: string) {
  const van = nlTijdstip(dag, 0).toISOString(); const tot = nlTijdstip(plusDagen(dag, 1), 0).toISOString()
  const afs = await rijen(tx, sql`select ap.id, ap.account_id, ap.contact_id, ap.start_at, ap.end_at, ap.status, ap.task_id, ap.data->>'verslagOp' as verslag_op, m.naam as soort, m.slug, a.name, a.city, a.lat, a.lng, a.geo_bron, a.fase_id, a.data->>'adres' as adres,
      coalesce((select coalesce(c.data->>'mobiel', c.data->>'telefoon') from contacts c where c.id = ap.contact_id), (select coalesce(c.data->>'mobiel', c.data->>'telefoon') from contacts c where c.account_id = ap.account_id and c.status <> 'vertrokken' order by (c.rol = 'beslisser') desc limit 1), a.data->>'telefoon') as telefoon
    from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id
    where ap.owner_id = ${gebruikerId} and ap.vorm = 'bezoek' and ap.status in ('gepland', 'afgerond') and ap.start_at >= ${van} and ap.start_at < ${tot}`)
  const taken = await rijen(tx, sql`select t.id, t.account_id, t.contact_id, t.due_date, t.title, t.data, a.name, a.city, a.lat, a.lng, a.geo_bron, a.fase_id, a.data->>'adres' as adres, a.data->>'telefoon' as telefoon
    from tasks t left join accounts a on a.id = t.account_id
    where t.owner_id = ${gebruikerId} and t.action_type = 'bezoek' and t.status in ('open', 'bezig') and t.data->>'soort' = 'afspraak' and t.due_date >= ${van} and t.due_date < ${tot}`)
  const stops = [
    ...afs.map((x) => ({ id: x.id, soort: 'afspraak' as const, titel: x.soort, accountId: x.account_id, contactId: x.contact_id, accountNaam: x.name, adres: [x.adres, x.city].filter(Boolean).join(', '), start: iso(x.start_at)!, eind: iso(x.end_at)!, status: x.status, taakId: x.task_id, punt: x.lat != null ? { lat: x.lat, lng: x.lng } : null, geoBron: x.geo_bron, soortSlug: x.slug as string | null, faseId: x.fase_id, telefoon: x.telefoon, plaats: x.city })),
    ...taken.map((x) => ({ id: x.id, soort: 'taak' as const, titel: x.title, accountId: x.account_id, contactId: x.contact_id, accountNaam: x.name, adres: [x.adres, x.city].filter(Boolean).join(', '), start: iso(x.due_date)!, eind: new Date(Date.parse(iso(x.due_date)!) + (Number(x.data?.duurMinuten) || 60) * 60_000).toISOString(), status: 'gepland', taakId: x.id, punt: x.lat != null ? { lat: x.lat, lng: x.lng } : null, geoBron: x.geo_bron, soortSlug: null as string | null, faseId: x.fase_id, telefoon: x.telefoon, plaats: x.city })),
  ].sort((a, b) => a.start.localeCompare(b.start))
  return stops
}

/** Alle kandidaten voor kansen: punt, eigenaar, status, basisscore en bronnen (bezoektaak, klaargezet, aanleiding, ritme, ongepland). */
export async function laadKandidaten(tx: Tx, ik: string, dag: string, regioVanDag: string | null, metOngepland: boolean, nu: Date): Promise<Kandidaat[]> {
  const accounts = await rijen(tx, sql`select id, name, owner_id, account_kind, nb_status, klasse, fase_id, gebied_id, vv_branche_id, doelgroep_id, score, lat, lng, geo_bron, laatste_contact_op, data->'nee' as nee from accounts where lat is not null`)
  const taken = await rijen(tx, sql`select id, account_id, title, created_at from tasks where owner_id = ${ik} and action_type = 'bezoek' and status in ('open', 'bezig') and coalesce(data->>'soort', '') <> 'afspraak' and data->>'afspraakId' is null`)
  const klaar = await rijen(tx, sql`select k.account_id, k.reden, k.datum, k.regio_id, u.name as van_naam, u.werkplek from klaargezet_voor k join users u on u.id = k.van_gebruiker where k.voor_gebruiker = ${ik} and k.status = 'open'`)
  const signalen = await rijen(tx, sql`select account_id, title, relevance_score, created_at from signals where account_id is not null and status in ('nieuw', 'gelezen') and created_at > ${new Date(nu.getTime() - 30 * 864e5).toISOString()} and relevance_score >= 60`)
  const bezoeken = await rijen(tx, sql`select account_id, max(op) as op from activiteiten where (soort in ('afspraak', 'bezoek') and kanaal = 'bezoek') or soort = 'bezoek' group by 1`)
  const contacten = await rijen(tx, sql`select distinct on (account_id) account_id, first_name, last_name, rol from contacts where status <> 'vertrokken' order by account_id, (rol = 'beslisser') desc, (rol = 'champion') desc, last_name`)
  const klassen = (await instelling<Klasse[]>(tx, 'klassen')) ?? []
  const matrix = leesMatrix(await instelling(tx, 'afspraakmatrix'), AFSPRAAKMATRIX_STANDAARD).matrix
  const laatsteBezoek = new Map(bezoeken.map((b) => [b.account_id, Date.parse(iso(b.op)!)]))
  const contact = new Map(contacten.map((c) => [c.account_id, { naam: [c.first_name, c.last_name].filter(Boolean).join(' '), rol: c.rol }]))
  const per = new Map<string, KansBron[]>()
  const voeg = (id: string, b: KansBron) => per.set(id, [...(per.get(id) ?? []), b])
  const taakVan = new Map<string, string>()
  for (const t of taken) if (t.account_id) { voeg(t.account_id, { soort: 'bezoektaak', label: 'Open bezoektaak' }); taakVan.set(t.account_id, t.id) }
  for (const k of klaar) if ((!k.datum || String(iso(k.datum)).slice(0, 10) === dag) && (!k.regio_id || !regioVanDag || k.regio_id === regioVanDag)) voeg(k.account_id, { soort: 'klaargezet', label: `Klaargezet door ${String(k.van_naam).replace(/^Testgebruiker /, '').split(' ')[0]}${k.werkplek === 'binnendienst' ? ' (binnendienst)' : ''}${k.reden ? `: ${k.reden}` : ''}` })
  for (const s of signalen) voeg(s.account_id, { soort: 'aanleiding', label: `Hete aanleiding: ${s.title}`, relevantie: s.relevance_score })
  for (const a of accounts) {
    const k = klassen.find((x) => x.id === a.klasse)
    const code = k ? klasseCode(k) : null
    const interval = intervalDagen(geldendeCel(matrix, 'bezoek', code, AFSPRAAKMATRIX_STANDAARD))
    if (interval && code) {
      const laatst = laatsteBezoek.get(a.id)
      const sinds = laatst ? Math.floor((nu.getTime() - laatst) / 864e5) : null
      const achter = sinds === null ? (a.account_kind === 'klant' ? interval : 0) : sinds - interval
      if (achter > 0) voeg(a.id, { soort: 'ritme', label: `Bezoekritme achter: klasse ${code}, ${sinds === null ? 'nog nooit' : `${sinds} dagen niet`} geweest`, dagenAchter: achter })
    }
    if (metOngepland && a.account_kind === 'prospect' && ['nieuw', 'in reis'].includes(a.nb_status) && a.doelgroep_id && !per.has(a.id)) voeg(a.id, { soort: 'ongepland', label: 'Ongeplande prospect in een actieve doelgroep' })
  }
  return accounts.map((a) => ({
    id: a.id, naam: a.name, punt: { lat: a.lat, lng: a.lng }, geoBron: a.geo_bron ?? 'adres', ownerId: a.owner_id, soort: a.account_kind === 'klant' ? 'klant' : 'prospect', nbStatus: a.nb_status,
    afkoelingBezoekTot: a.nee ? afkoelingTot(a.nee, 'bezoek') : null, basisscore: a.score ?? 0, klasse: a.klasse, faseId: a.fase_id, regioId: a.gebied_id, brancheId: a.vv_branche_id,
    bronnen: per.get(a.id) ?? [], contact: contact.get(a.id) ?? null, laatsteContactOp: iso(a.laatste_contact_op), taakId: taakVan.get(a.id) ?? null,
  }))
}

/** Kansen rond een route: voorselectie met de schatting, dan echte reistijden voor de top 30. */
export async function berekenKansen(tx: Tx, route: { punten: Punt[]; stops: RouteStop[] }, kandidaten: Kandidaat[], f: KansFilters, regels: KansRegels, werkdag: { start: string; eind: string }) {
  const gaten = vrijeMomenten(route.stops, werkdag)
  const r = { ...route, gaten }
  const voor = kansenLangsRoute(r, kandidaten, { ...f, aantal: 30, maxOmrij: f.maxOmrij * 1.5 }, regels, schatReistijd)
  const paren: [Punt, Punt][] = []
  for (let i = 0; i < route.punten.length - 1; i++) paren.push([route.punten[i]!, route.punten[i + 1]!])
  for (const k of voor) for (const p of route.punten) paren.push([p, k.punt], [k.punt, p])
  const fn = await reistijden(tx, paren)
  const ids = new Set(voor.map((k) => k.id))
  return { kansen: kansenLangsRoute(r, kandidaten.filter((k) => ids.has(k.id)), f, regels, fn), gaten, reistijd: fn }
}

/** De bezoekdag van één gebruiker: route, statistiek, kansen, bellijst en te plannen bezoeken. */
export async function bezoekDag(tx: Tx, g: Gebruiker, dag: string, filters: BezoekFilters, nu = new Date(), mag: { bellijst: boolean; teplannen: boolean; kansenAlle: boolean } = { bellijst: true, teplannen: true, kansenAlle: true }) {
  await geocodeerOntbrekend(tx)
  const { regios, regels } = await gebiedenInstelling(tx)
  const feestdagen = ((await instelling<{ feestdagen?: string[] }>(tx, 'werkdagen'))?.feestdagen ?? []) as string[]
  const regio = regiodagVan(g.id, dag, regios, feestdagen)
  const stops = await stopsVan(tx, g.id, dag)
  const thuis: Punt | null = g.data?.thuisbasis?.lat != null ? { lat: g.data.thuisbasis.lat, lng: g.data.thuisbasis.lng } : null
  const metPunt = stops.filter((s) => s.punt)
  const start = thuis ?? metPunt[0]?.punt ?? null
  const punten = start ? [start, ...metPunt.map((s) => s.punt!), thuis ?? metPunt[metPunt.length - 1]?.punt ?? start] : []
  const routeStops: RouteStop[] = metPunt.map((s) => ({ id: s.id, start: s.start, eind: s.eind, punt: s.punt }))
  const werkdag = { start: nlTijdstip(dag, 8).toISOString(), eind: nlTijdstip(dag, 18).toISOString() }
  const kandidaten = await laadKandidaten(tx, g.id, dag, regio?.id ?? null, filters.ongepland, nu)
  const overgeslagen = new Set((await rijen(tx, sql`select account_id from kans_overslaan where gebruiker_id = ${g.id} and tot > ${nlMoment(nu).datum}`)).map((x) => x.account_id as string))
  const aantal = mag.kansenAlle ? filters.aantal : 3
  const f: KansFilters = { ikId: g.id, alleenMijn: filters.alleenMijn, alleenProspects: filters.alleenProspects, maxOmrij: filters.maxOmrij, aantal, regioId: regio?.id ?? null, bron: (filters.bron as any) || null, klasse: filters.klasse || null, brancheId: filters.brancheId || null, inRoute: new Set(stops.map((s) => s.accountId).filter(Boolean) as string[]), overgeslagen, nu }
  const { kansen, gaten, reistijd } = punten.length ? await berekenKansen(tx, { punten, stops: routeStops }, kandidaten, f, regels, werkdag) : { kansen: [], gaten: [], reistijd: schatReistijd }
  const stat = dagStatistiek(punten, routeStops, reistijd)
  // Reistijd naar de volgende stop, en de volgende stop van nu.
  const volgende = stops.find((s) => s.status === 'gepland' && Date.parse(s.eind) > nu.getTime())?.id ?? null
  const stopsUit = stops.map((s) => {
    const i = metPunt.findIndex((x) => x.id === s.id)
    const naar = i >= 0 && i < metPunt.length - 1 ? reistijd(metPunt[i]!.punt!, metPunt[i + 1]!.punt!) : null
    return { ...s, volgende: s.id === volgende, reistijdNaVolgende: naar ? { minuten: naar.minuten, km: naar.km, schatting: naar.schatting } : null }
  })
  // Bellijst naast de bezoeken: alleen die van dezelfde dag eruit (gat 30).
  const bellijst = mag.bellijst ? bellijstNaastBezoeken(bouwBellijst(await laadBelKandidaten(tx, g.id), nu, { top: 30 }), f.inRoute, filters.aantal && filters.aantal <= 5 ? 5 : 10) : []
  const teplannen = mag.teplannen ? (await rijen(tx, sql`select t.id, t.title, t.account_id, a.name, t.created_at, t.data->'herkomst'->>'bron' as bron from tasks t left join accounts a on a.id = t.account_id
    where t.owner_id = ${g.id} and t.action_type = 'bezoek' and t.status in ('open', 'bezig') and coalesce(t.data->>'soort', '') <> 'afspraak' and t.data->>'afspraakId' is null ${regio ? sql`and (a.gebied_id = ${regio.id} or a.gebied_id is null)` : sql``} order by t.created_at limit 20`))
    .map((t) => ({ id: t.id, titel: t.title, accountId: t.account_id, accountNaam: t.name, sinds: iso(t.created_at), herkomst: t.bron ?? 'handmatig' })) : []
  return {
    dag, regio: regio ? { id: regio.id, naam: regio.naam } : null, start: thuis ? 'thuis' : start ? 'eerste bezoek' : null, punten,
    stops: stopsUit, stat, gaten: gaten.filter((x) => x.minuten >= regels.gatMin), kansen, bellijst, teplannen, schatting: routedienstModus() === 'schatting' || stat.schatting,
    week: [0, 1, 2, 3, 4].map((i) => { const d = plusDagen(dag, i - ((new Date(`${dag}T12:00:00Z`).getUTCDay() + 6) % 7)); return { datum: d, regio: regiodagVan(g.id, d, regios, feestdagen)?.naam ?? null } }),
  }
}

/**
 * De werkweek rond een dag voor de dag- en weekindeling op /bezoeken: per werkdag de regiodag,
 * de stops en een telling (bezoeken, klantcontact, rijtijd en km als schatting langs de stops).
 */
export async function bezoekWeek(tx: Tx, g: { id: string; data?: any }, dag: string) {
  const { regios } = await gebiedenInstelling(tx)
  const feestdagen = ((await instelling<{ feestdagen?: string[] }>(tx, 'werkdagen'))?.feestdagen ?? []) as string[]
  const maandag = plusDagen(dag, -((new Date(`${dag}T12:00:00Z`).getUTCDay() + 6) % 7))
  const thuis: Punt | null = g.data?.thuisbasis?.lat != null ? { lat: g.data.thuisbasis.lat, lng: g.data.thuisbasis.lng } : null
  const uit = []
  for (let i = 0; i < 5; i++) {
    const d = plusDagen(maandag, i)
    const stops = await stopsVan(tx, g.id, d)
    const metPunt = stops.filter((s) => s.punt)
    const punten = metPunt.length ? [thuis ?? metPunt[0]!.punt!, ...metPunt.map((s) => s.punt!), thuis ?? metPunt[metPunt.length - 1]!.punt!] : []
    const stat = dagStatistiek(punten, metPunt.map((s) => ({ id: s.id, start: s.start, eind: s.eind, punt: s.punt })), schatReistijd)
    uit.push({ datum: d, regio: regiodagVan(g.id, d, regios, feestdagen)?.naam ?? null, stops, stat: { ...stat, bezoeken: stops.length } })
  }
  return uit
}

/** De regio-analyse: tellingen en dekking per regio, plus per regio de lijst (nooit bezocht, langst stil, klasse). */
export async function regioAnalyse(tx: Tx, eigenaren: string[] | null, nu = new Date()) {
  await geocodeerOntbrekend(tx)
  const { regios } = await gebiedenInstelling(tx)
  const accounts = await rijen(tx, sql`select id, name, account_kind, nb_status, gebied_id, klasse, fase_id, laatste_contact_op, owner_id, lat, lng from accounts ${eigenaren ? sql`where owner_id = any(string_to_array(${eigenaren.join(',')}, ','))` : sql``}`)
  const bezoeken = await rijen(tx, sql`select account_id, op from activiteiten where (kanaal = 'bezoek' or soort = 'bezoek')`)
  const accs = accounts.map((a) => ({ id: a.id, regioId: a.gebied_id ?? null, soort: (a.account_kind === 'klant' ? 'klant' : 'prospect') as 'klant' | 'prospect', nbStatus: a.nb_status }))
  const rows = dekking(accs, bezoeken.map((b) => ({ accountId: b.account_id, op: iso(b.op)! })), regios, nu)
  const laatste = new Map<string, number>()
  for (const b of bezoeken) laatste.set(b.account_id, Math.max(laatste.get(b.account_id) ?? 0, Date.parse(iso(b.op)!)))
  const zestig = nu.getTime() - 60 * 864e5
  const lijst = accounts.map((a) => ({ id: a.id, naam: a.name, regioId: a.gebied_id ?? null, soort: a.account_kind, status: a.nb_status, klasse: a.klasse, laatsteBezoek: laatste.has(a.id) ? new Date(laatste.get(a.id)!).toISOString() : null, punt: a.lat != null ? { lat: a.lat, lng: a.lng } : null }))
    .sort((x, y) => Number(!!x.laatsteBezoek) - Number(!!y.laatsteBezoek) || (x.laatsteBezoek ?? '').localeCompare(y.laatsteBezoek ?? '') || String(x.klasse ?? 'z').localeCompare(String(y.klasse ?? 'z')))
  const tot = rows.reduce((s, r) => ({ n: s.n + r.klanten + r.prospects, bezocht: s.bezocht + r.bezocht, stilNooit: s.stilNooit + r.stil + r.nooit, nietBenaderd: s.nietBenaderd + r.nietBenaderd }), { n: 0, bezocht: 0, stilNooit: 0, nietBenaderd: 0 })
  return {
    cijfers: {
      inBeeld: tot.n, stilOfNooit: tot.stilNooit, nietBenaderd: tot.nietBenaderd,
      gekwalificeerdZonderContact: accounts.filter((a) => a.fase_id === 'gekwalificeerd' && (!a.laatste_contact_op || Date.parse(iso(a.laatste_contact_op)!) < zestig)).length,
      bezochtProcent: tot.n ? Math.round((tot.bezocht / tot.n) * 100) : 0, doel: 80,
    },
    regios: rows, lijst,
  }
}

/** Klaarzetten voor de regiodag van een collega, met een melding (F24). Ook via de sync-wachtrij. */
export async function klaarzetten(tx: Tx, org: string, door: { id: string; naam: string }, accountId: string, k: { voorGebruiker: string; regioId: string | null; datum: string | null; reden: string }, nu = new Date()) {
  const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
  const [a] = await rijen(tx, sql`select id, name, gebied_id from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  const [u] = await rijen(tx, sql`select id, name, werkplek from users where id = ${k.voorGebruiker} and status = 'actief'`)
  if (!u || u.werkplek !== 'buitendienst') fout(400, 'Kies een collega van de buitendienst')
  const { regios } = await gebiedenInstelling(tx)
  const regioId = k.regioId ?? a!.gebied_id ?? null
  let datum = k.datum
  if (regioId) {
    const dagen = regiodagenVoor(regios.filter((r) => r.id === regioId), nlMoment(nu).datum, 42).filter((d) => d.gebruikerId === u!.id && d.datum >= nlMoment(nu).datum)
    if (!dagen.length) fout(400, `${String(u!.name).replace(/^Testgebruiker /, '')} heeft geen regiodag in deze regio`)
    if (!datum) datum = dagen[0]!.datum
  }
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into klaargezet_voor (id, organisation_id, account_id, van_gebruiker, voor_gebruiker, regio_id, datum, reden) values (${id}, ${org}, ${accountId}, ${door.id}, ${u!.id}, ${regioId}, ${datum}, ${k.reden})`)
  const naam = door.naam.replace(/^Testgebruiker /, '').split(' ')[0]
  const { meld } = await import('./onderwegMeldingen')
  await meld(tx, org, { soort: 'klaargezet', sleutel: `klaargezet:${id}`, gebruikerId: u!.id, titel: 'Klaargezet voor je regiodag',
    tekst: `${naam} zette ${a!.name} voor je klaar${datum ? ` op ${new Date(`${datum}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}` : ''}${k.reden ? `: ${k.reden}` : ''}.`, link: `/bezoeken${datum ? `?datum=${datum}` : ''}`, actie: 'Bekijk' }, nu)
  return { id, datum, regioId, tekst: `Klaargezet voor ${String(u!.name).replace(/^Testgebruiker /, '').split(' ')[0]}${datum ? `, ${new Date(`${datum}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}` : ''}.` }
}

/** De top drie kansen rond de plek van een vervallen afspraak, voor het inzicht "Gat in je agenda". */
export async function kansenRond(tx: Tx, eigenaar: string, accountId: string | null, start: Date, eind: Date, nu = new Date()) {
  if (!accountId) return []
  await geocodeerOntbrekend(tx)
  const [a] = await rijen(tx, sql`select lat, lng from accounts where id = ${accountId}`)
  if (a?.lat == null) return []
  const { regels } = await gebiedenInstelling(tx)
  const dag = nlMoment(start).datum
  const kandidaten = await laadKandidaten(tx, eigenaar, dag, null, false, nu)
  const p = { lat: a.lat, lng: a.lng }
  const { kansen } = await berekenKansen(tx, { punten: [p, p], stops: [] }, kandidaten, { ikId: eigenaar, alleenMijn: true, alleenProspects: false, maxOmrij: 30, aantal: 3, inRoute: new Set([accountId]), overgeslagen: new Set(), nu }, regels, { start: start.toISOString(), eind: eind.toISOString() })
  return kansen.map((k) => ({ accountId: k.id, naam: k.naam, omrij: k.omrij, bron: k.bronnen[0]?.label ?? null }))
}
