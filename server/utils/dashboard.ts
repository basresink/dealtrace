// Mijn dashboard (opzet van DealDrive /rapportage): alles over één periode voor de ingelogde gebruiker.
// Eén keer de ruwe lijsten (server/utils/team ruw) over de periode en de vergelijkingsperiode samen;
// de tellingen gebeuren in shared/team en shared/dashboard. Het teamgemiddelde is zonder namen en alleen
// met resultaten.trend; dekking alleen met funnel.filters; de funnel alleen met funnel.eigen.
import { sql } from 'drizzle-orm'
import { activiteitReeks, dashboardPeriode, dashboardTitel, DEKKING_BAKKEN, dekkingBak, delta, KANAAL_LABEL, kanaalVan, prospectDekking, doelStand, normRegels, uitkomstGroep, uitkomsten } from '../../shared/dashboard'
import { FUNNEL_FASES, FUNNEL_LABEL, type FunnelFase } from '../../shared/funnel'
import { isProspectStatus, PROSPECT_STATUS_LABEL, prospectStatusUit, telPerStatus } from '../../shared/prospectStatus'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { isContact, kpi, teamGemiddelde, tempo, type Periode } from '../../shared/team'
import { gebruikDb } from './db'
import { faseLabels, funnelAccounts, laadFunnel } from './funnel'
import { ledenVan, ruw } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const dagVan = (iso: string) => nlMoment(new Date(iso)).datum
const binnen = (iso: string, p: Periode) => { const d = dagVan(iso); return d >= p.van && d <= p.tot }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : 0)

export interface DashboardOpties { vergelijken: boolean; dekking: boolean; funnel: boolean; funnelDetails: boolean }

export async function mijnDashboard(tx: Tx, gebruikerId: string, q: Record<string, unknown>, opties: DashboardOpties, nu = new Date()) {
  const vandaag = nlMoment(nu).datum
  const periode = dashboardPeriode(q, vandaag)
  const [u] = await rijen(tx, sql`select id, name, werkplek, team_id from users where id = ${gebruikerId}`)
  const leden = opties.vergelijken && u?.team_id ? await ledenVan(tx, [u.team_id]) : []
  const ids = [...new Set([gebruikerId, ...leden.map((l) => l.id as string)])]
  const r = await ruw(tx, ids, { van: periode.vorige.van < periode.van ? periode.vorige.van : periode.van, tot: periode.tot }, nu)
  const p: Periode = { van: periode.van, tot: periode.tot }
  const k = kpi(gebruikerId, p, r.activiteiten)
  const kVorig = kpi(gebruikerId, periode.vorige, r.activiteiten)
  const eigen = <T extends { owner?: string; door?: string; gebruiker?: string }>(x: T) => (x.owner ?? x.door ?? x.gebruiker) === gebruikerId
  const gehouden = r.afsprakenGehouden.filter((a) => eigen(a) && binnen(a.start, p)).length
  const gehoudenVorig = r.afsprakenGehouden.filter((a) => eigen(a) && binnen(a.start, periode.vorige)).length
  const overgedragen = r.overgedragen.filter((o) => eigen(o) && binnen(o.op, p)).length
  const overgedragenVorig = r.overgedragen.filter((o) => eigen(o) && binnen(o.op, periode.vorige)).length
  const blokken = r.belblokken.filter((b) => eigen(b) && binnen(b.start, p))

  const van = nlTijdstip(periode.van, 0).toISOString()
  const tot = nlTijdstip(plusDagen(periode.tot, 1), 0).toISOString()
  const vorigVan = nlTijdstip(periode.vorige.van, 0).toISOString()
  const vorigTot = nlTijdstip(plusDagen(periode.vorige.tot, 1), 0).toISOString()
  const vandaagStart = nlTijdstip(vandaag, 0).toISOString()
  const [n] = await rijen(tx, sql`select
      (select count(*) from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect')::int as prospects,
      (select count(*) from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect' and nb_status = 'in reis')::int as in_reis,
      (select count(*) from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect' and nb_status in ('nieuw', 'gescoord'))::int as nieuw,
      (select count(*) from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect' and nb_status in ('wachtend', 'nee'))::int as wacht,
      (select count(*) from signals where owner_id = ${gebruikerId} and created_at >= ${van} and created_at < ${tot})::int as inzichten,
      (select count(*) from signals where owner_id = ${gebruikerId} and created_at >= ${van} and created_at < ${tot} and status = 'nieuw')::int as inzichten_open,
      (select count(*) from signals where owner_id = ${gebruikerId} and created_at >= ${vorigVan} and created_at < ${vorigTot})::int as inzichten_vorig,
      (select count(*) from tasks where owner_id = ${gebruikerId} and status = 'klaar' and updated_at >= ${van} and updated_at < ${tot})::int as taken_klaar,
      (select count(*) from tasks where owner_id = ${gebruikerId} and status = 'klaar' and updated_at >= ${vorigVan} and updated_at < ${vorigTot})::int as taken_klaar_vorig,
      (select count(*) from tasks where owner_id = ${gebruikerId} and status in ('open', 'bezig'))::int as taken_open,
      (select count(*) from tasks where owner_id = ${gebruikerId} and status in ('open', 'bezig') and due_date < ${vandaagStart})::int as taken_verlopen,
      (select count(*) from tasks where owner_id = ${gebruikerId} and status <> 'geannuleerd' and due_date >= ${van} and due_date < ${tot})::int as op_dag,
      (select count(*) from tasks where owner_id = ${gebruikerId} and status = 'klaar' and due_date >= ${van} and due_date < ${tot}
        and (updated_at at time zone 'Europe/Amsterdam')::date = (due_date at time zone 'Europe/Amsterdam')::date)::int as op_dag_klaar`)
  const s = n as Record<string, number>
  const anders = Math.max(0, s.prospects! - s.in_reis! - s.nieuw! - s.wacht!)
  const actief = opties.dekking ? (await rijen(tx, sql`select laatste_contact_op from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect' and nb_status in ('nieuw', 'in reis', 'gescoord') and gedeactiveerd_op is null`)).map((x) => (x.laatste_contact_op ? new Date(x.laatste_contact_op).toISOString() : null)) : null

  const doel = doelStand(k.pogingen, periode, u?.werkplek, vandaag)
  const w = periode.vorigeLabel
  const team = opties.vergelijken && leden.length ? teamGemiddelde(leden.map((l) => ({ kpi: kpi(l.id, p, r.activiteiten) }))) : null

  // Per week binnen de periode (vanaf Gevorderd): jouw cijfers per week van maandag tot zondag.
  let weken = null
  if (opties.vergelijken) {
    weken = []
    for (let d = plusDagen(periode.van, -((new Date(`${periode.van}T12:00:00Z`).getUTCDay() + 6) % 7)); d <= periode.tot; d = plusDagen(d, 7)) {
      const wk = { van: d < periode.van ? periode.van : d, tot: plusDagen(d, 6) > periode.tot ? periode.tot : plusDagen(d, 6) }
      const x = kpi(gebruikerId, wk, r.activiteiten)
      weken.push({ van: wk.van, tot: wk.tot, pogingen: x.pogingen, gesprekken: x.gesprekken, beslisser: x.beslisser, afspraken: x.afspraken, accounts: x.accounts, conversie: x.gesprekNaarAfspraak })
    }
  }

  let funnel = null
  if (opties.funnel) {
    const fn = await laadFunnel(tx, { van: van, tot: new Date(Date.parse(tot) - 1).toISOString(), gebruikerIds: [gebruikerId] }, { details: opties.funnelDetails })
    funnel = { kop: fn.kop, aantalAccounts: fn.aantalAccounts, pogingen: fn.pogingen, eersteAfspraak: fn.eersteAfspraak, fases: fn.fases.map((x: any) => ({ faseId: x.faseId, label: x.label, hoofdfase: x.hoofdfase, aantal: x.aantal, conversie: x.conversie ?? null, norm: x.norm?.conversie ?? null, stok: x.stok })) }
  }

  // Status prospect (koud tot heet) van je eigen, niet gedeactiveerde prospects.
  const statussen = (await rijen(tx, sql`select data->>'prospectStatus' as s from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect' and gedeactiveerd_op is null`)).map((x) => x.s as string | null)

  return {
    periode,
    ...dashboardTitel({ pogingen: k.pogingen, gesprekken: k.gesprekken, afspraken: k.afspraken, doel, conversie: k.gesprekNaarAfspraak, verlopen: s.taken_verlopen!, label: periode.label }),
    kpi: k,
    tempo: tempo(k, u?.werkplek),
    doel,
    tegels: {
      pogingen: { aantal: k.pogingen, delta: delta(k.pogingen, kVorig.pogingen, w), team: team?.pogingen ?? null, perDag: k.pogingenPerDag.waarde },
      gesprekken: { aantal: k.gesprekken, delta: delta(k.gesprekken, kVorig.gesprekken, w), team: team?.gesprekken ?? null },
      afspraken: { aantal: k.afspraken, delta: delta(k.afspraken, kVorig.afspraken, w), team: team?.afspraken ?? null },
      bereik: { accounts: k.accounts, delta: delta(k.accounts, kVorig.accounts, w), pogingenPerAccount: k.accounts ? Math.round((k.pogingen / k.accounts) * 10) / 10 : 0 },
      conversie: { procent: Math.round(k.gesprekNaarAfspraak.waarde * 100), noemer: k.gesprekNaarAfspraak.noemer ?? 0, team: team ? Math.round(team.gesprekNaarAfspraak * 100) : null },
      beslisser: { procent: Math.round(k.beslisserBereikt.waarde * 100), noemer: k.beslisserBereikt.noemer ?? 0, team: team ? Math.round(team.beslisserBereikt * 100) : null },
      gehouden: { aantal: gehouden, delta: delta(gehouden, gehoudenVorig, w) },
      overdrachten: { aantal: overgedragen, delta: delta(overgedragen, overgedragenVorig, w) },
      belblokken: { gehouden: blokken.filter((b) => b.status === 'klaar').length, gepland: blokken.length },
      inzichten: { aantal: s.inzichten!, open: s.inzichten_open!, delta: delta(s.inzichten!, s.inzichten_vorig!, w) },
      taken: { klaar: s.taken_klaar!, open: s.taken_open!, verlopen: s.taken_verlopen!, delta: delta(s.taken_klaar!, s.taken_klaar_vorig!, w) },
      takenOpDag: { waarde: pct(s.op_dag_klaar!, s.op_dag!), noemer: s.op_dag! },
    },
    prospects: {
      totaal: s.prospects!,
      delen: [
        { sleutel: 'inReis', label: 'in reis', aantal: s.in_reis! },
        { sleutel: 'nieuw', label: 'nieuw of gescoord', aantal: s.nieuw! },
        { sleutel: 'wacht', label: 'wachtend of nee', aantal: s.wacht! },
        ...(anders ? [{ sleutel: 'over', label: 'overgedragen', aantal: anders }] : []),
      ],
      dekking: actief ? prospectDekking(actief, nu) : null,
    },
    normen: normRegels(k, { gepland: k.afspraken, gehouden }),
    activiteit: activiteitReeks(r.activiteiten, p, gebruikerId),
    uitkomsten: uitkomsten(r.activiteiten, p, gebruikerId),
    funnel,
    weken,
    team,
    statusProspects: telPerStatus(statussen),
  }
}

// ── De lijst achter een cel, balk of getal (de vensters op Mijn dashboard) ──────────────────────────

export const DASHBOARD_BLOKKEN = ['reis', 'uitkomst', 'dekking', 'status'] as const
export type DashboardBlok = typeof DASHBOARD_BLOKKEN[number]
export interface LijstItem { id: string; accountId: string | null; naam: string; fase: string | null; meta: string[]; prospectStatus: string | null; dagen: number | null; taak: { id: string; titel: string } | null; op: string | null }
/** De drie snelle cijfers naast de dekkingsblokken: recent (< 30 dagen), koud (30 dagen of langer, of nooit) en zonder contact. */
const DEKKING_STATS: Record<string, { titel: string; past: (l: string | null, nu: Date) => boolean }> = {
  recent: { titel: 'Contact korter dan 30 dagen geleden', past: (l, nu) => !!l && (nu.getTime() - Date.parse(l)) / 864e5 < 30 },
  koud: { titel: 'Langer dan 30 dagen geen contact', past: (l, nu) => !l || (nu.getTime() - Date.parse(l)) / 864e5 >= 30 },
  zonder: { titel: 'Nog geen contactmoment', past: (l) => !l },
}
const dagKort = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
const dagenSinds = (iso: string | null, nu: Date) => (iso ? Math.max(0, Math.floor((nu.getTime() - Date.parse(iso)) / 864e5)) : null)

/**
 * De prospects of pogingen achter een onderdeel van Mijn dashboard, met dezelfde periode en dezelfde telling
 * als het blok: reis (funnelfase, via funnelAccounts), uitkomst (je contactpogingen met die uitkomst, met de
 * taak erachter), dekking (actieve prospects in die bak) en status (prospects met die status; "geen" is
 * zonder status). Alleen je eigen prospects en pogingen.
 */
export async function dashboardLijst(tx: Tx, gebruikerId: string, q: Record<string, unknown>, opties: DashboardOpties, nu = new Date()): Promise<{ titel: string; kicker: string; meta: string; items: LijstItem[] }> {
  const blok = String(q.blok ?? '') as DashboardBlok
  const sleutel = String(q.sleutel ?? '')
  const periode = dashboardPeriode(q, nlMoment(nu).datum)
  const van = nlTijdstip(periode.van, 0).toISOString()
  const tot = nlTijdstip(plusDagen(periode.tot, 1), 0).toISOString()
  const labels = await faseLabels(tx)
  const faseVan = (id: string | null) => (id ? labels.get(id) ?? FUNNEL_LABEL[id as FunnelFase] ?? null : null)
  const fout = (statusCode: number, statusMessage: string) => Object.assign(new Error(statusMessage), { statusCode, statusMessage })

  if (blok === 'reis') {
    if (!opties.funnel) throw fout(403, 'Je eigen funnel staat niet aan')
    if (!FUNNEL_FASES.includes(sleutel as FunnelFase)) throw fout(400, 'Onbekende fase')
    const rows = await funnelAccounts(tx, { van, tot: new Date(Date.parse(tot) - 1).toISOString(), gebruikerIds: [gebruikerId] }, sleutel as FunnelFase, null, nu)
    return {
      kicker: `Je reis per fase · ${periode.label}`, titel: FUNNEL_LABEL[sleutel as FunnelFase], meta: `${rows.length} ${rows.length === 1 ? 'prospect kwam' : 'prospects kwamen'} in deze fase`,
      items: rows.map((r) => ({ id: r.id, accountId: r.id, naam: r.naam, fase: r.fase, prospectStatus: r.prospectStatus, dagen: r.dagenInFase, op: r.faseSinds, taak: null,
        meta: [r.dagenInFase != null ? `${r.dagenInFase} ${r.dagenInFase === 1 ? 'dag' : 'dagen'} ${r.nogInFase ? 'nu in fase' : 'in fase'}` : null, r.volgendeStap ? `Volgende stap: ${r.volgendeStap}` : null, r.reden].filter(Boolean) as string[] })),
    }
  }

  if (blok === 'uitkomst') {
    const acts = await rijen(tx, sql`select a.id, a.op, a.soort, a.kanaal, a.uitkomst, a.account_id, acc.name as account, acc.fase_id, acc.data->>'prospectStatus' as prospect_status, a.task_id, t.title as taak,
        trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) as contact, coalesce(a.kanaal = 'intern', false) as intern
      from activiteiten a left join accounts acc on acc.id = a.account_id left join tasks t on t.id = a.task_id left join contacts c on c.id = a.contact_id
      where a.door = ${gebruikerId} and a.op >= ${van} and a.op < ${tot} order by a.op desc`)
    const binnen = acts.filter((a) => isContact({ soort: a.soort, intern: !!a.intern }) && uitkomstGroep(a.uitkomst).sleutel === sleutel)
    const label = uitkomstGroep(binnen[0]?.uitkomst ?? (sleutel === 'overig' ? null : sleutel)).label
    return {
      kicker: `Waar je pogingen op uitliepen · ${periode.label}`, titel: binnen.length ? label : 'Uitkomst', meta: `${binnen.length} ${binnen.length === 1 ? 'poging' : 'pogingen'} bij ${new Set(binnen.map((a) => a.account_id).filter(Boolean)).size} prospects`,
      items: binnen.map((a) => {
        const op = a.op instanceof Date ? a.op.toISOString() : new Date(String(a.op)).toISOString()
        return { id: a.id, accountId: a.account_id ?? null, naam: a.account ?? 'Zonder prospect', fase: faseVan(a.fase_id), prospectStatus: isProspectStatus(a.prospect_status) ? a.prospect_status : null, dagen: null, op,
          taak: a.task_id ? { id: a.task_id, titel: a.taak ?? 'Taak' } : null,
          meta: [dagKort(op), KANAAL_LABEL[kanaalVan({ soort: a.soort, kanaal: a.kanaal })], a.contact || null].filter(Boolean) as string[] }
      }),
    }
  }

  if (blok === 'dekking' || blok === 'status') {
    if (blok === 'dekking' && !opties.dekking) throw fout(403, 'Prospectdekking staat niet aan')
    if (blok === 'dekking' && !DEKKING_BAKKEN.some((b) => b.sleutel === sleutel) && !DEKKING_STATS[sleutel]) throw fout(400, 'Onbekende bak')
    if (blok === 'status' && sleutel !== 'geen' && !isProspectStatus(sleutel)) throw fout(400, 'Onbekende status')
    const rows = await rijen(tx, sql`select a.id, a.name, a.fase_id, a.laatste_contact_op, a.data, a.nb_status,
        (select t.id from tasks t where t.account_id = a.id and t.owner_id = ${gebruikerId} and t.status in ('open', 'bezig') order by t.due_date nulls last limit 1) as taak_id,
        (select t.title from tasks t where t.account_id = a.id and t.owner_id = ${gebruikerId} and t.status in ('open', 'bezig') order by t.due_date nulls last limit 1) as taak
      from accounts a where a.owner_id = ${gebruikerId} and a.account_kind = 'prospect' and a.gedeactiveerd_op is null
      ${blok === 'dekking' ? sql`and a.nb_status in ('nieuw', 'in reis', 'gescoord')` : sql``} order by a.laatste_contact_op nulls first, a.name`)
    const laatste = (r: Rij) => (r.laatste_contact_op ? new Date(r.laatste_contact_op).toISOString() : null)
    const keuze = blok === 'dekking'
      ? rows.filter((r) => (DEKKING_STATS[sleutel] ? DEKKING_STATS[sleutel]!.past(laatste(r), nu) : dekkingBak(laatste(r), nu).sleutel === sleutel))
      : rows.filter((r) => (prospectStatusUit(r.data) ?? 'geen') === sleutel)
    const bak = DEKKING_BAKKEN.find((b) => b.sleutel === sleutel)
    return {
      kicker: blok === 'dekking' ? 'Prospectdekking · momentopname' : 'Status prospect · momentopname',
      titel: blok === 'dekking' ? (bak ? `Laatste contact ${bak.label}` : DEKKING_STATS[sleutel]!.titel) : sleutel === 'geen' ? 'Nog geen status' : PROSPECT_STATUS_LABEL[sleutel as keyof typeof PROSPECT_STATUS_LABEL],
      meta: `${keuze.length} ${keuze.length === 1 ? 'prospect' : 'prospects'}`,
      items: keuze.map((r) => {
        const l = laatste(r); const d = dagenSinds(l, nu)
        return { id: r.id, accountId: r.id, naam: r.name, fase: faseVan(r.fase_id), prospectStatus: prospectStatusUit(r.data), dagen: d, op: l, taak: r.taak_id ? { id: r.taak_id, titel: r.taak } : null,
          meta: [l ? `Laatste contact ${dagKort(l)} (${d} ${d === 1 ? 'dag' : 'dagen'} geleden)` : 'Nog geen contactmoment'].filter(Boolean) as string[] }
      }),
    }
  }
  throw fout(400, 'Onbekend blok')
}
