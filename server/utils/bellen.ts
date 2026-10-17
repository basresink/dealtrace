// Belblokken op de server (F07): kandidaten laden met dezelfde rangorde als pagina en
// belmodus, de vuller na elke motorrun, een blok plannen, en de sessie van de belmodus.
// Een taak hangt via tasks.belblok_id aan een blok (gat 35).
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import {
  blokResultaat, uitkomstNaarCode, type KnopSleutel, type TegelSleutel,
  bouwBellijst, planVuller, schatDuur, standaardBlokken, STANDAARD_VOORKEUREN, valideerBlokken, verdeelOverBlok, volgendVastBlok,
  type BelKandidaat, type BelVoorkeuren, type BlokSoort, type VastBlok,
} from '../../shared/belblokken'
import { nlMoment, nlTijdstip } from '../../shared/datum'
import { schema } from './db'
import { verzendMeldingen } from './meldingVerzender'
import { kiesScript, scriptWaarden, bezwarenMetConcurrent, type Belscript, type ProspectScriptData } from '../../shared/belscripts'
import { meldGebeurtenis, verkoopverhaal } from './reis'
import { rondAf } from './taken'
import { BAND_LETTERS, bandGekwalificeerd, type Band } from '../../shared/bandKwalificatie'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export interface Kandidaat extends BelKandidaat { faseId?: string | null; contactRol?: string | null; poging?: { n: number; van: number; kanaal?: string; vorige?: string } | null }

const VROEGE_FASES = new Set([null, 'nieuw', 'onderzocht', 'gekwalificeerd'])
const PRIO = (p: string | null | undefined) => (p === 'hoog' ? 'hoog' : p === 'laag' ? 'laag' : p === 'urgent' ? 'urgent' : 'middel') as BelKandidaat['prioriteit']

/** De vaste blokken en voorkeuren van een gebruiker; zonder eigen blokken de standaard voor zijn werkplek. */
export function blokkenVan(u: { werkplek?: string | null; data?: any }): { blokken: VastBlok[]; voorkeuren: BelVoorkeuren; eigen: boolean } {
  const b = u.data?.belblokken
  const geldig = Array.isArray(b?.blokken) && !valideerBlokken(b.blokken).length
  return {
    blokken: geldig ? b.blokken : standaardBlokken(u.werkplek === 'buitendienst' ? 'buitendienst' : 'binnendienst'),
    voorkeuren: { ...STANDAARD_VOORKEUREN, ...(b?.voorkeuren ?? {}) }, eigen: geldig,
  }
}

/**
 * Alle belkandidaten van een gebruiker: zijn open beltaken en, als aanvulling, zijn prospects
 * in reis zonder beltaak. Bel-me-niet (contact of nummer op de lijst) staat gemarkeerd en valt
 * in bouwBellijst weg (15.2).
 */
export async function laadBelKandidaten(tx: Tx, gebruikerId: string): Promise<Kandidaat[]> {
  const taken = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.ownerId, gebruikerId), eq(schema.tasks.actionType, 'bellen'), inArray(schema.tasks.status, ['open', 'bezig'])))
  const metTaak = new Set(taken.map((t) => t.accountId).filter(Boolean) as string[])
  const accounts = await tx.select({
    id: schema.accounts.id, naam: schema.accounts.name, score: schema.accounts.score, faseId: schema.accounts.faseId, nbStatus: schema.accounts.nbStatus,
    kind: schema.accounts.accountKind, owner: schema.accounts.ownerId, data: schema.accounts.data,
  }).from(schema.accounts).where(and(isNull(schema.accounts.gedeactiveerdOp), or(eq(schema.accounts.ownerId, gebruikerId), metTaak.size ? inArray(schema.accounts.id, [...metTaak]) : sql`false`)))
  const perAccount = new Map(accounts.map((a) => [a.id, a]))
  const ids = accounts.map((a) => a.id)
  const contacten = ids.length ? await tx.select().from(schema.contacts).where(and(inArray(schema.contacts.accountId, ids), ne(schema.contacts.status, 'vertrokken'))) : []
  const lijst = new Set((await tx.select({ t: schema.belMeNiet.telefoonE164 }).from(schema.belMeNiet)).map((x) => x.t))
  const signalen = ids.length ? (await tx.execute(sql`select account_id, count(*)::int as n, max(relevance_score)::int as max from signals where status in ('nieuw', 'gelezen') and account_id in ${ids} group by 1`)).rows as { account_id: string; n: number; max: number }[] : []
  const sig = new Map(signalen.map((s) => [s.account_id, s]))
  const openPer = new Map<string, number>()
  for (const r of (ids.length ? (await tx.execute(sql`select account_id, count(*)::int as n from tasks where status in ('open', 'bezig') and account_id in ${ids} group by 1`)).rows : []) as { account_id: string; n: number }[]) openPer.set(r.account_id, r.n)

  const contactVoor = (accountId: string, contactId?: string | null) => {
    const cs = contacten.filter((c) => c.accountId === accountId)
    return (contactId ? cs.find((c) => c.id === contactId) : undefined) ?? cs.find((c) => c.rol === 'beslisser') ?? cs.find((c) => c.rol === 'champion') ?? cs[0]
  }
  const belMeNiet = (c: (typeof contacten)[number] | undefined) => !!c && (!!c.data?.belMeNiet || [c.data?.mobiel, c.data?.telefoon].some((n) => n && lijst.has(n)))
  const uit: Kandidaat[] = []
  for (const t of taken) {
    const a = t.accountId ? perAccount.get(t.accountId) : undefined
    if (!a) continue
    const c = contactVoor(a.id, t.contactId)
    const p = (t.data as any)?.poging as Kandidaat['poging']
    const koud = p ? p.n <= 1 : VROEGE_FASES.has(a.faseId) && a.nbStatus !== 'wachtend'
    uit.push({
      accountId: a.id, accountNaam: a.naam, contactId: c?.id ?? null, contactNaam: c ? `${c.firstName ?? ''} ${c.lastName}`.trim() : null, contactRol: c?.rol ?? null,
      telefoon: c?.data?.mobiel ?? c?.data?.telefoon ?? (a.data as any)?.telefoon ?? null, taskId: t.id, due: t.dueDate, prioriteit: PRIO(t.priority), score: a.score,
      aanleidingen: sig.get(a.id)?.n ?? 0, openTaken: openPer.get(a.id) ?? 0, heet: (sig.get(a.id)?.max ?? 0) >= 85, herkomst: koud ? 'koud' : 'opvolging',
      reden: p ? `poging ${p.n} van ${p.van}${p.vorige ? ` · vorige: ${p.vorige}` : ''}` : (t.data as any)?.waarom ?? t.title, belMeNiet: belMeNiet(c), belblokId: t.belblokId,
      faseId: a.faseId, poging: p ?? null,
    })
  }
  for (const a of accounts) {
    if (metTaak.has(a.id) || a.owner !== gebruikerId || a.kind !== 'prospect' || !['nieuw', 'in reis'].includes(a.nbStatus) || !VROEGE_FASES.has(a.faseId)) continue
    const c = contactVoor(a.id)
    const aanl = (a.data as any)?.aanleiding
    uit.push({
      accountId: a.id, accountNaam: a.naam, contactId: c?.id ?? null, contactNaam: c ? `${c.firstName ?? ''} ${c.lastName}`.trim() : null, contactRol: c?.rol ?? null,
      telefoon: c?.data?.mobiel ?? c?.data?.telefoon ?? (a.data as any)?.telefoon ?? null, taskId: null, score: a.score, aanleidingen: sig.get(a.id)?.n ?? 0,
      openTaken: openPer.get(a.id) ?? 0, heet: !!aanl?.heet || (sig.get(a.id)?.max ?? 0) >= 85, herkomst: 'koud', reden: aanl?.tekst ? `Aanleiding: ${aanl.tekst}` : 'Nog niet gebeld',
      belMeNiet: belMeNiet(c), faseId: a.faseId,
    })
  }
  return uit
}

/** Een beltaak voor een kandidaat zonder taak (aanvulling), direct aan het blok. */
async function maakBeltaak(tx: Tx, org: string, eigenaar: string, k: Kandidaat, sessieId: string, start: string) {
  const tijd = new Date().toISOString()
  const [t] = await tx.insert(schema.tasks).values({
    organisationId: org, ownerId: eigenaar, accountId: k.accountId, contactId: k.contactId ?? null, actionType: 'bellen', title: `Bellen: ${k.accountNaam}`, priority: 'middel',
    dueDate: start, belblokId: sessieId, executor: 'mens', onderwerp: `${k.accountId}:belblok`, data: { waarom: k.reden, herkomst: { bron: 'belblok', actiesoort: 'bellen', uitvoerder: eigenaar }, belblokId: sessieId }, createdAt: tijd, updatedAt: tijd,
  }).returning({ id: schema.tasks.id })
  return t!.id
}

/** Hangt kandidaten aan een sessie: bestaande taken krijgen belblok_id en de starttijd, de rest een nieuwe beltaak. */
export async function hangAanBlok(tx: Tx, org: string, eigenaar: string, sessieId: string, start: string, kandidaten: Kandidaat[]) {
  const ids: string[] = []
  for (const k of kandidaten) {
    if (k.taskId) {
      await tx.update(schema.tasks).set({ belblokId: sessieId, dueDate: start, data: sql`${schema.tasks.data} || ${JSON.stringify({ belblokId: sessieId })}::jsonb`, updatedAt: new Date().toISOString() }).where(eq(schema.tasks.id, k.taskId))
      ids.push(k.taskId)
    } else ids.push(await maakBeltaak(tx, org, eigenaar, k, sessieId, start))
  }
  return ids
}

/** Zoekt de sessie op dit moment of maakt hem (nooit twee blokken op hetzelfde moment). */
export async function sessieOp(tx: Tx, org: string, gebruikerId: string, start: string, eind: string, data: schema.SessieData, vastBlokId?: string | null) {
  await tx.execute(sql`insert into belblok_sessies (organisation_id, gebruiker_id, vast_blok_id, start_op, eind_op, data) values (${org}, ${gebruikerId}, ${vastBlokId ?? null}, ${start}, ${eind}, ${JSON.stringify(data)}::jsonb)
    on conflict (gebruiker_id, start_op) where status <> 'geannuleerd' do nothing`)
  const [s] = await tx.select().from(schema.belblokSessies).where(and(eq(schema.belblokSessies.gebruikerId, gebruikerId), eq(schema.belblokSessies.startOp, start), ne(schema.belblokSessies.status, 'geannuleerd')))
  return s!
}

/**
 * De vuller (na elke motorrun, alleen werkdagen): vult de blokken met "Vult zichzelf" van
 * vandaag volgens hun soort. Handmatig ingeplande taken blijven; geen leeg blok.
 */
export async function vulBelblokken(tx: Tx, org: string, nu = new Date()) {
  const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
  const gebruikers = await tx.select({ id: schema.users.id, werkplek: schema.users.werkplek, data: schema.users.data, rol: schema.users.role, status: schema.users.status }).from(schema.users)
  const vandaag = nlMoment(nu).datum
  let blokken = 0
  let gesprekken = 0
  for (const u of gebruikers.filter((x) => x.status === 'actief' && x.rol !== 'founder')) {
    const { blokken: vast } = blokkenVan(u)
    if (!vast.some((b) => b.automatisch)) continue
    const sessies = await tx.select().from(schema.belblokSessies).where(and(eq(schema.belblokSessies.gebruikerId, u.id), sql`${schema.belblokSessies.startOp} >= ${nlTijdstip(vandaag, 0).toISOString()}`, sql`${schema.belblokSessies.startOp} < ${nlTijdstip(vandaag, 23, 59).toISOString()}`))
    const sessieIds = sessies.map((s) => s.id)
    const inBlok = sessieIds.length ? await tx.select({ accountId: schema.tasks.accountId, belblokId: schema.tasks.belblokId, priority: schema.tasks.priority }).from(schema.tasks).where(inArray(schema.tasks.belblokId, sessieIds)) : []
    const vastVan = new Map(sessies.map((s) => [s.id, s.vastBlokId]))
    const bestaand = inBlok.map((t) => ({ blokId: vastVan.get(t.belblokId!) ?? '', accountId: t.accountId ?? '', duur: schatDuur({ prioriteit: t.priority as any, score: 0 }) }))
    // Wat al aan een ander blok hangt, doet niet mee.
    const kandidaten = (await laadBelKandidaten(tx, u.id)).filter((k) => !k.belblokId).map((k) => ({ ...k, duur: schatDuur(k) }))
    for (const o of planVuller(vast, kandidaten, bestaand, nu, werkdagen)) {
      const b = vast.find((x) => x.id === o.blokId)!
      const s = await sessieOp(tx, org, u.id, o.start, o.eind, { plek: b.plek, soort: b.soort, verhouding: b.verhouding, scriptId: b.scriptId ?? null, gesprekken: [] }, b.id)
      if (s.status !== 'gepland') continue
      await hangAanBlok(tx, org, u.id, s.id, o.start, o.toevoegen)
      blokken++
      gesprekken += o.toevoegen.length
    }
  }
  return { blokken, gesprekken }
}

export interface PlanInvoer { start: string; minuten: number; plek?: string; soort?: BlokSoort; verhouding?: number; scriptId?: string | null; accountIds: string[]; bezet?: boolean; stil?: boolean }

/**
 * Een blok plannen vanuit de bellijst: wat past (gesprekstijd plus marge) gaat erin, de rest
 * schuift naar het eerstvolgende vaste blok of blijft in de bellijst.
 */
export async function planBlok(tx: Tx, org: string, gebruiker: { id: string; werkplek?: string | null; data?: any }, p: PlanInvoer) {
  const alle = await laadBelKandidaten(tx, gebruiker.id)
  const gekozen = bouwBellijst(alle.filter((k) => p.accountIds.includes(k.accountId) && !k.belblokId), new Date(p.start)).sort((a, b) => p.accountIds.indexOf(a.accountId) - p.accountIds.indexOf(b.accountId))
  const start = new Date(p.start)
  const eind = new Date(start.getTime() + p.minuten * 60_000)
  const { blokken } = blokkenVan(gebruiker)
  const volgend = volgendVastBlok(blokken, eind)
  const v = verdeelOverBlok(gekozen, p.minuten, volgend ? { label: volgend.label, start: volgend.start.toISOString() } : null)
  const s = await sessieOp(tx, org, gebruiker.id, start.toISOString(), eind.toISOString(), { plek: p.plek, soort: p.soort ?? 'gemengd', verhouding: p.verhouding, scriptId: p.scriptId ?? null, bezet: !!p.bezet, stil: !!p.stil, handmatig: true, gesprekken: [] })
  if (s.status !== 'gepland') throw createError({ statusCode: 409, statusMessage: 'Op dit moment staat al een blok dat loopt of klaar is' })
  await hangAanBlok(tx, org, gebruiker.id, s.id, start.toISOString(), v.inBlok)
  let naar: string | null = null
  if (volgend && v.geschoven.length) {
    const s2 = await sessieOp(tx, org, gebruiker.id, volgend.start.toISOString(), new Date(volgend.start.getTime() + volgend.blok.minuten * 60_000).toISOString(), { plek: volgend.blok.plek, soort: volgend.blok.soort, verhouding: volgend.blok.verhouding, scriptId: volgend.blok.scriptId ?? null, gesprekken: [] }, volgend.blok.id)
    await hangAanBlok(tx, org, gebruiker.id, s2.id, volgend.start.toISOString(), v.geschoven)
    naar = volgend.label
  }
  return { sessieId: s.id, inBlok: v.inBlok.length, geschoven: v.geschoven.length, inLijst: v.inLijst.length, naar, melding: v.melding, gesprekstijd: v.gesprekstijd, marge: v.marge }
}

/** Tijdens een blok met "Onderdruk meldingen" worden in-app meldingen vastgehouden tot het einde (gat 37). */
export async function zetStil(tx: Tx, gebruikerId: string, stil: { vanaf: string; tot: string } | null) {
  const [u] = await tx.select({ data: schema.users.data }).from(schema.users).where(eq(schema.users.id, gebruikerId))
  const data = { ...(u?.data ?? {}) } as any
  if (stil) data.stil = stil
  else delete data.stil
  await tx.update(schema.users).set({ data }).where(eq(schema.users.id, gebruikerId))
}

// ── Belmodus en belpaneel ──────────────────────────────────────────────────


/**
 * De scripts zoals gebruikers ze zien: altijd een geactiveerde versie, nooit de werkkopie van
 * de editor. Een lopend blok gebruikt de versies waarmee het startte.
 */
export async function laadScripts(tx: Tx, versies?: Record<string, number> | null): Promise<Belscript[]> {
  const rijen = await tx.select().from(schema.belscripts).where(and(eq(schema.belscripts.status, 'actief'), sql`${schema.belscripts.versie} > 0`))
  if (!rijen.length) return []
  const alle = await tx.select().from(schema.belscriptVersies).where(inArray(schema.belscriptVersies.belscriptId, rijen.map((r) => r.id)))
  return rijen.map((r) => {
    const gewenst = versies?.[r.id] ?? r.versie
    const v = alle.find((x) => x.belscriptId === r.id && x.versie === gewenst) ?? alle.find((x) => x.belscriptId === r.id && x.versie === r.versie)
    return { id: r.id, naam: v?.naam ?? r.naam, doel: (v?.doel ?? r.doel) as any, status: 'actief' as const, versie: v?.versie ?? r.versie, eigenaarId: r.eigenaarId, basisScriptId: r.basisScriptId, isPersoonlijk: r.isPersoonlijk, gebruikerId: r.gebruikerId, data: v?.data ?? r.data }
  })
}

/** Per gesprek alles voor de belmodus: kaart, scriptvoorstel, variabelen en bezwaren uit het verhaal. */
export async function belmodusItems(tx: Tx, ctx: { gebruiker: { id: string; naam: string; niveau: string; teamId: string | null }; organisatie: { naam: string } }, kandidaten: Kandidaat[], opties: { scripts: Belscript[]; belblokScriptId?: string | null }) {
  const ids = [...new Set(kandidaten.map((k) => k.accountId))]
  if (!ids.length) return []
  const accounts = await tx.select().from(schema.accounts).where(inArray(schema.accounts.id, ids))
  const contacten = await tx.select().from(schema.contacts).where(inArray(schema.contacts.accountId, ids))
  const activiteiten = (await tx.execute(sql`select account_id, soort, uitkomst, op from (select account_id, soort, uitkomst, op, row_number() over (partition by account_id order by op desc) as rn from activiteiten where account_id in ${ids} and uitkomst is not null) x where rn <= 3`)).rows as { account_id: string; soort: string; uitkomst: string; op: string }[]
  const reizen = await tx.select({ id: schema.reistemplates.id, data: schema.reistemplates.data }).from(schema.reistemplates)
  const vv = await verkoopverhaal(tx)
  const branches = new Map((vv.branches ?? []).map((b) => [b.id, b.naam]))
  const [u] = await tx.select({ data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
  const prospectVersies = await laatsteProspectVersies(tx, ids, ctx.gebruiker.id)
  return kandidaten.map((k) => {
    const a = accounts.find((x) => x.id === k.accountId)!
    const c = contacten.find((x) => x.id === k.contactId)
    const faseNaam = reizen.find((r) => r.id === a.reisId)?.data.fases.find((f: any) => f.id === a.faseId)?.label ?? null
    const doel = k.poging && k.poging.n > 1 ? 'opvolging' : a.nbStatus === 'wachtend' ? 'opvolging' : 'koud'
    const voorstel = kiesScript({ belblokScriptId: opties.belblokScriptId, doel, faseId: a.faseId, contactRol: c?.rol ?? null }, opties.scripts, ctx.gebruiker)
    const w = scriptWaarden({
      gebruiker: { naam: ctx.gebruiker.naam, telefoon: (u?.data as any)?.telefoon ?? null }, organisatie: ctx.organisatie,
      account: { naam: a.name, plaats: a.city, brancheId: a.vvBrancheId, brancheNaam: a.vvBrancheId ? branches.get(a.vvBrancheId) ?? null : null, klasse: a.klasse, huidigeLeverancierId: a.huidigeLeverancierId, faseNaam, faseId: a.faseId },
      contact: c ? { voornaam: c.firstName, achternaam: c.lastName, functie: c.data?.functie ?? null, rol: c.rol } : null,
      aanleiding: (a.data as any)?.aanleiding?.tekst ? { kort: (a.data as any).aanleiding.tekst, bron: (a.data as any).aanleiding.bron ?? null } : null,
      poging: k.poging ? { n: k.poging.n, van: k.poging.van, vorige: k.poging.vorige ?? null } : null, verhaal: vv, eigenVelden: (a.data as any)?.customFields ?? {},
    })
    const script = opties.scripts.find((s) => s.id === voorstel?.scriptId)
    return {
      ...k, kaart: {
        account: { id: a.id, naam: a.name, plaats: a.city, fase: faseNaam, klasse: a.klasse, band: (a.data as any)?.band ?? {}, eigenVelden: (a.data as any)?.customFields ?? {}, aanleiding: (a.data as any)?.aanleiding ?? null },
        contact: c ? { id: c.id, naam: `${c.firstName ?? ''} ${c.lastName}`.trim(), functie: c.data?.functie ?? null, rol: c.rol, telefoon: c.data?.mobiel ?? c.data?.telefoon ?? null } : null,
        laatste: activiteiten.filter((x) => x.account_id === a.id).map((x) => ({ soort: x.soort, uitkomst: x.uitkomst, op: x.op })),
      },
      voorstel, waarden: w.waarden, meldingen: w.meldingen, winpuntId: w.winpuntId, concurrentId: w.concurrentId,
      extraBezwaren: script ? bezwarenMetConcurrent(script, vv, w.concurrentId).filter((z) => z.argumentRef === w.concurrentId && w.concurrentId) : [],
      prospectVersie: prospectVersies.get(a.id) ?? null,
    }
  })
}

export interface ProspectVersieRij { id: string; versie: number; belscriptId: string; scriptVersie: number; data: ProspectScriptData; gebruikerId: string; op: string | null }
/**
 * De nieuwste bewaarde versie per prospect (Belscript Studio); je eigen versie gaat voor die van een
 * collega. Alleen versies waarvan het standaardscript nog bestaat.
 */
export async function laatsteProspectVersies(tx: Tx, accountIds: string[], gebruikerId: string): Promise<Map<string, ProspectVersieRij>> {
  if (!accountIds.length) return new Map()
  const rijen = await tx.select().from(schema.belscriptProspectversies).where(and(inArray(schema.belscriptProspectversies.accountId, accountIds), eq(schema.belscriptProspectversies.status, 'bewaard')))
  const uit = new Map<string, ProspectVersieRij>()
  const score = (r: (typeof rijen)[number]) => (r.gebruikerId === gebruikerId ? 1e6 : 0) + (r.versie ?? 0)
  for (const r of [...rijen].sort((a, b) => score(b) - score(a))) {
    if (uit.has(r.accountId)) continue
    uit.set(r.accountId, { id: r.id, versie: r.versie!, belscriptId: r.belscriptId, scriptVersie: r.scriptVersie, data: r.data, gebruikerId: r.gebruikerId, op: r.bewaardOp })
  }
  return uit
}

// ── Eén gesprek ────────────────────────────────────────────────────────────


export interface GesprekInvoer {
  taskId: string
  knop: KnopSleutel | TegelSleutel
  laterOp?: string | null
  reden?: string | null
  toelichting?: string | null
  duurSec?: number
  notitie?: string | null
  sleutel?: string | null
  script?: {
    scriptId: string; versie: number; gekozenDoor: 'voorstel' | 'gebruiker'; gewisseld?: boolean; blokkenGebruikt?: string[]
    bezwaren?: { id: string; bezwaar: string; argumentRef?: string | null }[]
    vragen?: { blokId: string; vraag?: string; antwoord: string; veld?: { bron: string; sleutel: string } | null }[]
  } | null
  vv?: { winpuntId?: string | null; concurrentId?: string | null } | null
}

export class GesprekFout extends Error { constructor(public statusCode: number, msg: string) { super(msg) } }

/**
 * Eén belgesprek afronden: de knop wordt een code uit 7.3, de taak gaat door hetzelfde
 * afrondpad als de flyout (rondAf), de activiteit bewaart script en versie, antwoorden worden
 * veldwaarden met herkomst belgesprek, een aangeklikt concurrentbezwaar zet de huidige
 * leverancier. Idempotent per taak en sleutel.
 */
export async function verwerkGesprek(tx: Tx, gebruikerId: string, i: GesprekInvoer, sessieId?: string | null, nu = new Date()) {
  const v = uitkomstNaarCode(i.knop)
  if (!v) throw new GesprekFout(422, 'Kies de uitkomst uit het script')
  if (v.vraagtDatum && !i.laterOp) throw new GesprekFout(422, 'Kies een datum')
  if (v.vraagtReden && !i.reden) throw new GesprekFout(422, 'Kies een reden')
  const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, i.taskId))
  if (!t) throw new GesprekFout(404, 'Taak onbekend')
  const sessie = sessieId ? (await tx.select().from(schema.belblokSessies).where(eq(schema.belblokSessies.id, sessieId)))[0] : undefined
  if (sessieId && !sessie) throw new GesprekFout(404, 'Belblok onbekend')
  const al = sessie?.data.gesprekken?.find((g) => g.taskId === i.taskId)
  const r = await rondAf(tx, i.taskId, {
    uitkomst: v.code, laterOp: i.laterOp ?? null, reden: i.reden ?? null, toelichting: i.toelichting ?? null, sleutel: i.sleutel ?? null,
    activiteit: { belknop: i.knop, notitie: i.notitie ?? null, duurSec: i.duurSec ?? null, belblokId: sessieId ?? null, ...(i.script ? { script: { ...i.script, vragenBeantwoord: (i.script.vragen ?? []).map((q) => q.blokId) } } : {}), ...(i.vv ? { vv: i.vv } : {}) },
  }, gebruikerId, nu)
  if (r.alAfgerond || al) return { ...r, gesprekken: sessie?.data.gesprekken?.length ?? 0 }

  if (v.extraTaak && t.accountId) {
    const tijd = nu.toISOString()
    await tx.insert(schema.tasks).values({ organisationId: t.organisationId, ownerId: t.ownerId, accountId: t.accountId, contactId: t.contactId, actionType: v.extraTaak.actionType, title: `${v.extraTaak.title}: ${(await naamVan(tx, t.accountId)) ?? ''}`.trim(), priority: 'middel', dueDate: tijd, data: { waarom: 'Het nummer klopte niet tijdens het bellen.', herkomst: { bron: 'belblok', uitvoerder: t.ownerId } }, createdAt: tijd, updatedAt: tijd })
  }
  if (t.accountId) {
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, t.accountId))
    if (a) {
      const data = { ...(a.data ?? {}) } as any
      let band: Band = { ...(data.band ?? {}) }
      let gewijzigd = false
      for (const q of i.script?.vragen ?? []) {
        if (!q.antwoord?.trim() || !q.veld) continue
        if (q.veld.bron === 'band' && (BAND_LETTERS as readonly string[]).includes(q.veld.sleutel)) { band = { ...band, [q.veld.sleutel]: { ja: true, bron: `belgesprek: ${q.antwoord.slice(0, 160)}`, op: nu.toISOString() } }; gewijzigd = true }
        if (q.veld.bron === 'cf') { data.customFields = { ...(data.customFields ?? {}), [q.veld.sleutel]: q.antwoord }; data.herkomst = { ...(data.herkomst ?? {}), [`cf.${q.veld.sleutel}`]: { bron: 'belgesprek', op: nu.toISOString(), door: gebruikerId } }; gewijzigd = true }
      }
      const concurrent = (i.script?.bezwaren ?? []).map((z) => z.argumentRef).find((x) => x?.startsWith('cc-'))
      if (gewijzigd || (concurrent && concurrent !== a.huidigeLeverancierId)) {
        await tx.update(schema.accounts).set({ data: { ...data, band }, ...(concurrent ? { huidigeLeverancierId: concurrent } : {}), updatedAt: nu.toISOString() }).where(eq(schema.accounts.id, a.id))
        if (bandGekwalificeerd(band) && !bandGekwalificeerd(a.data?.band as Band) && a.nbStatus === 'nieuw' && a.accountKind === 'prospect') {
          await meldGebeurtenis(tx, { accountId: a.id, gebeurtenis: 'gekwalificeerd', door: gebruikerId, reden: 'BAND minimaal 3 van 4 (belgesprek)' }).catch(() => null)
        }
      }
    }
  }
  if (sessie) {
    const gesprekken = [...(sessie.data.gesprekken ?? []), { taskId: i.taskId, accountId: t.accountId ?? '', contactRol: (await rolVan(tx, t.contactId)) ?? null, knop: i.knop, duurSec: Math.max(0, Math.round(i.duurSec ?? 0)), scriptId: i.script?.scriptId ?? null, versie: i.script?.versie ?? null, geschatMin: schatDuur({ prioriteit: t.priority as any, score: 0 }), op: nu.toISOString(), sleutel: i.sleutel ?? null }]
    await tx.update(schema.belblokSessies).set({ data: { ...sessie.data, gesprekken } }).where(eq(schema.belblokSessies.id, sessie.id))
    return { ...r, gesprekken: gesprekken.length }
  }
  return { ...r, gesprekken: 0 }
}
async function naamVan(tx: Tx, accountId: string) { return (await tx.select({ n: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.id, accountId)))[0]?.n }
async function rolVan(tx: Tx, contactId: string | null) { return contactId ? (await tx.select({ r: schema.contacts.rol }).from(schema.contacts).where(eq(schema.contacts.id, contactId)))[0]?.r : null }

/** Stop het blok: resultaat, status klaar, meldingen weer door. */
export async function stopBlok(tx: Tx, sessieId: string, gebruikerId: string, nu = new Date()) {
  const [s] = await tx.select().from(schema.belblokSessies).where(eq(schema.belblokSessies.id, sessieId))
  if (!s) throw new GesprekFout(404, 'Belblok onbekend')
  const resultaat = blokResultaat(s.data.gesprekken ?? [])
  await tx.update(schema.belblokSessies).set({ status: 'klaar', gestoptOp: s.gestoptOp ?? nu.toISOString(), data: { ...s.data, resultaat } }).where(eq(schema.belblokSessies.id, sessieId))
  await zetStil(tx, gebruikerId, null)
  // Wat tijdens het blok bleef liggen, komt nu gebundeld binnen (P26, regel 37).
  if (s.data.stil) await verzendMeldingen(tx, s.organisationId, nu, gebruikerId).catch(() => null)
  const resterend = await tx.select({ id: schema.tasks.id, accountId: schema.tasks.accountId }).from(schema.tasks).where(and(eq(schema.tasks.belblokId, sessieId), inArray(schema.tasks.status, ['open', 'bezig'])))
  return { resultaat, resterend: resterend.length, resterendeAccounts: resterend.map((x) => x.accountId).filter(Boolean) as string[] }
}
