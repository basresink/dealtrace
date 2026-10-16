// Analyse (P21, F20): per tabblad een tabel met kolommen en rijen, gefilterd op de teams van de kijker.
// Elke rij noemt zijn aantallen; onder het minimum staat "Te weinig om te vergelijken". De CSV bevat
// precies dezelfde rijen.
import { sql } from 'drizzle-orm'
import { BRON_SOORT } from '../../shared/reis'
import { genoegOmTeVergelijken, isGesproken, type Periode } from '../../shared/team'
import { gebruikDb } from './db'
import { laadFunnel } from './funnel'
import { ledenVan, zichtbareTeams, type Kijker } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)

export const TABBLADEN = ['funnel', 'activiteit', 'campagnes', 'scripts', 'regels', 'reizen', 'bronnen', 'prospectmix'] as const
export type Tabblad = typeof TABBLADEN[number]
export const TABBLAD_LABEL: Record<Tabblad, string> = { funnel: 'Funnel', activiteit: 'Activiteit', campagnes: 'Campagnes', scripts: 'Scripts', regels: 'Regels en agents', reizen: 'Reizen', bronnen: 'Bronnen', prospectmix: 'Prospectmix' }
export interface Kolom { sleutel: string; label: string; getal?: boolean }
export interface Tabel { titel: string; kolommen: Kolom[]; rijen: Rij[] }
export interface AnalyseUit { tabblad: Tabblad; tabellen: Tabel[]; melding?: string | null; voorstellen?: Rij[] }
export interface AnalyseFilters { periode: Periode; teamId?: string | null; gebruikerId?: string | null }

/** De gebruikers binnen bereik: de leden van de zichtbare teams, eventueel één team of één persoon. */
export async function bereik(tx: Tx, g: Kijker, f: AnalyseFilters) {
  const teams = await zichtbareTeams(tx, g)
  const teamIds = f.teamId ? teams.filter((t) => t.id === f.teamId).map((t) => t.id) : teams.map((t) => t.id)
  if (f.teamId && !teamIds.length) throw Object.assign(new Error('Dit team valt niet onder jou'), { statusCode: 403, statusMessage: 'Dit team valt niet onder jou' })
  const leden = await ledenVan(tx, teamIds)
  const ids = f.gebruikerId ? leden.filter((l) => l.id === f.gebruikerId).map((l) => l.id as string) : leden.map((l) => l.id as string)
  if (f.gebruikerId && !ids.length) throw Object.assign(new Error('Deze persoon valt niet onder jou'), { statusCode: 403, statusMessage: 'Deze persoon valt niet onder jou' })
  return { teams, leden, ids }
}

const K = (sleutel: string, label: string, getal = true): Kolom => ({ sleutel, label, getal })
export async function analyse(tx: Tx, g: Kijker, tab: Tabblad, f: AnalyseFilters): Promise<AnalyseUit> {
  const { leden, ids } = await bereik(tx, g, f)
  const l = ids.join(',') || '-'
  const van = f.periode.van
  const tot = `${f.periode.tot}T23:59:59Z`
  const naam = (id: string) => String(leden.find((x) => x.id === id)?.naam ?? id).replace(/^Testgebruiker /, '')
  if (tab === 'funnel') {
    const fu = await laadFunnel(tx, { van: f.periode.van, tot: f.periode.tot, gebruikerIds: ids.length ? ids : ['-'] }, { details: true })
    const verloren = await rijen(tx, sql`select coalesce(c.naam, a.data->'nee'->>'verlorenAan') as concurrent, coalesce(b.naam, '-') as branche, count(*)::int as n from accounts a
      left join vv_concurrenten c on c.extern_id = a.data->'nee'->>'verlorenAan' left join vv_branches b on b.extern_id = a.vv_branche_id
      where a.owner_id = any(string_to_array(${l}, ',')) and a.data->'nee'->>'verlorenAan' is not null group by 1, 2 order by 3 desc`)
    return { tabblad: tab, tabellen: [
      { titel: 'Funnel van de prospectreis', kolommen: [K('label', 'Fase', false), K('aantal', 'Accounts'), K('doorgestroomd', 'Door'), K('uitgevallen', 'Uitgevallen'), K('conversie', 'Conversie (procent)'), K('doorlooptijd', 'Doorlooptijd (dagen)')],
        rijen: fu.fases.map((x: any) => ({ label: x.label, aantal: x.aantal, doorgestroomd: x.doorgestroomd, uitgevallen: x.uitgevallen, conversie: x.conversie ?? '', doorlooptijd: x.doorlooptijd ?? '' })) },
      { titel: 'Verloren aan', kolommen: [K('concurrent', 'Concurrent', false), K('branche', 'Branche', false), K('n', 'Accounts')], rijen: verloren },
    ], melding: fu.kop?.titel ?? null }
  }
  if (tab === 'activiteit') {
    const acts = await rijen(tx, sql`select door, soort, kanaal, uitkomst, account_id, op from activiteiten where door = any(string_to_array(${l}, ',')) and op >= ${van} and op <= ${tot} and soort in ('gebeld', 'mail', 'bericht', 'bezoek', 'linkedin', 'whatsapp', 'kaart') order by op`)
    const per = new Map<string, Rij>()
    for (const a of acts) {
      const k = `${a.door}|${a.soort}`
      const r = per.get(k) ?? { persoon: naam(a.door), kanaal: a.soort, pogingen: 0, gesprekken: 0, afspraken: 0 }
      r.pogingen++; if (isGesproken({ soort: a.soort, uitkomst: a.uitkomst })) r.gesprekken++; if (a.uitkomst === 'afspraak') r.afspraken++
      per.set(k, r)
    }
    // Bij welke poging ontstaat de afspraak: tel per account de pogingen tot en met de afspraak.
    const telling = new Map<string, number>()
    const bij = new Map<number, number>()
    for (const a of acts) { const n = (telling.get(a.account_id) ?? 0) + 1; telling.set(a.account_id, n); if (a.uitkomst === 'afspraak') { bij.set(Math.min(n, 6), (bij.get(Math.min(n, 6)) ?? 0) + 1); telling.set(a.account_id, 0) } }
    return { tabblad: tab, tabellen: [
      { titel: 'Per persoon en kanaal', kolommen: [K('persoon', 'Persoon', false), K('kanaal', 'Kanaal', false), K('pogingen', 'Pogingen'), K('gesprekken', 'Gesprekken'), K('afspraken', 'Afspraken'), K('conversie', 'Gesprek naar afspraak (procent)')],
        rijen: [...per.values()].map((r): Rij => ({ ...r, conversie: pct(r.afspraken, r.gesprekken) ?? '' })).sort((a, b) => a.persoon.localeCompare(b.persoon) || a.kanaal.localeCompare(b.kanaal)) },
      { titel: 'Afspraken per poging', kolommen: [K('poging', 'Poging', false), K('afspraken', 'Afspraken')], rijen: [1, 2, 3, 4, 5, 6].map((p) => ({ poging: p === 6 ? '6 of later' : String(p), afspraken: bij.get(p) ?? 0 })) },
    ] }
  }
  if (tab === 'campagnes') {
    const c = await rijen(tx, sql`select c.id, c.naam, c.soort, count(ci.*)::int as accounts, count(*) filter (where ci.kolom <> 'te-benaderen')::int as bereikt, count(*) filter (where ci.kolom = 'afspraak')::int as afspraken
      from campagnes c left join campagne_items ci on ci.campagne_id = c.id where c.status <> 'concept' and (c.eigenaar_id = any(string_to_array(${l}, ',')) or ci.account_id in (select id from accounts where owner_id = any(string_to_array(${l}, ','))))
      group by 1, 2, 3 order by 3, 2`)
    return { tabblad: tab, tabellen: [{ titel: 'Per campagne', kolommen: [K('naam', 'Campagne', false), K('soort', 'Soort', false), K('accounts', 'Accounts'), K('bereikt', 'Bereikt'), K('afspraken', 'Afspraken'), K('conversie', 'Conversie (procent)')], rijen: c.map((r) => ({ naam: r.naam, soort: r.soort, accounts: r.accounts, bereikt: r.bereikt, afspraken: r.afspraken, conversie: pct(r.afspraken, r.accounts) ?? '' })) }] }
  }
  if (tab === 'scripts') {
    const s = await rijen(tx, sql`select coalesce(b.naam, s.data->>'scriptId', 'Zonder script') as script, coalesce((s.data->>'scriptVersie')::int, b.versie) as versie, s.data->'gesprekken' as gesprekken
      from belblok_sessies s left join belscripts b on b.id = s.data->>'scriptId' where s.gebruiker_id = any(string_to_array(${l}, ',')) and s.start_op >= ${van} and s.start_op <= ${tot}`)
    const per = new Map<string, Rij>()
    for (const r of s) {
      const k = `${r.script}|${r.versie ?? ''}`
      const x = per.get(k) ?? { script: r.script, versie: r.versie ?? '', gesprekken: 0, afspraken: 0 }
      for (const gsp of (r.gesprekken ?? []) as any[]) { x.gesprekken++; if (gsp?.uitkomst === 'afspraak') x.afspraken++ }
      per.set(k, x)
    }
    return { tabblad: tab, tabellen: [{ titel: 'Per script en versie', kolommen: [K('script', 'Script', false), K('versie', 'Versie', false), K('gesprekken', 'Gesprekken'), K('afspraken', 'Afspraken'), K('conversie', 'Conversie (procent)', false)],
      rijen: [...per.values()].map((x) => ({ ...x, conversie: genoegOmTeVergelijken(x.gesprekken, 'script').genoeg ? String(pct(x.afspraken, x.gesprekken)) : 'Te weinig om te vergelijken' })) }] }
  }
  if (tab === 'regels') {
    const r = await rijen(tx, sql`select coalesce(r.naam, t.rule_id) as regel, count(*)::int as taken, count(*) filter (where t.status = 'klaar')::int as afgerond, count(*) filter (where t.uitkomst = 'afspraak')::int as afspraken
      from tasks t left join activity_rules r on r.id = t.rule_id where t.rule_id is not null and t.owner_id = any(string_to_array(${l}, ',')) and t.created_at >= ${van} and t.created_at <= ${tot} group by 1 order by 2 desc`)
    const s = await rijen(tx, sql`select coalesce(r.naam, s.rule_id) as regel, count(*)::int as inzichten, count(*) filter (where s.status = 'omgezet')::int as omgezet, count(*) filter (where s.status = 'afgewezen')::int as afgewezen
      from signals s left join activity_rules r on r.id = s.rule_id where s.rule_id is not null and s.owner_id = any(string_to_array(${l}, ',')) and s.created_at >= ${van} and s.created_at <= ${tot} group by 1 order by 2 desc`)
    const a = await rijen(tx, sql`select agent, count(*) filter (where uitkomst = 'uitgevoerd')::int as uitgevoerd, count(*) filter (where uitkomst = 'geblokkeerd')::int as geblokkeerd, coalesce(sum((kosten->>'credits')::int), 0)::int as credits
      from agent_runs where op >= ${van} and op <= ${tot} and (gebruiker_id is null or gebruiker_id = any(string_to_array(${l}, ','))) group by 1 order by 1`)
    const ov = await rijen(tx, sql`select agent, count(*) filter (where overname = 'ongewijzigd')::int as ongewijzigd, count(*) filter (where overname is not null)::int as beoordeeld from concepten where gebruiker_id = any(string_to_array(${l}, ',')) and op >= ${van} group by 1`)
    return { tabblad: tab, tabellen: [
      { titel: 'Regels: taken', kolommen: [K('regel', 'Regel', false), K('taken', 'Taken'), K('afgerond', 'Afgerond'), K('afspraken', 'Afspraken')], rijen: r },
      { titel: 'Regels: inzichten en acceptatie', kolommen: [K('regel', 'Regel', false), K('inzichten', 'Inzichten'), K('omgezet', 'Omgezet'), K('afgewezen', 'Afgewezen'), K('acceptatie', 'Acceptatie (procent)')], rijen: s.map((x) => ({ ...x, acceptatie: pct(x.omgezet, x.omgezet + x.afgewezen) ?? '' })) },
      { titel: 'Agents', kolommen: [K('agent', 'Agent', false), K('uitgevoerd', 'Uitgevoerd'), K('geblokkeerd', 'Tegengehouden'), K('credits', 'Credits'), K('overname', 'Concept ongewijzigd (procent)')], rijen: a.map((x) => { const o = ov.find((y) => y.agent === x.agent); return { ...x, overname: o ? pct(o.ongewijzigd, o.beoordeeld) ?? '' : '' } }) },
    ] }
  }
  if (tab === 'reizen') {
    const r = await rijen(tx, sql`select r.id, r.naam, r.versie, count(a.id)::int as accounts, count(a.id) filter (where a.fase_id in ('afspraak-gepland', 'afspraak-gehouden', 'overgedragen'))::int as afspraak, count(a.id) filter (where a.nb_status = 'overgedragen')::int as overgedragen
      from reistemplates r left join accounts a on a.reis_id = r.id and a.owner_id = any(string_to_array(${l}, ',')) where r.status <> 'gearchiveerd' group by 1, 2, 3 order by 2`)
    const voorstellen = await rijen(tx, sql`select id, title, status, data, created_at from signals where type = 'verbetervoorstel' and owner_id = ${g.id} and status in ('nieuw', 'gelezen', 'later') order by created_at desc`)
    return { tabblad: tab, tabellen: [{ titel: 'Per reisversie', kolommen: [K('naam', 'Reis', false), K('versie', 'Versie', false), K('accounts', 'Accounts'), K('afspraak', 'Tot afspraak'), K('overgedragen', 'Overgedragen'), K('conversie', 'Conversie naar afspraak (procent)', false)],
      rijen: r.map((x) => ({ naam: x.naam, versie: x.versie, accounts: x.accounts, afspraak: x.afspraak, overgedragen: x.overgedragen, conversie: genoegOmTeVergelijken(x.accounts, 'reisversie').genoeg ? String(pct(x.afspraak, x.accounts)) : 'Te weinig om te vergelijken' })) }],
      voorstellen: voorstellen.map((v) => ({ id: v.id, titel: v.title, status: v.status, voorstel: v.data?.voorstel, onderbouwing: v.data?.onderbouwing, reisId: v.data?.reisId })) }
  }
  if (tab === 'bronnen') {
    const b = await rijen(tx, sql`select l.bron, count(*)::int as leads, count(*) filter (where l.status = 'overgenomen')::int as overgenomen,
      count(*) filter (where a.fase_id in ('afspraak-gepland', 'afspraak-gehouden', 'overgedragen'))::int as afspraken, count(*) filter (where a.nb_status = 'overgedragen')::int as overgedragen
      from leads l left join accounts a on a.id = l.account_id where l.gevonden_op >= ${van} and l.gevonden_op <= ${tot} and (l.gevonden_door is null or l.gevonden_door = any(string_to_array(${l}, ','))) group by 1 order by 1`)
    const kosten = await rijen(tx, sql`select coalesce(sum((kosten->>'credits')::int), 0)::int as credits from lead_rondes where gestart_op >= ${van} and gestart_op <= ${tot}`)
    return { tabblad: tab, tabellen: [{ titel: 'Per leadbron', kolommen: [K('bron', 'Bron', false), K('leads', 'Leads'), K('overgenomen', 'Overgenomen'), K('afspraken', 'Eerste afspraken'), K('overgedragen', 'Overgedragen')], rijen: b }], melding: kosten[0]?.credits ? `${kosten[0].credits} credits aan zoekrondes in deze periode.` : null }
  }
  // Prospectmix: afgesproken verdeling tegen werkelijk, per persoon (nieuwe gesprekken per soort bron).
  const [doel] = await rijen(tx, sql`select value from org_settings where key = 'prospectmix'`)
  const mix = (doel?.value as Record<string, number>) ?? { koud: 50, warm: 25, referral: 15, winback: 10 }
  const acts = await rijen(tx, sql`select ac.door, a.nb_bron, count(distinct a.id)::int as n from activiteiten ac join accounts a on a.id = ac.account_id
    where ac.door = any(string_to_array(${l}, ',')) and ac.op >= ${van} and ac.op <= ${tot} and ac.soort in ('gebeld', 'mail', 'bericht', 'bezoek', 'linkedin', 'whatsapp', 'kaart') group by 1, 2`)
  const rijenMix = ids.map((id) => {
    const eigen = acts.filter((a) => a.door === id)
    const totaal = eigen.reduce((s, a) => s + a.n, 0)
    const soort = (k: string) => eigen.filter((a) => (BRON_SOORT[a.nb_bron] ?? 'koud') === k).reduce((s, a) => s + a.n, 0)
    const r: Rij = { persoon: naam(id), accounts: totaal }
    for (const k of ['koud', 'warm', 'referral', 'winback']) r[k] = totaal ? `${pct(soort(k), totaal)} (doel ${mix[k] ?? 0})` : '-'
    r.voorstel = totaal && (pct(soort('warm'), totaal) ?? 0) < (mix.warm ?? 0) - 10 ? 'Start een campagne Referral of Signaal' : ''
    return r
  })
  return { tabblad: 'prospectmix', tabellen: [{ titel: 'Afgesproken tegen werkelijk (procent)', kolommen: [K('persoon', 'Persoon', false), K('accounts', 'Accounts benaderd'), K('koud', 'Koud', false), K('warm', 'Warm', false), K('referral', 'Referral', false), K('winback', 'Winback', false), K('voorstel', 'Voorstel', false)], rijen: rijenMix }] }
}
