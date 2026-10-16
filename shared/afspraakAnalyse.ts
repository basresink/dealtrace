// Bezoekanalyse en meetinganalyse (F10, F09, F18) in de opzet van DealDrive /bezoek-analyse en
// /meeting-analyse. De pure kern: het periodevenster, de dekking per account (gezien, stil, nooit),
// de dekking per regio en per accountklasse tegen de afspraakmatrix, de cijfers over afspraken
// (uitkomsten, verslagen, transcripten, Notulist, conversie en doorlooptijd naar vervolg) en de
// regiodagen met hun routes. De server laadt de rijen; alles wat telt, telt hier.
import { regiodagenVoor, type Regio } from './gebieden'
import { nlMoment, nlTijdstip, plusDagen } from './datum'
import { dagStatistiek, schatReistijd, type Punt } from './route'

const DAG = 864e5
const WEEKDAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
/** De vaste regiodagen van een regio kort in weekvolgorde ("ma, wo"), of null zonder regiodag. */
export function vasteDagen(r: Pick<Regio, 'dagen'>): string | null {
  const nrs = [...new Set((r.dagen ?? []).map((d) => d.weekdag))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return nrs.map((n) => WEEKDAG[n]).join(', ') || null
}

// ── Periode ──────────────────────────────────────────────────────────────────────────────────────

export type Venster = 'week' | 'maand' | 'kwartaal' | 'periode'
export const VENSTERS: { id: Venster; label: string; dagen: number }[] = [
  { id: 'week', label: 'Week', dagen: 7 },
  { id: 'maand', label: 'Maand', dagen: 30 },
  { id: 'kwartaal', label: 'Kwartaal', dagen: 90 },
  { id: 'periode', label: 'Periode', dagen: 0 },
]
export interface Bereik { venster: Venster; van: string; tot: string; vanMs: number; totMs: number; dagen: number; binnen: string; buiten: string }

const isDatum = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

/**
 * Het venster uit de query. Week, maand en kwartaal tellen terug vanaf nu (kwartaal is 90 dagen, de
 * ruststand en het oude "Bezocht in 90 dagen"); Periode loopt van de eerste tot en met de laatste dag,
 * en een begin na het eind schuift het eind mee.
 */
export function leesVenster(q: { venster?: unknown; van?: unknown; tot?: unknown }, nu: Date): Bereik {
  const venster: Venster = VENSTERS.some((v) => v.id === q.venster) ? (q.venster as Venster) : 'kwartaal'
  const vandaag = nlMoment(nu).datum
  if (venster === 'periode') {
    const van = isDatum(q.van) ? q.van : plusDagen(vandaag, -30)
    let tot = isDatum(q.tot) ? q.tot : vandaag
    if (tot < van) tot = van
    const vanMs = nlTijdstip(van, 0).getTime()
    const totMs = nlTijdstip(plusDagen(tot, 1), 0).getTime() - 1
    return { venster, van, tot, vanMs, totMs, dagen: Math.max(1, Math.round((totMs + 1 - vanMs) / DAG)), binnen: 'in de periode', buiten: 'daarbuiten' }
  }
  const dagen = VENSTERS.find((v) => v.id === venster)!.dagen
  return { venster, van: nlMoment(new Date(nu.getTime() - dagen * DAG)).datum, tot: vandaag, vanMs: nu.getTime() - dagen * DAG, totMs: nu.getTime(), dagen, binnen: `binnen ${dagen} dagen`, buiten: `langer dan ${dagen} dagen` }
}

// ── Dekking per account ──────────────────────────────────────────────────────────────────────────

export interface AnalyseAccount {
  id: string; naam: string; soort: 'klant' | 'prospect'; nbStatus?: string | null; faseId?: string | null
  klasseCode?: string | null; regioId?: string | null; plaats?: string | null; punt?: Punt | null; ownerId?: string | null
  laatsteContactOp?: string | null
}
/** Eén gehouden bezoek of meeting op een account; `soort` is het label van de meetingsoort als die bekend is. */
export interface Moment { accountId: string; op: string; soort?: string | null }
export type DekkingStatus = 'gezien' | 'stil' | 'nooit'
/** Een regel in de accountflyout van de analyses. */
export interface FlyoutAccount { id: string; naam: string; soort: string; klasse: string | null; plaats: string | null; laatste: string | null; laatsteSoort?: string | null; dagenGeleden: number | null; toon: 'goed' | 'stil' | 'nooit' | 'geen' }
export interface AccountDekking { status: DekkingStatus; laatste: string | null; soort: string | null; dagenGeleden: number | null }

/**
 * Per account: gezien als er een moment binnen het venster viel, stil als er wel ooit een was maar niet
 * in het venster, nooit als er tot het eind van het venster geen enkel was. Anders dan in DealDrive telt
 * elk moment, niet alleen het laatste, zodat een eerdere periode ook klopt.
 */
export function dekkingPerAccount(accounts: Pick<AnalyseAccount, 'id'>[], momenten: Moment[], b: Pick<Bereik, 'vanMs' | 'totMs'>, nu: Date): Map<string, AccountDekking> {
  const per = new Map<string, { laatste: number; soort: string | null; inVenster: boolean }>()
  for (const m of momenten) {
    const t = Date.parse(m.op)
    if (Number.isNaN(t) || t > b.totMs || t > nu.getTime()) continue
    const e = per.get(m.accountId) ?? { laatste: -Infinity, soort: null, inVenster: false }
    if (t > e.laatste) { e.laatste = t; e.soort = m.soort ?? null }
    if (t >= b.vanMs) e.inVenster = true
    per.set(m.accountId, e)
  }
  const uit = new Map<string, AccountDekking>()
  for (const a of accounts) {
    const e = per.get(a.id)
    if (!e) { uit.set(a.id, { status: 'nooit', laatste: null, soort: null, dagenGeleden: null }); continue }
    uit.set(a.id, { status: e.inVenster ? 'gezien' : 'stil', laatste: new Date(e.laatste).toISOString(), soort: e.soort, dagenGeleden: Math.max(0, Math.floor((nu.getTime() - e.laatste) / DAG)) })
  }
  return uit
}

const procent = (deel: number, totaal: number) => (totaal ? Math.round((deel / totaal) * 100) : 0)

export interface RegioRij { regioId: string | null; naam: string; regiodag: string | null; beschrijving: string; klanten: number; prospects: number; nietBenaderd: number; totaal: number; gezien: number; stil: number; nooit: number; dekking: number }

/** De dekkingstabel per regio, gesorteerd op wat er stil ligt; "Zonder regio" altijd als laatste rij. */
export function regioDekking(accounts: AnalyseAccount[], dekking: Map<string, AccountDekking>, regios: Regio[]): RegioRij[] {
  const rij = (regioId: string | null, naam: string, regiodag: string | null, beschrijving: string): RegioRij => {
    const hier = accounts.filter((a) => (a.regioId ?? null) === regioId)
    const tel = (s: DekkingStatus) => hier.filter((a) => dekking.get(a.id)?.status === s).length
    const gezien = tel('gezien')
    return {
      regioId, naam, regiodag, beschrijving,
      klanten: hier.filter((a) => a.soort === 'klant').length, prospects: hier.filter((a) => a.soort === 'prospect').length,
      nietBenaderd: hier.filter((a) => a.soort === 'prospect' && (a.nbStatus ?? 'nieuw') === 'nieuw').length,
      totaal: hier.length, gezien, stil: tel('stil'), nooit: tel('nooit'), dekking: procent(gezien, hier.length),
    }
  }
  const bekend = new Set(regios.map((r) => r.id))
  const rijen = regios.map((r) => rij(r.id, r.naam, vasteDagen(r), beschrijfRegio(r)))
    .sort((x, y) => (y.stil + y.nooit) - (x.stil + x.nooit) || y.totaal - x.totaal)
  const zonder = rij(null, 'Zonder regio', null, 'valt buiten elke postcodereeks en plaatsnaam')
  // Een account met een regio die niet meer bestaat, hoort ook bij "Zonder regio".
  const wees = accounts.filter((a) => a.regioId && !bekend.has(a.regioId))
  if (wees.length) {
    const extra = regioDekking(wees.map((a) => ({ ...a, regioId: null })), dekking, [])[0]!
    for (const k of ['klanten', 'prospects', 'nietBenaderd', 'totaal', 'gezien', 'stil', 'nooit'] as const) zonder[k] += extra[k]
    zonder.dekking = procent(zonder.gezien, zonder.totaal)
  }
  return [...rijen, zonder]
}

export function beschrijfRegio(r: Pick<Regio, 'reeksen' | 'plaatsen'>): string {
  const reeksen = (r.reeksen ?? []).map((x) => (x.van === x.tot ? String(x.van) : `${x.van} tot ${x.tot}`)).join(', ')
  return reeksen || (r.plaatsen ?? []).slice(0, 3).join(', ')
}

/** De cijfers boven de bezoektabel. */
export function bezoekKpi(accounts: AnalyseAccount[], dekking: Map<string, AccountDekking>, nu: Date) {
  const tel = (s: DekkingStatus) => accounts.filter((a) => dekking.get(a.id)?.status === s).length
  const zestig = nu.getTime() - 60 * DAG
  const gezien = tel('gezien')
  return {
    inBeeld: accounts.length,
    inEenRegio: accounts.filter((a) => a.regioId).length,
    stil: tel('stil'), nooit: tel('nooit'), stilOfNooit: tel('stil') + tel('nooit'),
    nietBenaderd: accounts.filter((a) => a.soort === 'prospect' && (a.nbStatus ?? 'nieuw') === 'nieuw').length,
    gekwalificeerdZonderContact: accounts.filter((a) => a.faseId === 'gekwalificeerd' && (!a.laatsteContactOp || Date.parse(a.laatsteContactOp) < zestig)).length,
    dekking: procent(gezien, accounts.length), doel: 80,
  }
}

// ── Meetingritme per accountklasse ──────────────────────────────────────────────────────────────

export type RitmeStatus = 'opSchema' | 'achter' | 'nooit'
export interface KlasseRij { code: string; label: string; namen: string[]; ritme: string; perJaar: number | null; interval: number | null; klanten: number; prospects: number; nietBenaderd: number; totaal: number; opSchema: number; achter: number; nooit: number }

/**
 * Het meetingritme per account: op schema als de laatste gehouden meeting binnen het interval uit de
 * meeting-rij van de afspraakmatrix valt, achter als hij langer geleden is, nooit zonder meeting.
 * Zonder interval (klasse zonder meetingdoel, of geen klasse) valt er niets af te meten: null.
 */
export function ritmeStatus(laatste: string | null, interval: number | null, nu: Date): RitmeStatus | null {
  if (!interval) return null
  if (!laatste) return 'nooit'
  return (nu.getTime() - Date.parse(laatste)) / DAG <= interval ? 'opSchema' : 'achter'
}

export function klasseDekking(
  accounts: AnalyseAccount[], laatsteMeeting: Map<string, string | null>, klassen: { code: string; naam: string }[],
  ritme: (code: string) => { perJaar: number | null; interval: number | null; label: string }, nu: Date,
): { rijen: KlasseRij[]; status: Map<string, RitmeStatus | null>; zonderKlasse: number } {
  const codes = [...new Set([...klassen.map((k) => k.code), ...accounts.map((a) => a.klasseCode).filter((c): c is string => !!c)])].sort()
  const status = new Map<string, RitmeStatus | null>()
  const rijen = codes.map((code) => {
    const r = ritme(code)
    const hier = accounts.filter((a) => a.klasseCode === code)
    const telStatus = (s: RitmeStatus) => hier.filter((a) => status.get(a.id) === s).length
    for (const a of hier) status.set(a.id, ritmeStatus(laatsteMeeting.get(a.id) ?? null, r.interval, nu))
    return {
      code, label: `Klasse ${code}`, namen: klassen.filter((k) => k.code === code).map((k) => k.naam), ritme: r.label, perJaar: r.perJaar, interval: r.interval,
      klanten: hier.filter((a) => a.soort === 'klant').length, prospects: hier.filter((a) => a.soort === 'prospect').length,
      nietBenaderd: hier.filter((a) => a.soort === 'prospect' && (a.nbStatus ?? 'nieuw') === 'nieuw').length,
      totaal: hier.length, opSchema: telStatus('opSchema'), achter: telStatus('achter'), nooit: telStatus('nooit'),
    }
  })
  for (const a of accounts) if (!a.klasseCode) status.set(a.id, null)
  return { rijen, status, zonderKlasse: accounts.filter((a) => !a.klasseCode).length }
}

/** De vier cijfers boven de klassetabel: gehouden in de periode, het doel uit de matrix, achter en ritmedekking. */
export function meetingKpi(rijen: KlasseRij[], gehouden: number, dagen: number) {
  const metDoel = rijen.filter((r) => r.interval)
  const totaal = metDoel.reduce((s, r) => s + r.totaal, 0)
  const opSchema = metDoel.reduce((s, r) => s + r.opSchema, 0)
  const doel = Math.round(metDoel.reduce((s, r) => s + (r.perJaar ?? 0) * r.totaal, 0) * dagen / 365)
  return { meetings: gehouden, doel, achter: totaal - opSchema, dekking: procent(opSchema, totaal), metDoel: totaal }
}

/** De optionele bril: meetingdekking per regio, met dezelfde status per account. */
export function regioRitme(accounts: AnalyseAccount[], status: Map<string, RitmeStatus | null>, regios: Regio[]) {
  return regios.map((r) => {
    const hier = accounts.filter((a) => a.regioId === r.id && status.get(a.id))
    const tel = (s: RitmeStatus) => hier.filter((a) => status.get(a.id) === s).length
    return { regioId: r.id, naam: r.naam, regiodag: vasteDagen(r), klanten: hier.filter((a) => a.soort === 'klant').length, prospects: hier.filter((a) => a.soort === 'prospect').length, totaal: hier.length, opSchema: tel('opSchema'), achter: tel('achter'), nooit: tel('nooit') }
  }).sort((x, y) => (y.achter + y.nooit) - (x.achter + x.nooit) || y.totaal - x.totaal)
}

// ── Afspraken in de periode ──────────────────────────────────────────────────────────────────────

export type AfspraakStatus = 'gepland' | 'afgerond' | 'niet_verschenen' | 'geannuleerd'
export interface AnalyseAfspraak {
  id: string; accountId: string | null; ownerId: string; soortSlug: string; soortNaam: string; vorm: 'bezoek' | 'online' | 'telefoon'
  status: AfspraakStatus; start: string; uitkomstCode: string | null; uitkomstLabel: string | null
  /** Het gevolg van de uitkomst uit de meetingsoort: gehouden en afspraak tellen als vervolg. */
  gevolg: string | null; verslag: boolean; transcript: boolean; notulist: boolean
}
export const VERVOLG_GEVOLGEN = ['gehouden', 'afspraak'] as const
export const isVervolg = (a: Pick<AnalyseAfspraak, 'status' | 'gevolg'>) => a.status === 'afgerond' && !!a.gevolg && (VERVOLG_GEVOLGEN as readonly string[]).includes(a.gevolg)

export function mediaan(getallen: number[]): number | null {
  if (!getallen.length) return null
  const s = [...getallen].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2) * 10) / 10
}

/**
 * Doorlooptijd naar vervolg: na een gehouden afspraak met een vervolguitkomst het aantal dagen tot de
 * volgende afspraak met hetzelfde account (niet geannuleerd, elke vorm). Zonder die afspraak telt hij
 * als "vervolg nog niet ingepland".
 */
export function doorlooptijden(inVenster: AnalyseAfspraak[], alle: Pick<AnalyseAfspraak, 'id' | 'accountId' | 'start' | 'status'>[]): { dagen: number[]; nietIngepland: string[] } {
  const perAccount = new Map<string, { id: string; t: number }[]>()
  for (const a of alle) if (a.accountId && a.status !== 'geannuleerd') perAccount.set(a.accountId, [...(perAccount.get(a.accountId) ?? []), { id: a.id, t: Date.parse(a.start) }])
  const dagen: number[] = []
  const nietIngepland: string[] = []
  for (const a of inVenster) {
    if (!isVervolg(a) || !a.accountId) continue
    const t = Date.parse(a.start)
    const volgende = (perAccount.get(a.accountId) ?? []).filter((x) => x.id !== a.id && x.t > t).sort((x, y) => x.t - y.t)[0]
    if (volgende) dagen.push(Math.max(0, Math.round((volgende.t - t) / DAG)))
    else nietIngepland.push(a.id)
  }
  return { dagen, nietIngepland }
}

export interface AfspraakCijfers {
  totaal: number; gepland: number; afgerond: number; nietVerschenen: number; geannuleerd: number; zonderAfronding: number
  metVerslag: number; metTranscript: number; metNotulist: number; vervolg: number; conversie: number; verslagProcent: number
  doorlooptijd: { mediaan: number | null; gemiddeld: number | null; n: number }; nietIngepland: number
  uitkomsten: { code: string; label: string; aantal: number; vervolg: boolean }[]
}
export interface SoortRij extends AfspraakCijfers { slug: string; naam: string; vorm: string }

/** De cijfers over een lijst afspraken: status, verslag, transcript, Notulist, uitkomsten, conversie en doorlooptijd. */
export function afspraakCijfers(inVenster: AnalyseAfspraak[], alle: Pick<AnalyseAfspraak, 'id' | 'accountId' | 'start' | 'status'>[], nu: Date): AfspraakCijfers {
  const tel = (f: (a: AnalyseAfspraak) => boolean) => inVenster.filter(f).length
  const afgerond = tel((a) => a.status === 'afgerond')
  const vervolg = tel(isVervolg)
  const metVerslag = tel((a) => a.status === 'afgerond' && a.verslag)
  const d = doorlooptijden(inVenster, alle)
  const uitkomsten = new Map<string, { code: string; label: string; aantal: number; vervolg: boolean }>()
  for (const a of inVenster) {
    if (a.status !== 'afgerond' || !a.uitkomstCode) continue
    const u = uitkomsten.get(a.uitkomstCode) ?? { code: a.uitkomstCode, label: a.uitkomstLabel ?? a.uitkomstCode, aantal: 0, vervolg: isVervolg(a) }
    u.aantal++
    uitkomsten.set(a.uitkomstCode, u)
  }
  return {
    totaal: inVenster.length,
    gepland: tel((a) => a.status === 'gepland' && Date.parse(a.start) > nu.getTime()),
    zonderAfronding: tel((a) => a.status === 'gepland' && Date.parse(a.start) <= nu.getTime()),
    afgerond, nietVerschenen: tel((a) => a.status === 'niet_verschenen'), geannuleerd: tel((a) => a.status === 'geannuleerd'),
    metVerslag, metTranscript: tel((a) => a.transcript), metNotulist: tel((a) => a.notulist),
    vervolg, conversie: procent(vervolg, afgerond), verslagProcent: procent(metVerslag, afgerond),
    doorlooptijd: { mediaan: mediaan(d.dagen), gemiddeld: d.dagen.length ? Math.round((d.dagen.reduce((s, x) => s + x, 0) / d.dagen.length) * 10) / 10 : null, n: d.dagen.length },
    nietIngepland: d.nietIngepland.length,
    uitkomsten: [...uitkomsten.values()].sort((x, y) => y.aantal - x.aantal || x.label.localeCompare(y.label)),
  }
}

/** Dezelfde cijfers per meetingsoort, de drukste soort eerst. */
export function cijfersPerSoort(inVenster: AnalyseAfspraak[], alle: Pick<AnalyseAfspraak, 'id' | 'accountId' | 'start' | 'status'>[], nu: Date): SoortRij[] {
  const slugs = [...new Set(inVenster.map((a) => a.soortSlug))]
  return slugs.map((slug) => {
    const hier = inVenster.filter((a) => a.soortSlug === slug)
    return { slug, naam: hier[0]!.soortNaam, vorm: hier[0]!.vorm, ...afspraakCijfers(hier, alle, nu) }
  }).sort((x, y) => y.totaal - x.totaal || x.naam.localeCompare(y.naam))
}

// ── Regiodagen en routes ─────────────────────────────────────────────────────────────────────────

export interface RouteBezoek { ownerId: string; start: string; eind: string; accountId: string | null; regioId: string | null; punt: Punt | null }
export interface RouteDag { datum: string; gebruikerId: string; regioId: string | null; regioNaam: string | null; bezoeken: number; inRegio: number; km: number; rijMin: number }

/**
 * Per gebruiker en dag in de periode (tot en met vandaag): de regiodag uit de gebiedsindeling en de
 * gehouden of geplande bezoeken van die dag, met de geschatte afstand tussen de stops (hemelsbreed maal
 * 1,3; zonder start- en eindadres). Dagen zonder regiodag en zonder bezoek vallen weg.
 */
export function regiodagenEnRoutes(regios: Regio[], gebruikers: string[], bezoeken: RouteBezoek[], van: string, tot: string, feestdagen: string[] = []) {
  const aantalDagen = Math.max(0, Math.round((Date.parse(`${tot}T12:00:00Z`) - Date.parse(`${van}T12:00:00Z`)) / DAG) + 1)
  const regiodagen = regiodagenVoor(regios, van, aantalDagen, feestdagen).filter((d) => gebruikers.includes(d.gebruikerId))
  const sleutel = (g: string, d: string) => `${g}|${d}`
  const perDag = new Map<string, RouteBezoek[]>()
  for (const b of bezoeken) {
    const d = nlMoment(new Date(b.start)).datum
    if (d < van || d > tot || !gebruikers.includes(b.ownerId)) continue
    perDag.set(sleutel(b.ownerId, d), [...(perDag.get(sleutel(b.ownerId, d)) ?? []), b])
  }
  const regioVan = new Map(regiodagen.map((r) => [sleutel(r.gebruikerId, r.datum), r.gebiedId]))
  const alleSleutels = [...new Set([...regioVan.keys(), ...perDag.keys()])]
  const dagen: RouteDag[] = alleSleutels.map((k) => {
    const [gebruikerId, datum] = k.split('|') as [string, string]
    const regioId = regioVan.get(k) ?? null
    const stops = (perDag.get(k) ?? []).sort((x, y) => x.start.localeCompare(y.start))
    const metPunt = stops.filter((s) => s.punt)
    const stat = dagStatistiek(metPunt.map((s) => s.punt!), metPunt.map((s, i) => ({ id: String(i), start: s.start, eind: s.eind, punt: s.punt })), schatReistijd)
    return { datum, gebruikerId, regioId, regioNaam: regios.find((r) => r.id === regioId)?.naam ?? null, bezoeken: stops.length, inRegio: regioId ? stops.filter((s) => s.regioId === regioId).length : 0, km: stat.km, rijMin: stat.rijMin }
  }).sort((x, y) => y.datum.localeCompare(x.datum) || x.gebruikerId.localeCompare(y.gebruikerId))
  const opRegiodag = dagen.filter((d) => d.regioId)
  const benut = opRegiodag.filter((d) => d.bezoeken > 0)
  const bezoekenOpRegiodag = opRegiodag.reduce((s, d) => s + d.bezoeken, 0)
  return {
    dagen,
    samenvatting: {
      regiodagen: opRegiodag.length, benut: benut.length, leeg: opRegiodag.length - benut.length,
      bezoekenOpRegiodag, gemiddeld: benut.length ? Math.round((bezoekenOpRegiodag / benut.length) * 10) / 10 : 0,
      inRegio: procent(opRegiodag.reduce((s, d) => s + d.inRegio, 0), bezoekenOpRegiodag),
      bezoekdagen: dagen.filter((d) => d.bezoeken > 0).length, km: dagen.reduce((s, d) => s + d.km, 0), rijMin: dagen.reduce((s, d) => s + d.rijMin, 0),
    },
  }
}
