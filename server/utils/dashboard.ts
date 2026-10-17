// Mijn dashboard (opzet van DealDrive /rapportage): alles over één periode voor de ingelogde gebruiker.
// Eén keer de ruwe lijsten (server/utils/team ruw) over de periode en de vergelijkingsperiode samen;
// de tellingen gebeuren in shared/team en shared/dashboard. Het teamgemiddelde is zonder namen en alleen
// met resultaten.trend; dekking alleen met funnel.filters; de funnel alleen met funnel.eigen.
import { sql } from 'drizzle-orm'
import { activiteitReeks, dashboardPeriode, dashboardTitel, delta, prospectDekking, doelStand, normRegels, uitkomsten } from '../../shared/dashboard'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { kpi, teamGemiddelde, tempo, type Periode } from '../../shared/team'
import { notitieUit } from './coaching'
import { gebruikDb } from './db'
import { laadFunnel } from './funnel'
import { ledenVan, ruw } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const datum = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))
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
  const actief = opties.dekking ? (await rijen(tx, sql`select laatste_contact_op from accounts where owner_id = ${gebruikerId} and account_kind = 'prospect' and nb_status in ('nieuw', 'in reis', 'gescoord')`)).map((x) => (x.laatste_contact_op ? new Date(x.laatste_contact_op).toISOString() : null)) : null

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

  const afspraken = (await rijen(tx, sql`select * from coaching_notities where gebruiker_id = ${gebruikerId} and soort = 'afspraak' order by op desc limit 50`)).map(notitieUit)
  const punten = (await rijen(tx, sql`select datum, data from coaching_sessies where gebruiker_id = ${gebruikerId} order by datum desc limit 6`))
    .flatMap((x) => ((x.data?.punten ?? []) as any[]).filter((pt) => pt.gedeeld).map((pt) => ({ datum: datum(x.datum), tekst: pt.tekst, onderbouwing: pt.onderbouwing, artikelSleutel: pt.artikelSleutel })))

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
    afspraken,
    punten,
  }
}
