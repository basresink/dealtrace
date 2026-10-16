// De motor op de server (F15, 13.3): laadt regels, accounts en geschiedenis, roept de
// databasevrije motorRun (shared/motor.ts) aan en schrijft taken, inzichten, het
// runverslag en meldingen. Een kapotte instelling laat de run nooit omvallen.
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import starterset from '../../seed/regels-starterset.json'
import { bandScore } from '../../shared/bandKwalificatie'
import { motorRun, type MotorGebruiker, type MotorUitvoer, type StartActiviteit } from '../../shared/motor'
import { fase as zoekFase } from '../../shared/reis'
import type { MotorAccount, Regel, RegelData } from '../../shared/regelPatronen'
import { regiodagenVoor, type Regio } from '../../shared/gebieden'
import { nlMoment } from '../../shared/datum'
import { BELMATRIX_STANDAARD, CAPACITEIT_STANDAARD, klasseCode, leesMatrix, type Klasse } from '../../shared/ritmematrix'
import { leadOnderhoud } from './leads'
import { benaderdDitJaar, leesPlanning, POGING_SOORTEN, potentieVan, vensterVan, verkoopjaar } from '../../shared/planning'
import { schema } from './db'
import { draai as draaiPlanner } from './agents/planner'
import { vulBelblokken } from './bellen'
import { achterstandPerAccount, sluitAf } from './campagnes'
import { verstuurWachtrij } from './overdracht'
import { verwerkTerugmeldingen, vraagStandOp } from './dealdrive'
import { bouwFunnelStand } from './funnel'
import { automatischVoorbereiden } from './briefing'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type RegelRij = typeof schema.activityRules.$inferSelect

export class MotorBezig extends Error {}

export const STARTERSET = starterset as unknown as (Omit<Regel, 'id' | 'actief' | 'scope'> & { code: string })[]

export function regelUitRij(r: RegelRij): Regel {
  return {
    id: r.id, code: r.code, naam: r.naam, categorie: r.categorie, actief: r.actief, motor: r.motor as Regel['motor'], scope: r.scope as Regel['scope'],
    teamId: r.teamId, eigenaarId: r.eigenaarId, reisId: r.reisId, faseId: r.faseId, cadansDagen: r.cadansDagen, prioriteit: r.prioriteit as Regel['prioriteit'],
    versie: r.versie, data: r.data as RegelData,
  }
}

/** De 23 regels van de starterset als rijen voor een organisatie. */
export function startersetRijen(org: string) {
  return STARTERSET.map((r) => ({
    organisationId: org, code: r.code, naam: r.naam, categorie: r.categorie, actief: true, motor: r.motor, scope: 'organisatie' as const,
    cadansDagen: r.cadansDagen, prioriteit: r.prioriteit, data: structuredClone(r.data),
  }))
}

/** "Starterset terugzetten": de regels van de organisatie worden precies de 23 van de starterset. */
export async function zetStartersetTerug(tx: Tx, org: string) {
  // Een regel met dezelfde code houdt zijn id: open taken en inzichten blijven dan aan de regel hangen
  // en de motor ontdubbelt erop (anders kwam elk open inzicht na het terugzetten nog een keer).
  const oud = await tx.select({ id: schema.activityRules.id, code: schema.activityRules.code }).from(schema.activityRules).where(eq(schema.activityRules.scope, 'organisatie'))
  const idVan = new Map(oud.filter((r) => r.code).map((r) => [r.code!, r.id]))
  await tx.delete(schema.activityRules).where(eq(schema.activityRules.scope, 'organisatie'))
  return tx.insert(schema.activityRules).values(startersetRijen(org).map((r) => (idVan.has(r.code) ? { ...r, id: idVan.get(r.code)! } : r))).returning()
}

async function instelling(tx: Tx, key: string): Promise<unknown> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, key))
  return r?.value
}

export interface RunOpties { soort: 'uur' | 'gebeurtenis' | 'handmatig'; door?: string | null; accountIds?: string[]; nu?: Date }

/** Laadt alles wat motorRun nodig heeft (één organisatie, via RLS). */
export async function laadMotorInvoer(tx: Tx, org: string, nu: Date, accountIds?: string[]) {
  const waarschuwingen: string[] = []
  const regels = (await tx.select().from(schema.activityRules)).map(regelUitRij)
  const accountRijen = await tx.select().from(schema.accounts).where(accountIds?.length ? inArray(schema.accounts.id, accountIds) : sql`true`)
  const users = await tx.select().from(schema.users)
  const gebruikers: MotorGebruiker[] = users.map((u) => ({ id: u.id, naam: u.name, rol: u.role, werkplek: (u.werkplek as any) ?? 'binnendienst', niveau: u.niveau, teamId: u.teamId, status: u.status }))
  const perGebruiker = new Map(gebruikers.map((g) => [g.id, g]))
  const klassen = ((await instelling(tx, 'klassen')) as Klasse[] | undefined) ?? []
  const reizen = await tx.select().from(schema.reistemplates)
  const sinds = new Date(nu.getTime() - 7 * 864e5).toISOString()
  const ids = accountRijen.map((a) => a.id)
  const gebeurtenissen = ids.length ? await tx.select().from(schema.reisgeschiedenis).where(and(gte(schema.reisgeschiedenis.op, sinds), accountIds?.length ? inArray(schema.reisgeschiedenis.accountId, ids) : sql`true`)) : []
  const ritmeDefs = await tx.select().from(schema.hercontactritmes)
  const contacten = ids.length ? await tx.select({ accountId: schema.contacts.accountId, first: schema.contacts.firstName, last: schema.contacts.lastName, rol: schema.contacts.rol, status: schema.contacts.status, data: schema.contacts.data }).from(schema.contacts).where(accountIds?.length ? inArray(schema.contacts.accountId, ids) : sql`true`) : []

  // Campagnes (P16): achterstand per account uit de ene tempofunctie, voor SR11.
  const campagnes = await achterstandPerAccount(tx, nu)
  // Eerste afspraken (P17): een afgeronde afspraak met vervolg zonder overdracht laat de regel "Afspraak niet overgedragen" vuren.
  const eersteAfs = ids.length ? (await tx.execute(sql`select ap.id, ap.account_id, ap.status, ap.start_at, ap.uitkomst_code, coalesce((ap.data->>'overdragen')::boolean, false) as overdragen,
      exists (select 1 from overdrachten o where o.account_id = ap.account_id and o.status <> 'mislukt') as overgedragen
    from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where m.type = 'klant' and coalesce((m.data->>'eersteAfspraak')::boolean, false)${accountIds?.length ? sql` and ap.account_id in ${ids}` : sql``}`)).rows as any[] : []
  const accounts: MotorAccount[] = accountRijen.map((a) => {
    const k = klassen.find((x) => x.id === a.klasse)
    const reis = reizen.find((r) => r.id === a.reisId)
    const f = reis ? zoekFase(reis.data, a.faseId) : undefined
    const cs = contacten.filter((c) => c.accountId === a.id && c.status !== 'vertrokken')
    const primair = cs.find((c) => c.rol === 'beslisser') ?? cs[0]
    const owner = a.ownerId ? perGebruiker.get(a.ownerId) : undefined
    return {
      id: a.id, naam: a.name, type: a.accountKind as 'prospect' | 'klant', nbStatus: a.nbStatus, reisId: a.reisId, faseId: a.faseId, faseSinds: a.faseSinds,
      verwachtVerblijfDagen: f?.eind ? null : f?.verwachtVerblijfDagen ?? null, doelgroepId: a.doelgroepId, campagneIds: (campagnes.get(a.id) ?? []).map((c) => c.id), campagnes: campagnes.get(a.id) ?? [], klasse: a.klasse,
      afspraken: eersteAfs.filter((x) => x.account_id === a.id).map((x) => ({ id: x.id, eerste: true, status: x.status === 'afgerond' ? 'gehouden' as const : x.status === 'niet_verschenen' ? 'niet-verschenen' as const : x.status === 'geannuleerd' ? 'geannuleerd' as const : 'gepland' as const, op: new Date(x.start_at).toISOString(), overgedragen: !!x.overgedragen, uitkomst: x.overdragen ? null : x.uitkomst_code })),
      klasseCode: k ? klasseCode(k) : null, ownerId: a.ownerId, ownerTeamId: owner?.teamId ?? null, ownerWerkplek: owner?.werkplek ?? null, gebiedId: a.gebiedId,
      aangemaaktOp: a.createdAt, laatsteContactOp: a.laatsteContactOp, terugOp: a.terugOp, dossierOp: (a.data?.dossier as any)?.op ?? null,
      bandScore: bandScore(a.data?.band as any), belMeNiet: !!primair?.data?.belMeNiet, nee: a.data?.nee ?? null, wachtendTot: a.data?.wachtendTot ?? null,
      contactNaam: primair ? `${primair.first ?? ''} ${primair.last}`.trim() : null,
      gebeurtenissen: gebeurtenissen.filter((g) => g.accountId === a.id && g.naarFaseId !== g.vanFaseId).map((g) => ({ id: g.id, gebeurtenis: g.gebeurtenis, naarFaseId: g.naarFaseId, op: g.op })),
      ritme: (() => {
        const st = (a.data as any)?.reis?.ritme
        if (!st) return null
        const def = ritmeDefs.find((r) => r.id === st.ritmeId)
        return { actief: !!st.actief, volgendePogingOp: st.volgendeOp ?? null, poging: st.stap, van: def?.data.stappen.length ?? st.stap, kanaal: st.kanaal ?? null }
      })(),
      signalen: ((a.data?.signalen as any[]) ?? []).map((s, i) => ({ id: s.id ?? `${a.id}-s${i}`, soort: s.soort, op: s.op, extern: s.extern !== false })),
    }
  })

  // Jaarplanning (F13, SR07): venster per potentie en "benaderd" in het lopende verkoopjaar.
  const planInst = leesPlanning(await instelling(tx, 'prospectplanning'), ((await instelling(tx, 'organisatie')) as any)?.verkoopjaarStartmaand)
  const jaar = verkoopjaar(nu, planInst.startmaand)
  const pogingen = ids.length ? (await tx.execute(sql`select account_id, soort, uitkomst, op from activiteiten where op >= ${jaar.start} and soort in ${[...POGING_SOORTEN]}${accountIds?.length ? sql` and account_id in ${ids}` : sql``}`)).rows as { account_id: string; soort: string; uitkomst: string | null; op: string | Date }[] : []
  const pogingPer = new Map<string, { soort: string; uitkomst: string | null; op: string }[]>()
  for (const r of pogingen) (pogingPer.get(r.account_id) ?? pogingPer.set(r.account_id, []).get(r.account_id)!).push({ soort: r.soort, uitkomst: r.uitkomst, op: new Date(r.op).toISOString() })
  for (const a of accounts) {
    if (a.type !== 'prospect') continue
    const rij = accountRijen.find((x) => x.id === a.id)!
    const p = potentieVan({ klasse: rij.klasse, score: rij.score, cf: (rij.data as any)?.customFields }, planInst, klassen)
    if (p) a.jaarplanning = { vensterEind: vensterVan(p, jaar.start, planInst.vensters).tot, benaderdDitJaar: benaderdDitJaar(pogingPer.get(a.id) ?? [], jaar).benaderd }
  }

  // Geschiedenis voor cadans en ontdubbelen: laatste keer per regel en onderwerp, en wat nog open staat.
  const hist = (await tx.execute(sql`
    select rule_id, onderwerp, max(created_at) as laatst, bool_or(status in ('open', 'bezig')) as open from tasks where rule_id is not null group by rule_id, onderwerp
    union all
    select coalesce(rule_id, 'ruis'), onderwerp, max(created_at), bool_or(status in ('nieuw', 'gelezen')) from signals where onderwerp is not null group by rule_id, onderwerp`)).rows as { rule_id: string; onderwerp: string; laatst: string | Date; open: boolean }[]
  const laatst = new Map<string, string>()
  const open = new Set<string>()
  for (const h of hist) {
    const k = h.rule_id === 'ruis' ? h.onderwerp : `${h.rule_id}|${h.onderwerp}`
    const t = new Date(h.laatst).toISOString()
    if (!laatst.has(k) || laatst.get(k)! < t) laatst.set(k, t)
    if (h.open) open.add(k)
  }
  const bezettingRijen = (await tx.execute(sql`select owner_id, to_char(due_date at time zone 'Europe/Amsterdam', 'YYYY-MM-DD') as dag, count(*)::int as n
    from tasks where status in ('open', 'bezig') and action_type in ('bellen', 'bezoek') and due_date is not null group by 1, 2`)).rows as { owner_id: string; dag: string; n: number }[]
  const bezetting = new Map(bezettingRijen.map((b) => [`${b.owner_id}|${b.dag}`, b.n]))
  const ritmeRijen = (await tx.execute(sql`select account_id, rule_id from tasks where status in ('open', 'bezig') and data->>'herkomst' = 'ritme'`)).rows as { account_id: string; rule_id: string }[]
  const ritmeVan = new Map(ritmeRijen.map((r) => [r.account_id, r.rule_id]))
  for (const a of accountRijen) if ((a.data as any)?.reis?.ritme?.actief) ritmeVan.set(a.id, 'hercontact')

  const start = new Map<string, StartActiviteit[]>()
  for (const t of await tx.select().from(schema.activiteitstemplates)) {
    const k = `${t.reistemplateId}|${t.faseId}`
    ;(start.get(k) ?? start.set(k, []).get(k)!).push(t.data as StartActiviteit)
  }

  const log30 = new Date(nu.getTime() - 30 * 864e5).toISOString()
  const logRijen = (await tx.execute(sql`
    select rule_id, case when status in ('nieuw', 'gelezen') and created_at < ${new Date(nu.getTime() - 7 * 864e5).toISOString()} then 'genegeerd' else status end as status, created_at as op
      from signals where rule_id is not null and created_at >= ${log30}
    union all select rule_id, status, created_at from tasks where rule_id is not null and rule_id <> 'start' and created_at >= ${log30}`)).rows as { rule_id: string; status: string; op: string | Date }[]
  const regelLog = new Map<string, { status: string; op: string }[]>()
  for (const l of logRijen) (regelLog.get(l.rule_id) ?? regelLog.set(l.rule_id, []).get(l.rule_id)!).push({ status: l.status, op: new Date(l.op).toISOString() })

  const bel = leesMatrix(await instelling(tx, 'belmatrix'), BELMATRIX_STANDAARD)
  waarschuwingen.push(...bel.waarschuwingen)
  const capWaarde = (await instelling(tx, 'capaciteit')) as any
  const capaciteit = capWaarde && Number.isInteger(capWaarde.binnendienst) && Number.isInteger(capWaarde.buitendienst) ? capWaarde : CAPACITEIT_STANDAARD
  if (capWaarde && capaciteit === CAPACITEIT_STANDAARD) waarschuwingen.push('Capaciteit ongeldig; de standaard geldt')
  const werkdagen = ((await instelling(tx, 'werkdagen')) as any) ?? {}
  const [org_] = await tx.select({ pakket: schema.organisations.pakket }).from(schema.organisations).where(eq(schema.organisations.id, org))

  return {
    invoer: {
      nu, regels, accounts, gebruikers, laatst, open, bezetting, ritmeVan, belmatrix: bel.matrix, capaciteit, werkdagen, startactiviteiten: start, regelLog,
      regiodagen: regiodagenVoor(((await instelling(tx, 'gebieden')) as Regio[] | undefined) ?? [], nlMoment(nu).datum, 28, (werkdagen?.feestdagen as string[] | undefined) ?? []),
      beheerderId: gebruikers.find((g) => g.rol === 'beheerder' && g.status !== 'gearchiveerd')?.id ?? null,
      accountIds, aiToegestaan: org_?.pakket === 'plus' || org_?.pakket === 'compleet',
    },
    waarschuwingen,
  }
}

/** Schrijft de uitkomst van motorRun weg. */
export async function schrijfMotorUitvoer(tx: Tx, org: string, u: MotorUitvoer, nu: Date) {
  const tijd = nu.toISOString()
  const taken = u.taken.map((t) => ({
    organisationId: org, ownerId: t.ownerId, accountId: t.accountId, ruleId: t.regelId, onderwerp: t.onderwerp, actionType: t.actionType, title: t.title,
    priority: t.priority, dueDate: t.due, executor: 'mens', data: { waarom: t.waarom, bewijs: t.bewijs, herkomst: { bron: t.herkomst, regelId: t.regelId, actiesoort: t.actionType, uitvoerder: t.ownerId }, geschoven: t.geschoven || undefined, ...(t.poging ? { poging: { n: t.poging.n, van: t.poging.van, kanaal: t.poging.kanaal ?? undefined } } : {}) }, createdAt: tijd, updatedAt: tijd,
  }))
  for (let i = 0; i < taken.length; i += 500) await tx.insert(schema.tasks).values(taken.slice(i, i + 500))
  const inzichten = u.inzichten.map((s) => ({
    organisationId: org, ownerId: s.ownerId, accountId: s.accountId, ruleId: s.regelId, onderwerp: s.onderwerp, type: s.type, title: s.title,
    relevanceScore: s.relevantie, bron: s.bron, data: { waarom: s.waarom, bewijs: s.bewijs, voorstel: s.voorstel ?? null }, createdAt: tijd, updatedAt: tijd,
  }))
  for (let i = 0; i < inzichten.length; i += 500) await tx.insert(schema.signals).values(inzichten.slice(i, i + 500))
  // Open inzichten bijwerken zonder terug naar ongelezen.
  for (const up of u.updates) {
    await tx.update(schema.signals).set({ data: sql`${schema.signals.data} || ${JSON.stringify({ waarom: up.waarom, bewijs: up.bewijs })}::jsonb`, updatedAt: tijd })
      .where(and(eq(schema.signals.ruleId, up.regelId), eq(schema.signals.onderwerp, up.onderwerp), inArray(schema.signals.status, ['nieuw', 'gelezen'])))
  }
  for (const g of u.geschoven) {
    await tx.insert(schema.notificaties).values({
      id: crypto.randomUUID(), data: {}, op: tijd, organisationId: org, gebruikerId: g.ownerId, soort: 'systeem', titel: `${g.aantal} ${g.aantal === 1 ? 'taak' : 'taken'} doorgeschoven`,
      tekst: `Je dagplafond was vol; ${g.aantal === 1 ? 'hij staat' : 'ze staan'} op de volgende werkdag.`, link: '/acties',
    })
  }
}

/** Eén motorrun voor de organisatie in de transactie van de aanroeper. 429-achtig als er al een run loopt. */
export async function draaiMotor(tx: Tx, org: string, opties: RunOpties) {
  const nu = opties.nu ?? new Date()
  if (opties.soort !== 'gebeurtenis') {
    const [bezig] = await tx.select({ id: schema.ruleRuns.id }).from(schema.ruleRuns)
      .where(and(isNull(schema.ruleRuns.eindOp), gte(schema.ruleRuns.gestartOp, new Date(nu.getTime() - 5 * 60_000).toISOString()), sql`${schema.ruleRuns.soort} <> 'gebeurtenis'`)).limit(1)
    if (bezig) throw new MotorBezig('Er loopt al een motorrun')
  }
  const [run] = await tx.insert(schema.ruleRuns).values({ organisationId: org, soort: opties.soort, gestartOp: nu.toISOString(), door: opties.door ?? null }).returning()
  let uit: MotorUitvoer
  const fouten: string[] = []
  try {
    // Campagne-afsluiter (P16): eerst, zodat een afgelopen campagne geen achterstand meer geeft.
    const afgesloten = opties.soort !== 'gebeurtenis' ? await sluitAf(tx, nu) : null
    const { invoer, waarschuwingen } = await laadMotorInvoer(tx, org, nu, opties.accountIds)
    uit = motorRun(invoer)
    const afsluiter = uit.stappen.find((s) => s.stap === 'campagne-afsluiter')
    if (afsluiter && afgesloten !== null) Object.assign(afsluiter, { status: 'gedaan', toelichting: `${afgesloten} ${afgesloten === 1 ? 'campagne' : 'campagnes'} afgerond` })
    uit.waarschuwingen.unshift(...waarschuwingen)
    await schrijfMotorUitvoer(tx, org, uit, nu)
    await draaiPlanner(tx, org, uit, nu)
    // Belblokvuller (F07): na elke geplande of handmatige run, niet bij een gebeurtenis.
    if (opties.soort !== 'gebeurtenis') {
      const v = await vulBelblokken(tx, org, nu)
      const stap = uit.stappen.find((s) => s.stap === 'belblokvuller')
      if (stap) Object.assign(stap, { status: 'gedaan', toelichting: `${v.blokken} blokken, ${v.gesprekken} gesprekken` })
      // Leadgenerator (F02): automatische rondes, opruimen en KvK-mutaties.
      await leadOnderhoud(tx, org, nu)
      // Overdracht (P17): de wachtrij naar DealDrive en de afgeleide funnelstand van vandaag.
      await verstuurWachtrij(tx, nu)
      // P23: achtergebleven terugmeldingen van DealDrive en de stand-opvraag als overdracht.verwerkt uitblijft.
      await verwerkTerugmeldingen(tx, org, nu)
      await vraagStandOp(tx, nu)
      await bouwFunnelStand(tx, org, nlMoment(nu).datum)
      // Pitstop (P18): automatisch voorbereiden voor regels die dat vragen, hooguit 10 per run.
      const voorbereid = await automatischVoorbereiden(tx, org, nu.toISOString(), nu)
      const vs = uit.stappen.find((s) => s.stap === 'automatisch voorbereiden')
      if (vs) Object.assign(vs, { status: 'gedaan', toelichting: `${voorbereid} ${voorbereid === 1 ? 'concept' : 'concepten'} klaargezet` })
    }
  } catch (e) {
    fouten.push((e as Error).message)
    throw e
  } finally {
    await tx.update(schema.ruleRuns).set({
      eindOp: new Date().toISOString(), geraakt: uit!?.geraakt ?? 0, taken: uit!?.taken.length ?? 0, inzichten: uit!?.inzichten.length ?? 0,
      geschoven: uit!?.geschoven.reduce((s, g) => s + g.aantal, 0) ?? 0, fouten: [...fouten, ...(uit!?.waarschuwingen ?? [])], stappen: uit!?.stappen ?? [],
    }).where(eq(schema.ruleRuns.id, run!.id))
  }
  return { runId: run!.id, tegengehouden: uit.tegengehouden.length, taken: uit.taken.length, inzichten: uit.inzichten.length, geraakt: uit.geraakt, geschoven: uit.geschoven, stappen: uit.stappen, waarschuwingen: uit.waarschuwingen }
}
