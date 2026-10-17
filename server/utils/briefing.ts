// Briefings, Pitstop en concepten op de server (P18, F11, 11.5, 8.5.7). De briefing is berekend uit de
// context (geen tabel); eigen tekst staat per blok in briefing_teksten; een AI-versie is een concept
// (tabel concepten; het logboek blijft agent_runs). De Pitstop schrijft per actiesoort een concept ter goedkeuring; de agent voert niets uit.
import { sql } from 'drizzle-orm'
import { combineer, kiesBriefingSoort, gewogenBezwaren, pitstopDrieRegels, SOORT_LABEL, soortReden, vulBriefing, winpuntMetBewijs, type BriefingContext, type BriefingSoort } from '../../shared/briefing'
import { filterNamen } from '../../shared/verkoopverhaal'
import { bouwPrompt, lengteBinnenGrens, mailtoLink, overname, stijlScore, whatsappLink, type SchrijfKanaal } from '../../shared/schrijver'
import { STANDAARD_FASES } from '../../shared/reis'
import { AFSPRAAK_TERUG_DAGEN, compleetheid, HORIZON_DAGEN, inPeriode, MAX_BRIEFINGS, telPerPeriode, type Periode } from '../../shared/briefingOverzicht'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { filterConcepten, sindsVan, type ConceptFilter } from '../../shared/concepten'
import type { JsonSchema } from '../../shared/aiStap'
import { logAgentRun, toets } from './agents/bewaker'
import { gebruikDb } from './db'
import { voerAiStapUit } from './llm-provider'
import { verstuurMail } from './mail'
import { teamLeden } from './planning'
import { leesStand } from './vvProjectie'
import { promptSchrijver } from '../../shared/promptStandaard'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string, extra: object = {}): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m, data: extra }) }
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const GESPREK = ['gesproken', 'afspraak', 'later', 'nieuw_contact', 'geen_interesse', 'niet_geschikt', 'vervolg']

export type Onderwerp = { soort: 'afspraak' | 'taak' | 'account'; id: string }

/**
 * Gedeelde stukken binnen één verzoek (het overzicht berekent tientallen briefings): het verkoopverhaal, de
 * klassen en per account wat voor elk gesprek met dat account gelijk is. Zonder cache rekent elke briefing alles zelf.
 */
export interface BriefingCache { stand?: Awaited<ReturnType<typeof leesStand>>; klassen?: any[]; accounts: Map<string, Awaited<ReturnType<typeof accountDeel>>> }
export const nieuweBriefingCache = (): BriefingCache => ({ accounts: new Map() })

/** Wat voor elk gesprek met hetzelfde account gelijk is. */
async function accountDeel(tx: Tx, accountId: string, cache: BriefingCache) {
  const [a] = await rijen(tx, sql`select a.*, r.data as reis_data from accounts a left join reistemplates r on r.id = a.reis_id where a.id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  const contacten = await rijen(tx, sql`select id, first_name, last_name, rol, data from contacts where account_id = ${accountId} and status <> 'vertrokken' order by rol, last_name`)
  // Een import maakt geen contactmoment: alleen activiteiten met een gespreksuitkomst of een afspraak tellen.
  const acts = await rijen(tx, sql`select ac.uitkomst, ac.soort, ac.op, ac.data->>'tekst' as tekst, c.rol from activiteiten ac left join contacts c on c.id = ac.contact_id where ac.account_id = ${accountId} and ac.soort <> 'import' order by ac.op desc limit 50`)
  const [sig] = await rijen(tx, sql`select title, bron from signals where account_id = ${accountId} and status in ('nieuw', 'open', 'gelezen') order by relevance_score desc limit 1`)
  const [vervolg] = await rijen(tx, sql`select data->>'vervolgstap' as v, data->'verslag'->>'tekst' as verslag from appointments where account_id = ${accountId} and status = 'afgerond' and coalesce((data->>'overdragen')::boolean, false) order by start_at desc limit 1`)
  cache.stand ??= await leesStand(tx)
  const gebruikt = (await rijen(tx, sql`select concept->>'winpuntId' as w from concepten where account_id = ${accountId} and status <> 'verworpen' and concept->>'winpuntId' is not null`)).map((r) => r.w)
  cache.klassen ??= ((await rijen(tx, sql`select value from org_settings where key = 'klassen'`))[0]?.value ?? []) as any[]
  const geschiedenis = (await rijen(tx, sql`select naar_fase_id, op from reisgeschiedenis where account_id = ${accountId} and naar_fase_id is not null order by op`)).map((g) => ({ fase: STANDAARD_FASES.find((f) => f.id === g.naar_fase_id)?.label ?? g.naar_fase_id, op: iso(g.op)! }))
  return { a: a!, contacten, acts, sig, vervolg, gebruikt, geschiedenis }
}

/** Alles wat soortbepaling en blokken nodig hebben, voor elke ingang hetzelfde (gat 34). */
async function context(tx: Tx, o: Onderwerp, cache: BriefingCache = nieuweBriefingCache()) {
  let accountId: string | null = null
  let afspraak: Rij | undefined
  let taak: Rij | undefined
  if (o.soort === 'afspraak') {
    ;[afspraak] = await rijen(tx, sql`select ap.*, m.naam as soort_naam, m.data as soort_data from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.id = ${o.id}`)
    if (!afspraak) fout(404, 'Afspraak niet gevonden')
    accountId = afspraak!.account_id
  } else if (o.soort === 'taak') {
    ;[taak] = await rijen(tx, sql`select * from tasks where id = ${o.id}`)
    if (!taak) fout(404, 'Taak niet gevonden')
    accountId = taak!.account_id
  } else accountId = o.id
  if (!accountId) fout(404, 'Er hoort geen account bij; een briefing gaat over een account')
  let deel = cache.accounts.get(accountId!)
  if (!deel) { deel = await accountDeel(tx, accountId!, cache); cache.accounts.set(accountId!, deel) }
  const { a, contacten, acts, sig, vervolg, gebruikt, geschiedenis } = deel
  const stand = cache.stand!
  const gesprekken = acts.filter((x) => GESPREK.includes(x.uitkomst) || x.soort === 'afspraak').length
  const onderwerpSoort = o.soort === 'account' ? null : o.soort
  const eigen = onderwerpSoort ? await rijen(tx, sql`select blok, tekst from briefing_teksten where onderwerp = ${onderwerpSoort} and onderwerp_id = ${o.id}`) : []
  const fase = (a.reis_data?.fases ?? STANDAARD_FASES).find((f: any) => f.id === a.fase_id)
  const brancheNaam = (stand.branches ?? []).find((b: any) => b.id === a.vv_branche_id)?.naam ?? null
  const klasse = (cache.klassen ?? []).find((k) => k.id === a.klasse)?.naam ?? null
  const ctx: BriefingContext = {
    account: { naam: a.name, branche: brancheNaam, plaats: a.city, klasse, vvBrancheId: a.vv_branche_id, huidigeLeverancierId: a.huidige_leverancier_id, adres: a.data?.adres ?? null, aanleiding: sig ? { tekst: sig.title, bron: sig.bron } : null, dossierFeiten: a.data?.dossier?.kernfeiten ?? [], band: a.data?.band ?? {} },
    contacten: contacten.map((c) => ({ naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), functie: c.data?.functie ?? null, rol: c.rol })),
    verslagen: acts.filter((x) => x.tekst).slice(0, 5).map((x) => ({ tekst: x.tekst, op: iso(x.op)! })),
    faseId: a.fase_id, faseAccent: fase?.accent ?? null,
    afspraak: afspraak ? { soort: afspraak.soort_naam, vorm: afspraak.vorm, start: iso(afspraak.start_at)!, verslag: afspraak.data?.verslag?.tekst ?? vervolg?.verslag ?? null, vervolgstap: afspraak.data?.vervolgstap ?? vervolg?.v ?? null, locatie: afspraak.data?.locatie ?? null } : vervolg ? { soort: 'Eerste afspraak', start: new Date().toISOString(), verslag: vervolg.verslag, vervolgstap: vervolg.v } : null,
    geschiedenis,
    stand, eerderGebruikteWinpunten: gebruikt,
    // Dealtrace: de taak van een regel met een gekoppeld winpunt bepaalt het gespreksonderwerp.
    vastWinpuntId: taak?.data?.winpunt?.id ?? null,
  }
  const soortCtx = {
    vastgezet: (eigen.find((e) => e.blok === '_soort')?.tekst as BriefingSoort) ?? null,
    meetingsoortVorm: afspraak?.vorm ?? null, eersteAfspraakGehoudenMetVervolg: !!vervolg && a.nb_status !== 'nee',
    faseId: a.fase_id, gesprekken, beslisserGesproken: acts.some((x) => x.rol === 'beslisser' && (GESPREK.includes(x.uitkomst) || x.soort === 'afspraak')),
  }
  const soort = kiesBriefingSoort(soortCtx)
  return { a, afspraak, taak, contacten, ctx, soort, soortCtx, eigen, accountId: accountId!, stand }
}

/** De briefing voor een afspraak, taak of account: soort (met de reden), blokken met herkomst, drie regels. */
export async function briefing(tx: Tx, o: Onderwerp, cache?: BriefingCache) {
  const c = await context(tx, o, cache)
  const [ai] = await rijen(tx, sql`select concept from concepten where status in ('klaar', 'goedgekeurd') and concept->>'type' = 'briefing'
    and ${o.soort === 'afspraak' ? sql`appointment_id = ${o.id}` : o.soort === 'taak' ? sql`task_id = ${o.id}` : sql`account_id = ${o.id}`} order by op desc limit 1`)
  const blokken = combineer(vulBriefing(c.soort, c.ctx), ai?.concept?.blokken ?? {}, Object.fromEntries(c.eigen.filter((e) => e.blok !== '_soort').map((e) => [e.blok, e.tekst])))
  const { winpunt } = winpuntMetBewijs(c.ctx)
  const rij = c.afspraak ?? c.taak
  return {
    soort: c.soort, soortLabel: SOORT_LABEL[c.soort], vastgezet: c.eigen.some((e) => e.blok === '_soort'), soortReden: soortReden(c.soortCtx), automatischeSoort: kiesBriefingSoort({ ...c.soortCtx, vastgezet: null }),
    account: { id: c.accountId, naam: c.a.name, soort: (c.a.account_kind ?? 'prospect') as string }, wanneer: c.afspraak ? iso(c.afspraak.start_at) : c.taak ? iso(c.taak.due_date) : null,
    blokken, drieRegels: pitstopDrieRegels(blokken), winpuntId: winpunt?.id ?? null,
    uitkomst: rij?.data?.briefingUitkomst ?? null,
    // Voor de kaart op /briefings: het gesprek in een regel, de actiesoort, het contact en of er een eerder verslag is.
    titel: c.afspraak ? `${c.afspraak.soort_naam}${c.afspraak.vorm === 'bezoek' ? ' op locatie' : c.afspraak.vorm === 'online' ? ' online' : c.afspraak.vorm === 'telefoon' ? ' aan de telefoon' : ''}` : c.taak ? String(c.taak.title) : null,
    actie: (c.afspraak ? c.afspraak.vorm : c.taak ? c.taak.action_type : null) as string | null,
    contactId: (rij?.contact_id ?? null) as string | null,
    eigenaarId: (rij?.owner_id ?? null) as string | null,
    verslag: c.ctx.verslagen.length > 0 || !!c.afspraak?.data?.verslag?.tekst,
  }
}

/**
 * Het overzicht op /briefings: je komende afspraken met een account (ook een geplande afspraak van de afgelopen
 * week die nog niet is afgerond), je open beltaken en bezoektaken met een account (ook achterstallige), en je
 * belblokken (de taken daarin staan als één kaart per belblok; de briefing per gesprek staat in de belmodus).
 * Eerst een lichte lijst over de hele horizon voor de tellers per periode, daarna voluit de briefings in de
 * gekozen periode (hooguit MAX_BRIEFINGS, de rest telt als `meer`). Met wie=team de salesmanager ook die van zijn teams.
 */
export async function briefingOverzicht(tx: Tx, g: { id: string; rol: string }, f: { periode: Periode; van?: string | null; tot?: string | null; team?: boolean }, nu = new Date()) {
  const wie = f.team && ['salesmanager', 'beheerder'].includes(g.rol) ? await teamLeden(tx, g) : [g.id]
  const wieLijst = wie.join(',')
  const vandaag = nlMoment(nu).datum
  const terug = nlTijdstip(plusDagen(vandaag, -AFSPRAAK_TERUG_DAGEN), 0).toISOString()
  const verst = [plusDagen(vandaag, HORIZON_DAGEN), f.periode === 'vantot' && f.tot ? f.tot : ''].sort().at(-1)!
  const grens = nlTijdstip(plusDagen(verst, 1), 0).toISOString()
  const dagVan = (t: unknown) => (t == null ? null : nlMoment(new Date(iso(t)!)).datum)
  const afs = await rijen(tx, sql`select id, start_at as wanneer from appointments where owner_id = any(string_to_array(${wieLijst}, ',')) and status = 'gepland' and account_id is not null and start_at >= ${terug} and start_at < ${grens}`)
  const taken = await rijen(tx, sql`select t.id, t.due_date as wanneer, t.belblok_id from tasks t left join belblok_sessies b on b.id = t.belblok_id and b.status in ('gepland', 'bezig')
    where t.owner_id = any(string_to_array(${wieLijst}, ',')) and t.status in ('open', 'bezig') and t.account_id is not null and t.action_type in ('bellen', 'bezoek')
      and (t.due_date is null or t.due_date < ${grens}) and (t.belblok_id is null or b.id is null)`)
  const blokken = await rijen(tx, sql`select b.id, b.start_op as wanneer, b.eind_op, b.status, b.gebruiker_id, count(t.id)::int as aantal, (array_agg(a.name order by t.due_date))[1:3] as namen
    from belblok_sessies b join tasks t on t.belblok_id = b.id and t.status in ('open', 'bezig') left join accounts a on a.id = t.account_id
    where b.gebruiker_id = any(string_to_array(${wieLijst}, ',')) and b.status in ('gepland', 'bezig') and b.start_op >= ${terug} and b.start_op < ${grens}
    group by b.id order by b.start_op`)
  type Licht = { onderwerp: 'afspraak' | 'taak' | 'belblok'; id: string; wanneer: string | null; dag: string | null; rij: Rij }
  const licht: Licht[] = [
    ...afs.map((r) => ({ onderwerp: 'afspraak' as const, id: r.id, wanneer: iso(r.wanneer), dag: dagVan(r.wanneer), rij: r })),
    ...taken.map((r) => ({ onderwerp: 'taak' as const, id: r.id, wanneer: iso(r.wanneer), dag: dagVan(r.wanneer), rij: r })),
    ...blokken.map((r) => ({ onderwerp: 'belblok' as const, id: r.id, wanneer: iso(r.wanneer), dag: dagVan(r.wanneer), rij: r })),
  ].sort((a, b) => String(a.wanneer ?? '9').localeCompare(String(b.wanneer ?? '9')))
  const tellers = telPerPeriode(licht.map((x) => x.dag), vandaag)
  const inBereik = licht.filter((x) => inPeriode(x.dag, f.periode, vandaag, { van: f.van, tot: f.tot }))
  const voluit = inBereik.slice(0, MAX_BRIEFINGS)
  const cache = nieuweBriefingCache()
  const gesprekken = voluit.filter((x) => x.onderwerp !== 'belblok')
  // Pitstop: het nieuwste concept per gesprek (klaar, goedgekeurd of verstuurd); contacten en eigenaren in één keer.
  const ids = gesprekken.map((x) => x.id).join(',')
  const pit = ids ? await rijen(tx, sql`select distinct on (coalesce(task_id, appointment_id)) coalesce(task_id, appointment_id) as gesprek, status from concepten
    where status in ('klaar', 'goedgekeurd', 'verstuurd') and (task_id = any(string_to_array(${ids}, ',')) or appointment_id = any(string_to_array(${ids}, ','))) order by coalesce(task_id, appointment_id), op desc`) : []
  const pitVan = new Map(pit.map((p) => [p.gesprek as string, p.status as string]))
  const namen = new Map((await rijen(tx, sql`select id, name from users where id = any(string_to_array(${wieLijst}, ','))`)).map((u) => [u.id as string, String(u.name ?? '').replace(/^Testgebruiker /, '')]))
  const items: any[] = []
  // Je volgende gesprek staat bovenaan, ook als het buiten de gekozen periode valt.
  const grensNu = nu.getTime() - 15 * 60000
  const eerstvolgend = licht.find((x) => x.onderwerp !== 'belblok' && x.wanneer && Date.parse(x.wanneer) >= grensNu)
  const teBerekenen = eerstvolgend && !voluit.includes(eerstvolgend) ? [...voluit, eerstvolgend] : voluit
  if (eerstvolgend && teBerekenen !== voluit) {
    const p = await rijen(tx, sql`select status from concepten where status in ('klaar', 'goedgekeurd', 'verstuurd') and (task_id = ${eerstvolgend.id} or appointment_id = ${eerstvolgend.id}) order by op desc limit 1`)
    if (p[0]) pitVan.set(eerstvolgend.id, p[0].status)
  }
  for (const x of teBerekenen) {
    if (x.onderwerp === 'belblok') {
      items.push({ onderwerp: 'belblok', id: x.id, wanneer: x.wanneer, eind: iso(x.rij.eind_op), aantal: x.rij.aantal, namen: (x.rij.namen ?? []).filter(Boolean), bezig: x.rij.status === 'bezig', eigenaar: wie.length > 1 ? { id: x.rij.gebruiker_id, naam: namen.get(x.rij.gebruiker_id) ?? '' } : null })
      continue
    }
    const b = await briefing(tx, { soort: x.onderwerp, id: x.id }, cache)
    const { blokken: bl, ...rest } = b
    items.push({ onderwerp: x.onderwerp, id: x.id, ...rest, compleet: compleetheid(bl), pitstop: pitVan.get(x.id) ?? null, eigenaar: wie.length > 1 && b.eigenaarId ? { id: b.eigenaarId, naam: namen.get(b.eigenaarId) ?? '' } : null })
  }
  // Het contact van het gesprek, anders de beslisser van het account.
  const accIds = [...new Set(items.filter((i) => i.onderwerp !== 'belblok').map((i) => i.account.id))].join(',')
  const cts = accIds ? await rijen(tx, sql`select id, account_id, first_name, last_name, rol, data->>'functie' as functie from contacts where account_id = any(string_to_array(${accIds}, ',')) and status <> 'vertrokken'`) : []
  const contactUit = (c: Rij | undefined) => (c ? { id: c.id as string, naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), functie: (c.functie ?? null) as string | null } : null)
  for (const i of items) {
    if (i.onderwerp === 'belblok') continue
    i.contact = contactUit(cts.find((c) => c.id === i.contactId) ?? cts.find((c) => c.account_id === i.account.id && c.rol === 'beslisser') ?? cts.find((c) => c.account_id === i.account.id))
    delete i.contactId; delete i.eigenaarId
  }
  const volgend = eerstvolgend ? items.find((i) => i.id === eerstvolgend.id) ?? null : null
  return { vandaag, items: items.filter((i) => voluit.some((x) => x.id === i.id)), volgend, meer: inBereik.length - voluit.length, tellers, team: wie.length > 1 }
}

/** Eén zoekveld op /briefings: prospects en klanten op naam, contactpersonen op naam of functie (hooguit 30). */
export async function briefingZoek(tx: Tx, g: { id: string }, q: string) {
  const z = q.trim().replace(/[%_]/g, '')
  const patroon = `%${z}%`
  const acc = await rijen(tx, sql`select id, name, city, account_kind from accounts where gedeactiveerd_op is null ${z ? sql`and name ilike ${patroon}` : sql``}
    order by (owner_id = ${g.id}) desc nulls last, ${z ? sql`(name ilike ${`${z}%`}) desc,` : sql``} greatest(laatste_contact_op, updated_at) desc nulls last, name limit 20`)
  const con = z ? await rijen(tx, sql`select c.id, c.first_name, c.last_name, c.data->>'functie' as functie, a.id as account_id, a.name as account_naam, a.account_kind from contacts c join accounts a on a.id = c.account_id
    where a.gedeactiveerd_op is null and c.status <> 'vertrokken' and (concat_ws(' ', c.first_name, c.last_name) ilike ${patroon} or c.data->>'functie' ilike ${patroon})
    order by (a.owner_id = ${g.id}) desc nulls last, (c.first_name ilike ${`${z}%`} or c.last_name ilike ${`${z}%`}) desc, c.last_name limit 20`) : []
  // Met een zoekterm de contactpersonen ertussen: eerst de bedrijven, dan de personen (hooguit 30 samen).
  return [
    ...acc.map((a) => ({ id: `a:${a.id}`, soort: 'account' as const, accountId: a.id as string, naam: a.name as string, accountSoort: (a.account_kind ?? 'prospect') as string, plaats: (a.city ?? null) as string | null })),
    ...con.map((c) => ({ id: `c:${c.id}`, soort: 'contact' as const, contactId: c.id as string, accountId: c.account_id as string, naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), functie: (c.functie ?? null) as string | null, accountNaam: c.account_naam as string, accountSoort: (c.account_kind ?? 'prospect') as string })),
  ].slice(0, 30)
}

/**
 * De contactpersoon bij de briefing van een account (/briefings): gegevens, de laatste drie contactmomenten met
 * dit contact en zijn eerstvolgende open taken en geplande afspraken (hooguit drie), elk met een eigen briefing.
 * Null als het contact niet bij het account hoort.
 */
export async function contactBijBriefing(tx: Tx, accountId: string, contactId: string) {
  const [c] = await rijen(tx, sql`select id, first_name, last_name, email, rol, status, data from contacts where id = ${contactId} and account_id = ${accountId}`)
  if (!c) return null
  const momenten = await rijen(tx, sql`select soort, uitkomst, op, data->>'tekst' as tekst from activiteiten where contact_id = ${contactId} and soort <> 'import' order by op desc limit 3`)
  const gesprekken = await rijen(tx, sql`(select 'afspraak' as onderwerp, ap.id, m.naam as titel, ap.start_at as wanneer from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.contact_id = ${contactId} and ap.status = 'gepland' and ap.start_at >= now() - interval '1 day')
    union all (select 'taak' as onderwerp, t.id, t.title as titel, t.due_date as wanneer from tasks t where t.contact_id = ${contactId} and t.status in ('open', 'bezig'))
    order by wanneer nulls last limit 3`)
  return {
    id: c.id as string, naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), functie: c.data?.functie ?? null, rol: c.rol as string, email: c.email ?? null,
    telefoon: c.data?.telefoon ?? null, mobiel: c.data?.mobiel ?? null, linkedin: c.data?.linkedin ?? null, belMeNiet: !!c.data?.belMeNiet, vertrokken: c.status === 'vertrokken',
    momenten: momenten.map((m) => ({ soort: m.soort as string, uitkomst: (m.uitkomst ?? null) as string | null, op: iso(m.op)!, tekst: (m.tekst ?? null) as string | null })),
    gesprekken: gesprekken.map((g) => ({ onderwerp: g.onderwerp as 'afspraak' | 'taak', id: g.id as string, titel: g.titel as string, wanneer: iso(g.wanneer) })),
  }
}

export async function bewaarTekst(tx: Tx, org: string, door: string, o: { soort: 'afspraak' | 'taak'; id: string }, blok: string, tekst: string) {
  if (!tekst.trim()) { await tx.execute(sql`delete from briefing_teksten where onderwerp = ${o.soort} and onderwerp_id = ${o.id} and blok = ${blok}`); return { blok, tekst: null } }
  await tx.execute(sql`insert into briefing_teksten (organisation_id, onderwerp, onderwerp_id, blok, tekst, door) values (${org}, ${o.soort}, ${o.id}, ${blok}, ${tekst.trim()}, ${door})
    on conflict (organisation_id, onderwerp, onderwerp_id, blok) do update set tekst = excluded.tekst, door = excluded.door, op = now()`)
  return { blok, tekst: tekst.trim() }
}

/** Na het gesprek: "Doel gehaald?" (ja, deels, nee) en de volgende stap. */
export async function bewaarUitkomst(tx: Tx, o: { soort: 'afspraak' | 'taak'; id: string }, u: { doel: 'ja' | 'deels' | 'nee'; volgendeStap?: string | null }) {
  if (!['ja', 'deels', 'nee'].includes(u.doel)) fout(400, 'Kies ja, deels of nee')
  const waarde = JSON.stringify({ briefingUitkomst: { doel: u.doel, volgendeStap: u.volgendeStap ?? null, op: new Date().toISOString() } })
  if (o.soort === 'afspraak') await tx.execute(sql`update appointments set data = data || ${waarde}::jsonb where id = ${o.id}`)
  else await tx.execute(sql`update tasks set data = data || ${waarde}::jsonb where id = ${o.id}`)
  return { doel: u.doel }
}

// ── Pitstop (Schrijver, mandaat A, soort concept) ───────────────────────────

const TYPE_VAN: Record<string, 'mail' | 'linkedin' | 'whatsapp' | 'belscript' | 'briefing'> = { mailen: 'mail', linkedin: 'linkedin', bellen: 'belscript', bezoek: 'briefing', taak: 'briefing', bericht: 'whatsapp', sms: 'whatsapp' }
const SCHEMA: Record<string, JsonSchema> = {
  mail: { type: 'object', required: ['onderwerp', 'tekst'], additionalProperties: false, properties: { onderwerp: { type: 'string', maxLength: 120 }, tekst: { type: 'string', maxLength: 1500 }, winpuntId: { type: 'string' } } },
  linkedin: { type: 'object', required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string', maxLength: 900 }, winpuntId: { type: 'string' } } },
  whatsapp: { type: 'object', required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string', maxLength: 600 }, winpuntId: { type: 'string' } } },
  belscript: { type: 'object', required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string', maxLength: 1800 }, winpuntId: { type: 'string' } } },
  briefing: { type: 'object', required: ['blokken'], additionalProperties: false, properties: { blokken: { type: 'object', additionalProperties: false, properties: { opening: { type: 'string', maxLength: 600 }, winpunt: { type: 'string', maxLength: 600 }, doel: { type: 'string', maxLength: 600 } } }, winpuntId: { type: 'string' } } },
}
const KANAAL: Record<string, SchrijfKanaal> = { mail: 'mail', linkedin: 'linkedin', whatsapp: 'whatsapp', belscript: 'belscript', briefing: 'belscript' }

/** "Bereid voor": een concept per actiesoort, binnen de lengtegrens en met stijlscore 7 of hoger (anders één keer opnieuw). */
export async function bereidVoor(tx: Tx, org: string, gebruiker: any, o: { soort: 'afspraak' | 'taak'; id: string }, nu = new Date(), opties: { automatisch?: boolean; stap?: { instructie?: string | null; onderwerp?: string | null } } = {}) {
  const agent = opties.automatisch ? { agent: 'schrijver' as const } : {}
  const c = await context(tx, o)
  const type = o.soort === 'afspraak' ? 'briefing' : TYPE_VAN[c.taak!.action_type] ?? 'briefing'
  const { winpunt, bewijs } = winpuntMetBewijs(c.ctx)
  const namen = c.ctx.contacten.map((k) => ({ naam: k.naam, rol: k.rol === 'beslisser' ? 'de beslisser' : 'de contactpersoon' }))
  const versies = Object.fromEntries((await rijen(tx, sql`select onderdeel, versie from vv_sublagen where status = 'bevestigd'`)).map((r) => [r.onderdeel, r.versie]))
  const openVragen = (c.ctx.verslagen[0]?.tekst.match(/[^.!?]*\?/g) ?? []).map((v) => filterNamen(v.trim(), namen)).slice(0, 3)
  const materiaal = {
    pitstop: true, type, soort: c.soort, accent: c.ctx.faseAccent, branche: c.ctx.account.branche,
    aanleiding: c.ctx.account.aanleiding ? filterNamen(c.ctx.account.aanleiding.tekst, namen) : null,
    winpunt: winpunt ? { id: winpunt.id, titel: winpunt.titel, omschrijving: winpunt.omschrijving, bewijs } : null,
    bezwaren: gewogenBezwaren(c.ctx), openVragen,
    verslag: c.ctx.verslagen[0] ? filterNamen(c.ctx.verslagen[0].tekst, namen) : null,
  }
  const [pp] = await rijen(tx, sql`select value from org_settings where key = 'platformprompts'`)
  const prompt = bouwPrompt({ platform: (pp?.value as any)?.schrijver ?? null, organisatie: c.ctx.faseAccent ? `Fase-accent: ${c.ctx.faseAccent}` : null, instructie: promptSchrijver({ type, faseAccent: c.ctx.faseAccent, instructie: opties.stap?.instructie, onderwerp: opties.stap?.onderwerp }) }).volledig
  let r = await voerAiStapUit<any>(tx, org, { soort: 'concept', prompt, schema: SCHEMA[type]!, materiaal, gebruiker, boekAls: 'schrijver', accountId: c.accountId, ...agent } as any, nu)
  const tekstVan = (x: any) => (type === 'briefing' ? Object.values(x?.blokken ?? {}).join(' ') : String(x?.tekst ?? ''))
  let stijl = r.ok ? stijlScore(tekstVan(r.antwoord)) : null
  let lengte = r.ok ? lengteBinnenGrens(tekstVan(r.antwoord), KANAAL[type]!) : null
  if (r.ok && (stijl!.score < 7 || !lengte!.binnen)) {
    r = await voerAiStapUit<any>(tx, org, { soort: 'concept', prompt: `${prompt} Korter en concreter. Vermijd: ${stijl!.vermeden.join(', ') || 'jargon'}.`, schema: SCHEMA[type]!, materiaal, gebruiker, boekAls: 'schrijver', accountId: c.accountId, ...agent } as any, nu)
    if (r.ok) { stijl = stijlScore(tekstVan(r.antwoord)); lengte = lengteBinnenGrens(tekstVan(r.antwoord), KANAAL[type]!) }
  }
  const id = crypto.randomUUID()
  // Een opvolgreeks met een vast onderwerp per stap: dat onderwerp geldt voor het concept.
  if (r.ok && opties.stap?.onderwerp && type === 'mail') r.antwoord.onderwerp = opties.stap.onderwerp
  const concept = r.ok ? { type, ...r.antwoord, winpuntId: r.antwoord.winpuntId ?? winpunt?.id ?? null, stijlscore: stijl!.score, woorden: lengte!.woorden, grens: lengte!.grens, vvVersies: versies, bronnen: [winpunt ? { soort: 'winpunt', titel: winpunt.titel } : null, c.ctx.account.aanleiding ? { soort: 'aanleiding', titel: c.ctx.account.aanleiding.tekst, bron: c.ctx.account.aanleiding.bron } : null].filter(Boolean), aanleiding: `Pitstop voor ${c.a.name}` } : null
  // Het logboek (agent_runs, alleen toevoegen) en het concept ter goedkeuring.
  await logAgentRun(tx, org, { agent: 'schrijver', handeling: `pitstop:${type}`, mandaat: 'A', uitkomst: r.ok ? 'uitgevoerd' : 'fout', gebruikerId: gebruiker.id, accountId: c.accountId, taskId: o.soort === 'taak' ? o.id : undefined, reden: r.ok ? undefined : r.reden, bronnen: concept?.bronnen ?? [] } as any, nu)
  if (concept) await tx.execute(sql`insert into concepten (id, organisation_id, agent, handeling, gebruiker_id, account_id, task_id, appointment_id, concept, status, op)
    values (${id}, ${org}, 'schrijver', ${`pitstop:${type}`}, ${gebruiker.id}, ${c.accountId}, ${o.soort === 'taak' ? o.id : null}, ${o.soort === 'afspraak' ? o.id : null}, ${JSON.stringify(concept)}::jsonb, 'klaar', ${nu.toISOString()})`)
  return { id, status: r.ok ? 'klaar' : 'mislukt', concept, reden: r.ok ? null : r.reden }
}

// ── Concepten (inbox, 8.5.7) ───────────────────────────────────────────────

export const conceptUit = (r: Rij) => ({
  id: r.id as string, agent: r.agent as string, handeling: r.handeling as string, status: r.status as string, overname: r.overname, op: iso(r.op), beslotenOp: iso(r.besloten_op),
  accountId: r.account_id, accountNaam: r.account_naam ?? null, taskId: r.task_id, afspraakId: r.appointment_id, gebruikerId: r.gebruiker_id, gebruiker: r.gebruiker_naam ?? null, concept: r.concept,
  account: r.account_id && r.account_naam ? { id: r.account_id as string, naam: r.account_naam as string, soort: (r.account_kind ?? null) as string | null } : null,
  // Het contact: uit het concept, anders van de taak of afspraak waar het aan hangt, anders de beslisser.
  contact: r.ct_id ? { id: r.ct_id as string, naam: [r.ct_voornaam, r.ct_achternaam].filter(Boolean).join(' ') || 'Contact', functie: r.ct_functie ?? null, rol: r.ct_rol ?? null, email: r.ct_email || null, via: (r.ct_id === r.concept?.contactId ? 'concept' : r.ct_id === r.taak_contact ? 'taak' : r.ct_id === r.afspraak_contact ? 'afspraak' : 'beslisser') as string } : null,
  taak: r.task_id && r.taak_titel ? { id: r.task_id as string, titel: r.taak_titel as string } : null,
  afspraak: r.appointment_id && r.afspraak_start ? { id: r.appointment_id as string, start: iso(r.afspraak_start) } : null,
  links: r.concept && r.concept.type !== 'briefing' && r.concept.type !== 'taak' ? { mailto: r.concept.type === 'mail' ? mailtoLink({ aan: r.email ?? null, onderwerp: r.concept.onderwerp, tekst: r.concept.tekst }) : null, whatsapp: whatsappLink(String(r.concept.tekst ?? ''), r.mobiel ?? null) } : null,
})

/** De rijen van de inbox met account, contact, taak en afspraak; eigen concepten en die van het team. */
async function conceptRijen(tx: Tx, wie: string[], f: { status?: string | null; type?: string | null; accountId?: string | null; sinds?: Date | null; limiet: number }) {
  return rijen(tx, sql`select r.*, a.name as account_naam, a.account_kind, u.name as gebruiker_naam, m.email, m.mobiel,
        t.title as taak_titel, t.contact_id as taak_contact, ap.start_at as afspraak_start, ap.contact_id as afspraak_contact,
        ct.id as ct_id, ct.first_name as ct_voornaam, ct.last_name as ct_achternaam, ct.rol as ct_rol, ct.email as ct_email, ct.data->>'functie' as ct_functie
      from concepten r
      left join accounts a on a.id = r.account_id left join users u on u.id = r.gebruiker_id
      left join tasks t on t.id = r.task_id left join appointments ap on ap.id = r.appointment_id
      left join lateral (select coalesce(r.concept->>'contactId', t.contact_id, ap.contact_id, '') as id) g on true
      left join lateral (select id, first_name, last_name, rol, email, data from contacts where account_id = r.account_id and status <> 'vertrokken' and (id = g.id or rol = 'beslisser') order by (id = g.id) desc limit 1) ct on true
      left join lateral (select email, data->>'mobiel' as mobiel from contacts where account_id = r.account_id and status <> 'vertrokken' and coalesce(email, '') <> '' order by (id = g.id) desc, (rol = 'beslisser') desc limit 1) m on true
    where r.gebruiker_id = any(string_to_array(${wie.join(',')}, ','))
      ${f.status === 'alle' ? sql`` : f.status ? sql`and r.status = ${f.status}` : sql`and r.status in ('klaar', 'goedgekeurd')`}
      ${f.type ? sql`and r.concept->>'type' = ${f.type}` : sql``} ${f.accountId ? sql`and r.account_id = ${f.accountId}` : sql``}
      ${f.sinds ? sql`and r.op >= ${f.sinds.toISOString()}` : sql``}
    order by r.op desc limit ${f.limiet}`)
}

/** De inbox: eigen concepten; de salesmanager ook die van zijn teams (8.12). */
export async function concepten(tx: Tx, g: { id: string; rol: string }, f: { status?: string | null; type?: string | null; accountId?: string | null; team?: boolean } = {}) {
  const wie = f.team && ['salesmanager', 'beheerder'].includes(g.rol) ? await teamLeden(tx, g) : [g.id]
  return (await conceptRijen(tx, wie, { ...f, limiet: 100 })).map(conceptUit)
}

/** De conceptenpagina: filters op soort, status, agent, account (zoeken) en periode, met tellers per filter. */
export async function conceptenOverzicht(tx: Tx, g: { id: string; rol: string }, f: ConceptFilter & { accountId?: string | null; sinds?: string | null; team?: boolean; concept?: string | null }, nu = new Date()) {
  const wie = f.team && ['salesmanager', 'beheerder'].includes(g.rol) ? await teamLeden(tx, g) : [g.id]
  const alle = (await conceptRijen(tx, wie, { status: 'alle', accountId: f.accountId, sinds: sindsVan(f.sinds, nu), limiet: 1000 })).map((r) => {
    const c = conceptUit(r)
    return { ...c, type: (c.concept?.type ?? null) as string | null, zoektekst: [c.accountNaam, c.contact?.naam, c.concept?.onderwerp].filter(Boolean).join(' ') }
  })
  const { concepten: lijst, tellers } = filterConcepten(alle, f)
  const uit = ({ type: _t, zoektekst: _z, ...c }: (typeof alle)[number]) => c
  const uitgelicht = f.concept ? alle.find((c) => c.id === f.concept) ?? (await conceptRijen(tx, wie, { status: 'alle', limiet: 1000 })).map(conceptUit).find((c) => c.id === f.concept) ?? null : null
  return { concepten: lijst.slice(0, 100).map(uit), totaal: lijst.length, tellers, uitgelicht: uitgelicht ? ('zoektekst' in uitgelicht ? uit(uitgelicht as any) : uitgelicht) : null }
}

/** Goedkeuren (met of zonder aanpassing) of verwerpen; legt de overname vast (11.2). 409 als het al besloten is. */
export async function besluit(tx: Tx, door: { id: string; rol: string }, id: string, b: { besluit: 'goedkeuren' | 'verwerpen'; tekst?: string | null; onderwerp?: string | null }) {
  const [r] = await rijen(tx, sql`select * from concepten where id = ${id}`)
  if (!r) fout(404, 'Concept niet gevonden')
  if (r!.gebruiker_id !== door.id && !(['salesmanager', 'beheerder'].includes(door.rol) && (await teamLeden(tx, door)).includes(r!.gebruiker_id))) fout(403, 'Dit concept is van een collega')
  if (r!.status !== 'klaar') {
    if ((b.besluit === 'goedkeuren' && r!.status === 'goedgekeurd') || (b.besluit === 'verwerpen' && r!.status === 'verworpen')) return conceptUit(r!)
    fout(409, 'Over dit concept is al besloten')
  }
  const orig = String(r!.concept?.tekst ?? Object.values(r!.concept?.blokken ?? {}).join('\n'))
  const nieuw = b.besluit === 'verwerpen' ? null : b.tekst ?? orig
  const concept = b.besluit === 'goedkeuren' && b.tekst != null ? { ...r!.concept, tekst: b.tekst, ...(b.onderwerp ? { onderwerp: b.onderwerp } : {}) } : r!.concept
  await tx.execute(sql`update concepten set status = ${b.besluit === 'verwerpen' ? 'verworpen' : 'goedgekeurd'}, overname = ${overname(orig, nieuw)}, concept = ${JSON.stringify(concept)}::jsonb, besloten_op = now() where id = ${id}`)
  return conceptUit((await rijen(tx, sql`select * from concepten where id = ${id}`))[0]!)
}

/** Versturen van een goedgekeurd mailconcept via de mailkoppeling, langs de Bewaker (consent, afkoeling, werkuren). */
export async function verstuurConcept(tx: Tx, org: string, door: { id: string; rol: string; niveau: string; data?: any }, id: string, basisUrl: string, nu = new Date(), opties: { terugval?: boolean } = {}) {
  const [r] = await rijen(tx, sql`select * from concepten where id = ${id}`)
  if (!r || r.concept?.type !== 'mail') fout(404, 'Mailconcept niet gevonden')
  if (r!.gebruiker_id !== door.id) fout(403, 'Alleen de eigenaar verstuurt dit concept')
  if (r!.status === 'verstuurd') return { status: 'verstuurd', tekst: 'Al verstuurd.' }
  if (r!.status !== 'goedgekeurd') fout(409, 'Keur het concept eerst goed')
  const [c] = await rijen(tx, sql`select id, email, rol from contacts where account_id = ${r!.account_id} and status <> 'vertrokken' and coalesce(email, '') <> '' order by (id = ${r!.concept?.contactId ?? ''}) desc, (rol = 'beslisser') desc limit 1`)
  if (!c) fout(422, 'Er is geen e-mailadres bij dit account')
  const eerder = (await rijen(tx, sql`select 1 from activiteiten where account_id = ${r!.account_id} and soort = 'mail' limit 1`)).length > 0
  const t = await toets(tx, org, { agent: 'verzender', handeling: 'mail.versturen', gebruiker: { id: door.id, niveau: door.niveau, data: door.data ?? {} }, accountId: r!.account_id, contactId: c!.id, kanaal: 'mail', naarBuiten: true, eersteBericht: !eerder } as any, nu)
  if (!t.mag) fout(403, t.reden ?? 'Tegengehouden door de Bewaker')
  const [afzender] = opties.terugval ? await rijen(tx, sql`select email from users where id = ${door.id}`) : []
  const v = await verstuurMail(tx, org, { aan: c!.email, onderwerp: r!.concept.onderwerp ?? 'Even voorstellen', tekst: r!.concept.tekst }, { eersteMail: !eerder, basisUrl, terugval: opties.terugval, antwoordAan: afzender?.email ?? null }, nu)
  if (!v.ok) fout(v.status, v.tekst)
  await tx.execute(sql`update concepten set status = 'verstuurd' where id = ${id}`)
  await tx.execute(sql`insert into activiteiten (organisation_id, account_id, contact_id, soort, kanaal, uitkomst, door, op, data) values (${org}, ${r!.account_id}, ${c!.id}, 'mail', 'mail', 'verzonden', ${door.id}, ${nu.toISOString()}, ${JSON.stringify({ conceptId: id, onderwerp: r!.concept.onderwerp ?? null, eersteMail: !eerder, vvVersies: r!.concept.vvVersies ?? null })}::jsonb)`)
  if (r!.task_id) await tx.execute(sql`update tasks set executor_status = 'uitgevoerd', updated_at = now() where id = ${r!.task_id}`)
  return { status: 'verstuurd', tekst: 'Verstuurd.' }
}

/** Automatisch voorbereiden (F15): voor nieuwe taken uit regels met automatisch voorbereiden, hooguit 10 per run. */
export async function automatischVoorbereiden(tx: Tx, org: string, sinds: string, nu = new Date()) {
  const taken = await rijen(tx, sql`select t.id, u.id as uid, u.niveau, u.data from tasks t join activity_rules r on r.id = t.rule_id join users u on u.id = t.owner_id
    where t.created_at >= ${sinds} and t.status = 'open' and t.account_id is not null and coalesce((r.data->'gevolg'->>'automatischVoorbereiden')::boolean, false)
      and not exists (select 1 from concepten c where c.task_id = t.id) order by t.due_date limit 10`)
  let n = 0
  for (const t of taken) {
    const r = await bereidVoor(tx, org, { id: t.uid, niveau: t.niveau, data: t.data }, { soort: 'taak', id: t.id }, nu, { automatisch: true }).catch(() => null)
    if (r?.status === 'klaar') n++
  }
  return n
}
