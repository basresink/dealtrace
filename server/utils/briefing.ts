// Briefings, Pitstop en concepten op de server (P18, F11, 11.5, 8.5.7). De briefing is berekend uit de
// context (geen tabel); eigen tekst staat per blok in briefing_teksten; een AI-versie is een concept
// (tabel concepten; het logboek blijft agent_runs). De Pitstop schrijft per actiesoort een concept ter goedkeuring; de agent voert niets uit.
import { sql } from 'drizzle-orm'
import { combineer, kiesBriefingSoort, gewogenBezwaren, pitstopDrieRegels, SOORT_LABEL, vulBriefing, winpuntMetBewijs, type BriefingContext, type BriefingSoort } from '../../shared/briefing'
import { filterNamen } from '../../shared/verkoopverhaal'
import { bouwPrompt, lengteBinnenGrens, mailtoLink, overname, stijlScore, whatsappLink, type SchrijfKanaal } from '../../shared/schrijver'
import { STANDAARD_FASES } from '../../shared/reis'
import type { JsonSchema } from '../../shared/aiStap'
import { logAgentRun, toets } from './agents/bewaker'
import { gebruikDb } from './db'
import { voerAiStapUit } from './llm-provider'
import { verstuurMail } from './mail'
import { teamLeden } from './planning'
import { leesStand } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string, extra: object = {}): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m, data: extra }) }
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const GESPREK = ['gesproken', 'afspraak', 'later', 'nieuw_contact', 'geen_interesse', 'niet_geschikt', 'vervolg']

export type Onderwerp = { soort: 'afspraak' | 'taak' | 'account'; id: string }

/** Alles wat soortbepaling en blokken nodig hebben, voor elke ingang hetzelfde (gat 34). */
async function context(tx: Tx, o: Onderwerp) {
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
  const [a] = await rijen(tx, sql`select a.*, r.data as reis_data from accounts a left join reistemplates r on r.id = a.reis_id where a.id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  const contacten = await rijen(tx, sql`select id, first_name, last_name, rol, data from contacts where account_id = ${accountId} and status <> 'vertrokken' order by rol, last_name`)
  // Een import maakt geen contactmoment: alleen activiteiten met een gespreksuitkomst of een afspraak tellen.
  const acts = await rijen(tx, sql`select ac.uitkomst, ac.soort, ac.op, ac.data->>'tekst' as tekst, c.rol from activiteiten ac left join contacts c on c.id = ac.contact_id where ac.account_id = ${accountId} and ac.soort <> 'import' order by ac.op desc limit 50`)
  const gesprekken = acts.filter((x) => GESPREK.includes(x.uitkomst) || x.soort === 'afspraak').length
  const [sig] = await rijen(tx, sql`select title, bron from signals where account_id = ${accountId} and status in ('nieuw', 'open', 'gelezen') order by relevance_score desc limit 1`)
  const [vervolg] = await rijen(tx, sql`select data->>'vervolgstap' as v, data->'verslag'->>'tekst' as verslag from appointments where account_id = ${accountId} and status = 'afgerond' and coalesce((data->>'overdragen')::boolean, false) order by start_at desc limit 1`)
  const onderwerpSoort = o.soort === 'account' ? null : o.soort
  const eigen = onderwerpSoort ? await rijen(tx, sql`select blok, tekst from briefing_teksten where onderwerp = ${onderwerpSoort} and onderwerp_id = ${o.id}`) : []
  const stand = await leesStand(tx)
  const fase = (a!.reis_data?.fases ?? STANDAARD_FASES).find((f: any) => f.id === a!.fase_id)
  const gebruikt = (await rijen(tx, sql`select concept->>'winpuntId' as w from concepten where account_id = ${accountId} and status <> 'verworpen' and concept->>'winpuntId' is not null`)).map((r) => r.w)
  const brancheNaam = (stand.branches ?? []).find((b: any) => b.id === a!.vv_branche_id)?.naam ?? null
  const [kl] = await rijen(tx, sql`select value from org_settings where key = 'klassen'`)
  const klasse = ((kl?.value ?? []) as any[]).find((k) => k.id === a!.klasse)?.naam ?? null
  const ctx: BriefingContext = {
    account: { naam: a!.name, branche: brancheNaam, plaats: a!.city, klasse, vvBrancheId: a!.vv_branche_id, huidigeLeverancierId: a!.huidige_leverancier_id, adres: a!.data?.adres ?? null, aanleiding: sig ? { tekst: sig.title, bron: sig.bron } : null, dossierFeiten: a!.data?.dossier?.kernfeiten ?? [], band: a!.data?.band ?? {} },
    contacten: contacten.map((c) => ({ naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), functie: c.data?.functie ?? null, rol: c.rol })),
    verslagen: acts.filter((x) => x.tekst).slice(0, 5).map((x) => ({ tekst: x.tekst, op: iso(x.op)! })),
    faseId: a!.fase_id, faseAccent: fase?.accent ?? null,
    afspraak: afspraak ? { soort: afspraak.soort_naam, vorm: afspraak.vorm, start: iso(afspraak.start_at)!, verslag: afspraak.data?.verslag?.tekst ?? vervolg?.verslag ?? null, vervolgstap: afspraak.data?.vervolgstap ?? vervolg?.v ?? null, locatie: afspraak.data?.locatie ?? null } : vervolg ? { soort: 'Eerste afspraak', start: new Date().toISOString(), verslag: vervolg.verslag, vervolgstap: vervolg.v } : null,
    geschiedenis: (await rijen(tx, sql`select naar_fase_id, op from reisgeschiedenis where account_id = ${accountId} and naar_fase_id is not null order by op`)).map((g) => ({ fase: STANDAARD_FASES.find((f) => f.id === g.naar_fase_id)?.label ?? g.naar_fase_id, op: iso(g.op)! })),
    stand, eerderGebruikteWinpunten: gebruikt,
  }
  const soort = kiesBriefingSoort({
    vastgezet: (eigen.find((e) => e.blok === '_soort')?.tekst as BriefingSoort) ?? null,
    meetingsoortVorm: afspraak?.vorm ?? null, eersteAfspraakGehoudenMetVervolg: !!vervolg && a!.nb_status !== 'nee',
    faseId: a!.fase_id, gesprekken, beslisserGesproken: acts.some((x) => x.rol === 'beslisser' && (GESPREK.includes(x.uitkomst) || x.soort === 'afspraak')),
  })
  return { a: a!, afspraak, taak, contacten, ctx, soort, eigen, accountId: accountId!, stand }
}

/** De briefing voor een afspraak, taak of account: soort, blokken met herkomst, drie regels. */
export async function briefing(tx: Tx, o: Onderwerp) {
  const c = await context(tx, o)
  const [ai] = await rijen(tx, sql`select concept from concepten where status in ('klaar', 'goedgekeurd') and concept->>'type' = 'briefing'
    and ${o.soort === 'afspraak' ? sql`appointment_id = ${o.id}` : o.soort === 'taak' ? sql`task_id = ${o.id}` : sql`account_id = ${o.id}`} order by op desc limit 1`)
  const blokken = combineer(vulBriefing(c.soort, c.ctx), ai?.concept?.blokken ?? {}, Object.fromEntries(c.eigen.filter((e) => e.blok !== '_soort').map((e) => [e.blok, e.tekst])))
  const { winpunt } = winpuntMetBewijs(c.ctx)
  return {
    soort: c.soort, soortLabel: SOORT_LABEL[c.soort], vastgezet: c.eigen.some((e) => e.blok === '_soort'),
    account: { id: c.accountId, naam: c.a.name }, wanneer: c.afspraak ? iso(c.afspraak.start_at) : c.taak ? iso(c.taak.due_date) : null,
    blokken, drieRegels: pitstopDrieRegels(blokken), winpuntId: winpunt?.id ?? null,
    uitkomst: (c.afspraak?.data ?? c.taak?.data)?.briefingUitkomst ?? null,
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

const TYPE_VAN: Record<string, 'mail' | 'linkedin' | 'whatsapp' | 'belscript' | 'briefing'> = { mailen: 'mail', linkedin: 'linkedin', bellen: 'belscript', bezoek: 'briefing', taak: 'briefing', bericht: 'whatsapp' }
const SCHEMA: Record<string, JsonSchema> = {
  mail: { type: 'object', required: ['onderwerp', 'tekst'], additionalProperties: false, properties: { onderwerp: { type: 'string', maxLength: 120 }, tekst: { type: 'string', maxLength: 1500 }, winpuntId: { type: 'string' } } },
  linkedin: { type: 'object', required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string', maxLength: 900 }, winpuntId: { type: 'string' } } },
  whatsapp: { type: 'object', required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string', maxLength: 600 }, winpuntId: { type: 'string' } } },
  belscript: { type: 'object', required: ['tekst'], additionalProperties: false, properties: { tekst: { type: 'string', maxLength: 1800 }, winpuntId: { type: 'string' } } },
  briefing: { type: 'object', required: ['blokken'], additionalProperties: false, properties: { blokken: { type: 'object', additionalProperties: false, properties: { opening: { type: 'string', maxLength: 600 }, winpunt: { type: 'string', maxLength: 600 }, doel: { type: 'string', maxLength: 600 } } }, winpuntId: { type: 'string' } } },
}
const KANAAL: Record<string, SchrijfKanaal> = { mail: 'mail', linkedin: 'linkedin', whatsapp: 'whatsapp', belscript: 'belscript', briefing: 'belscript' }

/** "Bereid voor": een concept per actiesoort, binnen de lengtegrens en met stijlscore 7 of hoger (anders één keer opnieuw). */
export async function bereidVoor(tx: Tx, org: string, gebruiker: any, o: { soort: 'afspraak' | 'taak'; id: string }, nu = new Date(), opties: { automatisch?: boolean } = {}) {
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
  const prompt = bouwPrompt({ platform: (pp?.value as any)?.schrijver ?? null, organisatie: c.ctx.faseAccent ? `Fase-accent: ${c.ctx.faseAccent}` : null, instructie: `Schrijf als Schrijver een ${type === 'briefing' ? 'voorbereiding per blok' : type} voor een eerste of volgend contact. Volgorde: waarom (de aanleiding), hoe (precies één winpunt met één bewijs), één vraag. Geen "wat" in de eerste alinea. Je-vorm, geen gedachtestreepjes, geen namen van personen. Fase-accent: ${c.ctx.faseAccent ?? 'geen'}.` }).volledig
  let r = await voerAiStapUit<any>(tx, org, { soort: 'concept', prompt, schema: SCHEMA[type]!, materiaal, gebruiker, boekAls: 'schrijver', accountId: c.accountId, ...agent } as any, nu)
  const tekstVan = (x: any) => (type === 'briefing' ? Object.values(x?.blokken ?? {}).join(' ') : String(x?.tekst ?? ''))
  let stijl = r.ok ? stijlScore(tekstVan(r.antwoord)) : null
  let lengte = r.ok ? lengteBinnenGrens(tekstVan(r.antwoord), KANAAL[type]!) : null
  if (r.ok && (stijl!.score < 7 || !lengte!.binnen)) {
    r = await voerAiStapUit<any>(tx, org, { soort: 'concept', prompt: `${prompt} Korter en concreter. Vermijd: ${stijl!.vermeden.join(', ') || 'jargon'}.`, schema: SCHEMA[type]!, materiaal, gebruiker, boekAls: 'schrijver', accountId: c.accountId, ...agent } as any, nu)
    if (r.ok) { stijl = stijlScore(tekstVan(r.antwoord)); lengte = lengteBinnenGrens(tekstVan(r.antwoord), KANAAL[type]!) }
  }
  const id = crypto.randomUUID()
  const concept = r.ok ? { type, ...r.antwoord, winpuntId: r.antwoord.winpuntId ?? winpunt?.id ?? null, stijlscore: stijl!.score, woorden: lengte!.woorden, grens: lengte!.grens, vvVersies: versies, bronnen: [winpunt ? { soort: 'winpunt', titel: winpunt.titel } : null, c.ctx.account.aanleiding ? { soort: 'aanleiding', titel: c.ctx.account.aanleiding.tekst, bron: c.ctx.account.aanleiding.bron } : null].filter(Boolean), aanleiding: `Pitstop voor ${c.a.name}` } : null
  // Het logboek (agent_runs, alleen toevoegen) en het concept ter goedkeuring.
  await logAgentRun(tx, org, { agent: 'schrijver', handeling: `pitstop:${type}`, mandaat: 'A', uitkomst: r.ok ? 'uitgevoerd' : 'fout', gebruikerId: gebruiker.id, accountId: c.accountId, taskId: o.soort === 'taak' ? o.id : undefined, reden: r.ok ? undefined : r.reden, bronnen: concept?.bronnen ?? [] } as any, nu)
  if (concept) await tx.execute(sql`insert into concepten (id, organisation_id, agent, handeling, gebruiker_id, account_id, task_id, appointment_id, concept, status, op)
    values (${id}, ${org}, 'schrijver', ${`pitstop:${type}`}, ${gebruiker.id}, ${c.accountId}, ${o.soort === 'taak' ? o.id : null}, ${o.soort === 'afspraak' ? o.id : null}, ${JSON.stringify(concept)}::jsonb, 'klaar', ${nu.toISOString()})`)
  return { id, status: r.ok ? 'klaar' : 'mislukt', concept, reden: r.ok ? null : r.reden }
}

// ── Concepten (inbox, 8.5.7) ───────────────────────────────────────────────

export const conceptUit = (r: Rij) => ({
  id: r.id as string, agent: r.agent as string, handeling: r.handeling as string, status: r.status as string, overname: r.overname, op: iso(r.op),
  accountId: r.account_id, accountNaam: r.account_naam ?? null, taskId: r.task_id, afspraakId: r.appointment_id, gebruikerId: r.gebruiker_id, gebruiker: r.gebruiker_naam ?? null, concept: r.concept,
  links: r.concept && r.concept.type !== 'briefing' ? { mailto: r.concept.type === 'mail' ? mailtoLink({ aan: r.email ?? null, onderwerp: r.concept.onderwerp, tekst: r.concept.tekst }) : null, whatsapp: whatsappLink(String(r.concept.tekst ?? ''), r.mobiel ?? null) } : null,
})

/** De inbox: eigen concepten; de salesmanager ook die van zijn teams (8.12). */
export async function concepten(tx: Tx, g: { id: string; rol: string }, f: { status?: string | null; type?: string | null; accountId?: string | null; team?: boolean } = {}) {
  const wie = f.team && ['salesmanager', 'beheerder'].includes(g.rol) ? await teamLeden(tx, g) : [g.id]
  const rows = await rijen(tx, sql`select r.*, a.name as account_naam, u.name as gebruiker_naam, c.email, c.data->>'mobiel' as mobiel from concepten r
      left join accounts a on a.id = r.account_id left join users u on u.id = r.gebruiker_id
      left join lateral (select email, data from contacts where account_id = r.account_id and status <> 'vertrokken' and coalesce(email, '') <> '' order by (rol = 'beslisser') desc limit 1) c on true
    where r.gebruiker_id = any(string_to_array(${wie.join(',')}, ','))
      ${f.status === 'alle' ? sql`` : f.status ? sql`and r.status = ${f.status}` : sql`and r.status in ('klaar', 'goedgekeurd')`}
      ${f.type ? sql`and r.concept->>'type' = ${f.type}` : sql``} ${f.accountId ? sql`and r.account_id = ${f.accountId}` : sql``}
    order by r.op desc limit 100`)
  return rows.map(conceptUit)
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
export async function verstuurConcept(tx: Tx, org: string, door: { id: string; rol: string; niveau: string; data?: any }, id: string, basisUrl: string, nu = new Date()) {
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
  const v = await verstuurMail(tx, org, { aan: c!.email, onderwerp: r!.concept.onderwerp ?? 'Even voorstellen', tekst: r!.concept.tekst }, { eersteMail: !eerder, basisUrl }, nu)
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
