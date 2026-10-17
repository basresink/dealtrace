// De funnel van de prospectreis op de server (P17, F17). Leest alleen reisgeschiedenis en
// activiteiten; de rekenregels staan in shared/funnel.ts. nb_funnel_stand is de afgeleide stand per
// dag (de motor bouwt hem op; de schermen rekenen live voor de gekozen periode).
import { sql } from 'drizzle-orm'
import { conversie, doorlooptijd, eersteAfspraakPoging, FUNNEL_FASES, FUNNEL_HOOFDFASE, FUNNEL_LABEL, funnelStand, kopTekst, leesNormen, pogingTotAfspraak, stokpunt, uitvalPerReden, type FunnelFase } from '../../shared/funnel'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { POGING_SOORTEN } from '../../shared/planning'
import { gebruikDb } from './db'
import { teamLeden } from './planning'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const lijst = (xs: string[]) => xs.join(',')
const TAAK_POGING = ['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht', 'whatsapp']

export interface FunnelFilters { van: string; tot: string; gebruikerIds: string[] | null; reisId?: string | null; doelgroepId?: string | null; campagneId?: string | null; kanaal?: string | null }

/** De periode uit de URL: maand (standaard), kwartaal, verkoopjaar of eigen (van en tot). */
export function periodeVan(p: { periode?: string | null; van?: string | null; tot?: string | null }, nu: Date, startmaand = 1): { van: string; tot: string; label: string } {
  const vandaag = nlMoment(nu).datum
  const [j, m] = vandaag.split('-').map(Number) as [number, number]
  const eind = `${vandaag}T23:59:59.999Z`
  if (p.periode === 'kwartaal') { const q = Math.floor((m - 1) / 3) * 3 + 1; return { van: `${j}-${String(q).padStart(2, '0')}-01T00:00:00Z`, tot: eind, label: 'DIT KWARTAAL' } }
  if (p.periode === 'verkoopjaar') { const sj = m >= startmaand ? j : j - 1; return { van: `${sj}-${String(startmaand).padStart(2, '0')}-01T00:00:00Z`, tot: eind, label: 'DIT VERKOOPJAAR' } }
  if (p.periode === 'eigen' && p.van && /^\d{4}-\d{2}-\d{2}$/.test(p.van)) return { van: `${p.van}T00:00:00Z`, tot: p.tot && /^\d{4}-\d{2}-\d{2}$/.test(p.tot) ? `${p.tot}T23:59:59.999Z` : eind, label: 'EIGEN PERIODE' }
  return { van: `${j}-${String(m).padStart(2, '0')}-01T00:00:00Z`, tot: eind, label: 'DEZE MAAND' }
}

async function accountIds(tx: Tx, f: FunnelFilters): Promise<string[]> {
  return (await rijen(tx, sql`select a.id from accounts a where a.account_kind = 'prospect'
    ${f.gebruikerIds ? sql`and a.owner_id = any(string_to_array(${lijst(f.gebruikerIds)}, ','))` : sql``}
    ${f.reisId ? sql`and a.reis_id = ${f.reisId}` : sql``} ${f.doelgroepId ? sql`and a.doelgroep_id = ${f.doelgroepId}` : sql``}
    ${f.kanaal ? sql`and a.nb_bron = ${f.kanaal}` : sql``}
    ${f.campagneId ? sql`and exists (select 1 from campagne_items ci where ci.account_id = a.id and ci.campagne_id = ${f.campagneId})` : sql``}`)).map((r) => r.id)
}

async function geschiedenis(tx: Tx, ids: string[], van: string, tot: string) {
  if (!ids.length) return []
  return (await rijen(tx, sql`select account_id, naar_fase_id, gebeurtenis, op, reden from reisgeschiedenis where op >= ${van} and op <= ${tot} and account_id = any(string_to_array(${lijst(ids)}, ','))`))
    .map((r) => ({ accountId: r.account_id, naarFaseId: r.naar_fase_id, gebeurtenis: r.gebeurtenis, op: iso(r.op)!, reden: r.reden }))
}

/** De funnel: stand per fase, stokpunt, kop, uitval, pogingen tot afspraak en extra cijfers per fase. */
export async function laadFunnel(tx: Tx, f: FunnelFilters, opties: { details: boolean }) {
  const ids = await accountIds(tx, f)
  const gesch = await geschiedenis(tx, ids, f.van, f.tot)
  const stand = funnelStand(gesch, { van: f.van, tot: f.tot })
  const [n] = await rijen(tx, sql`select value from org_settings where key = 'funnelNormen'`)
  const normen = leesNormen(n?.value)
  const stok = stokpunt(stand, normen)
  const kop = kopTekst(stand, stok)
  const fase = (id: FunnelFase) => stand.find((s) => s.faseId === id)!
  // Pogingen per account (Benaderd) en pogingen tot de eerste afspraak.
  const betrokken = [...new Set(stand.flatMap((s) => s.accounts.binnen))]
  const pogingen = betrokken.length && opties.details ? (await rijen(tx, sql`select account_id, op, uitkomst from activiteiten where soort = any(string_to_array(${POGING_SOORTEN.join(',')}, ',')) and op <= ${f.tot} and op >= ${new Date(Date.parse(f.van) - 365 * 864e5).toISOString()} and account_id = any(string_to_array(${lijst(betrokken)}, ','))`)).map((r) => ({ accountId: r.account_id, op: iso(r.op)!, uitkomst: r.uitkomst })) : []
  // Afgeronde taken met een uitkomst zonder eigen activiteitregel (bijvoorbeeld van voor de koppeling) tellen
  // ook als poging, zodat "bij welke poging de eerste afspraak kwam" rekent op activiteiten en taken samen.
  const taakPogingen = betrokken.length && opties.details ? (await rijen(tx, sql`select t.account_id, coalesce(t.updated_at, t.due_date) as op, t.uitkomst from tasks t where t.status = 'klaar' and t.uitkomst is not null
      and t.action_type = any(string_to_array(${TAAK_POGING.join(',')}, ',')) and coalesce(t.updated_at, t.due_date) <= ${f.tot}
      and not exists (select 1 from activiteiten ac where ac.task_id = t.id) and t.account_id = any(string_to_array(${lijst(betrokken)}, ','))`)).map((r) => ({ accountId: r.account_id as string, op: iso(r.op)!, uitkomst: r.uitkomst as string })) : []
  const allePogingen = [...pogingen, ...taakPogingen]
  const benaderd = fase('benaderd').accounts.binnen
  const gemPogingen = benaderd.length && pogingen.length ? Math.round((pogingen.filter((p) => benaderd.includes(p.accountId)).length / benaderd.length) * 10) / 10 : null
  const gesprek = fase('in-gesprek').accounts.binnen
  const [bes] = gesprek.length && opties.details ? await rijen(tx, sql`select count(distinct ac.account_id)::int as n from activiteiten ac join contacts c on c.id = ac.contact_id where c.rol = 'beslisser' and ac.op <= ${f.tot} and ac.account_id = any(string_to_array(${lijst(gesprek)}, ','))`) : [{ n: 0 }]
  const noShow = gesch.filter((g) => g.gebeurtenis === 'afspraak-niet-verschenen').length
  // P23: "gewonnen na overdracht" uit de terugmelding deal.gewonnen van DealDrive; het account blijft overgedragen.
  const over = fase('overgedragen').accounts.binnen
  const [gew] = over.length && opties.details ? await rijen(tx, sql`select count(distinct account_id)::int as n from overdrachten where data ? 'gewonnen' and account_id = any(string_to_array(${lijst(over)}, ','))`) : [{ n: 0 }]
  return {
    kop, stok, normen, aantalAccounts: betrokken.length,
    fases: stand.map((s, i) => ({
      faseId: s.faseId, label: FUNNEL_LABEL[s.faseId], hoofdfase: FUNNEL_HOOFDFASE[s.faseId], aantal: s.binnengekomen,
      doorgestroomd: s.doorgestroomd, uitgevallen: s.uitgevallen, aanwezig: s.aanwezig, stok: stok?.faseId === s.faseId,
      ...(opties.details ? {
        conversie: i < stand.length - 1 ? conversie(s.binnengekomen, s.doorgestroomd) : null, doorlooptijd: doorlooptijd(s),
        norm: normen[s.faseId] ?? null, uitval: uitvalPerReden(s),
        extra: s.faseId === 'benaderd' ? (gemPogingen != null ? `${gemPogingen.toLocaleString('nl-NL')} pogingen gemiddeld` : null)
          : s.faseId === 'in-gesprek' ? (gesprek.length ? `${conversie(gesprek.length, bes?.n ?? 0)}% beslisser bereikt` : null)
          : s.faseId === 'afspraak-gehouden' ? (fase('afspraak-gepland').binnengekomen ? `${conversie(fase('afspraak-gepland').binnengekomen, noShow)}% no-show` : null)
          : s.faseId === 'overgedragen' ? (gew?.n ? `${gew.n} gewonnen na overdracht` : null) : null,
      } : {}),
    })),
    pogingen: opties.details ? pogingTotAfspraak(allePogingen) : null,
    eersteAfspraak: opties.details ? eersteAfspraakPoging(allePogingen) : null,
  }
}

/** De accounts achter een fase of uitvalreden, oudste "fase sinds" eerst. */
export async function funnelAccounts(tx: Tx, f: FunnelFilters, fase: FunnelFase, reden: string | null) {
  const ids = await accountIds(tx, f)
  const stand = funnelStand(await geschiedenis(tx, ids, f.van, f.tot), { van: f.van, tot: f.tot }).find((s) => s.faseId === fase)
  if (!stand) return []
  const keuze = reden ? stand.accounts.uit.filter((u) => u.reden === reden).map((u) => u.accountId) : stand.accounts.binnen
  if (!keuze.length) return []
  const rows = await rijen(tx, sql`select a.id, a.name, a.fase_id, a.fase_sinds, a.laatste_contact_op, a.nb_status,
      (select t.title from tasks t where t.account_id = a.id and t.status in ('open', 'bezig') order by t.due_date nulls last limit 1) as volgende_stap
    from accounts a where a.id = any(string_to_array(${lijst(keuze)}, ',')) order by a.fase_sinds nulls last, a.name`)
  return rows.map((r) => ({ id: r.id, naam: r.name, faseId: r.fase_id, faseSinds: iso(r.fase_sinds), laatstePoging: iso(r.laatste_contact_op), volgendeStap: r.volgende_stap, status: r.nb_status, reden: reden ?? stand.accounts.uit.find((u) => u.accountId === r.id)?.reden ?? null }))
}

/** CSV van precies wat op het scherm staat. */
export function funnelCsv(f: Awaited<ReturnType<typeof laadFunnel>>): string {
  const kop = ['Fase', 'Hoofdfase', 'Aantal', 'Doorgestroomd', 'Uitgevallen', 'Aanwezig', 'Conversie', 'Norm', 'Doorlooptijd (dagen)', 'Uitval']
  const q = (v: unknown) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [kop.join(';'), ...f.fases.map((x: any) => [x.label, x.hoofdfase, x.aantal, x.doorgestroomd, x.uitgevallen, x.aanwezig, x.conversie ?? '', x.norm?.conversie ?? '', x.doorlooptijd ?? '', (x.uitval ?? []).map((u: any) => `${u.reden} ${u.aantal}`).join(', ')].map(q).join(';'))].join('\n')
}

/** De afgeleide stand van één dag per gebruiker (motor). Idempotent: dezelfde dag opnieuw overschrijft. */
export async function bouwFunnelStand(tx: Tx, org: string, dag: string) {
  const eigenaars = (await rijen(tx, sql`select distinct owner_id from accounts where account_kind = 'prospect' and owner_id is not null`)).map((r) => r.owner_id as string)
  let n = 0
  for (const g of eigenaars) {
    const ids = await accountIds(tx, { van: '', tot: '', gebruikerIds: [g] })
    const nu = new Date().toISOString()
    const periode = { van: nlTijdstip(dag, 0).toISOString(), tot: new Date(nlTijdstip(plusDagen(dag, 1), 0).getTime() - 1).toISOString(), uitTot: nu }
    // Instroom alleen deze dag; wat daarna gebeurde telt mee voor de uitstroom.
    const stand = funnelStand(await geschiedenis(tx, ids, periode.van, nu), periode)
    for (const s of stand) {
      if (!s.binnengekomen) continue
      await tx.execute(sql`insert into nb_funnel_stand (organisation_id, dag, gebruiker_id, reis_id, fase_id, binnengekomen, doorgestroomd, uitgevallen, aanwezig, doorlooptijd_som, doorlooptijd_aantal)
        values (${org}, ${dag}, ${g}, '', ${s.faseId}, ${s.binnengekomen}, ${s.doorgestroomd}, ${JSON.stringify(s.uitval)}::jsonb, ${s.aanwezig}, ${s.doorlooptijdSom}, ${s.doorlooptijdAantal})
        on conflict (organisation_id, dag, gebruiker_id, reis_id, fase_id) do update set binnengekomen = excluded.binnengekomen, doorgestroomd = excluded.doorgestroomd, uitgevallen = excluded.uitgevallen, aanwezig = excluded.aanwezig, doorlooptijd_som = excluded.doorlooptijd_som, doorlooptijd_aantal = excluded.doorlooptijd_aantal`)
      n++
    }
  }
  return n
}

/**
 * Filters en scope uit de URL. Standaard "mijn"; doelgroep, reis en campagne vanaf funnel.filters
 * (anders 403 met reden niveau); een persoon of team alleen met funnel.team en binnen de eigen teams.
 */
export async function filtersUitQuery(tx: Tx, ctx: { gebruiker: { id: string; rol: string }; kan: (f: string) => boolean }, q: Record<string, unknown>, nu = new Date()) {
  const s = (v: unknown) => (typeof v === 'string' && v && v !== 'alle' ? v : null)
  const filters = !!(s(q.doelgroep) || s(q.reis) || s(q.campagne) || s(q.reis2))
  if (filters && !ctx.kan('funnel.filters')) throw Object.assign(new Error('Functie niet beschikbaar'), { statusCode: 403, statusMessage: 'Functie niet beschikbaar', data: { functie: 'funnel.filters', reden: 'niveau' } })
  let gebruikerIds: string[] | null = [ctx.gebruiker.id]
  if (s(q.gebruiker) || s(q.team) || q.scope === 'team') {
    if (!ctx.kan('funnel.team')) throw Object.assign(new Error('Alleen voor de salesmanager'), { statusCode: 403, statusMessage: 'Alleen voor de salesmanager', data: { functie: 'funnel.team', reden: 'rol' } })
    const leden = await teamLeden(tx, ctx.gebruiker)
    if (s(q.gebruiker)) {
      if (!leden.includes(String(q.gebruiker))) throw Object.assign(new Error('Deze persoon valt buiten je team'), { statusCode: 403, statusMessage: 'Deze persoon valt buiten je team' })
      gebruikerIds = [String(q.gebruiker)]
    } else if (s(q.team)) {
      const inTeam = (await rijen(tx, sql`select id from users where team_id = ${String(q.team)}`)).map((r) => r.id as string)
      gebruikerIds = inTeam.filter((id) => leden.includes(id))
      if (!gebruikerIds.length) throw Object.assign(new Error('Dit team is niet van jou'), { statusCode: 403, statusMessage: 'Dit team is niet van jou' })
    } else gebruikerIds = leden
  }
  const [o] = await rijen(tx, sql`select value from org_settings where key = 'organisatie'`)
  const p = periodeVan({ periode: s(q.periode), van: s(q.van), tot: s(q.tot) }, nu, Number((o?.value as any)?.verkoopjaarStartmaand) || 1)
  return { periode: p, f: { van: p.van, tot: p.tot, gebruikerIds, reisId: s(q.reis), doelgroepId: s(q.doelgroep), campagneId: s(q.campagne), kanaal: s(q.kanaal) } as FunnelFilters, reis2: s(q.reis2) }
}

export { FUNNEL_FASES }
