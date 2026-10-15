// Het meldpunt voor gebeurtenissen (F05, P05). Dit is op de server de enige plek
// waar fase, reis en status van een account veranderen; de database weigert
// elke andere update (trigger dealtrace_alleen_via_meldpunt). Rekenregels staan in
// shared/reis.ts en shared/nbStatus.ts.
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import {
  AFKOELING_STANDAARD, GEBEURTENIS_LABEL, afkoelingVoorNee, volgendeStatus,
  type Afkoeling, type Gebeurtenis, type Handeling, type Kanaal, type NeeGegevens,
} from '../../shared/nbStatus'
import {
  fase as zoekFase, instapFase, kiesDoelgroep, kiesReis, volgendeFase,
  type Doelgroep, type DoelgroepAccount, type ReisData,
} from '../../shared/reis'
import { terugkomDatum, type VerkoopverhaalStand } from '../../shared/verkoopverhaal'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { draaiMotor } from './motor'
import { kiesRitme, startRitme, type Ritme, type RitmeStand } from '../../shared/hercontact'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type AccountRij = typeof schema.accounts.$inferSelect
type ReisRij = typeof schema.reistemplates.$inferSelect

export class ReisFout extends Error {
  constructor(public statusCode: number, bericht: string) { super(bericht) }
}

/** Zet het meldpunt aan voor de rest van deze transactie. */
async function meldpuntAan(tx: Tx) {
  await tx.execute(sql`select set_config('dealtrace.meldpunt', 'aan', true)`)
}

export async function verkoopverhaal(tx: Tx): Promise<VerkoopverhaalStand> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'verkoopverhaal'))
  const v = (r?.value ?? {}) as Partial<VerkoopverhaalStand>
  return { ...v, terugkomregels: v.terugkomregels ?? [], redenmapping: v.redenmapping ?? [], concurrenten: v.concurrenten ?? [] }
}

export async function afkoelingInstelling(tx: Tx): Promise<Afkoeling> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'afkoeling'))
  return { ...AFKOELING_STANDAARD, ...((r?.value ?? {}) as Partial<Afkoeling>) }
}

export function alsDoelgroepAccount(a: Pick<AccountRij, 'klasse' | 'postcode' | 'gebiedId' | 'nbBron' | 'vvBrancheId' | 'data'>): DoelgroepAccount {
  const cf = (a.data?.customFields ?? {}) as Record<string, unknown>
  const m = a.data?.medewerkers ?? (cf.aantal_monteurs != null ? Number(cf.aantal_monteurs) : null)
  return {
    sbi: a.data?.sbi ?? [], vvBrancheId: a.vvBrancheId, klasse: a.klasse, medewerkers: Number.isFinite(m as number) ? (m as number) : null,
    postcode: a.postcode, gebiedId: a.gebiedId, bron: a.nbBron, segment: (cf.segment as string) ?? null, tags: (a.data?.tags as string[]) ?? [], cf,
  }
}

// ---------------------------------------------------------------------------
// Instap bij binnenkomst (import, leadgenerator, handmatig aanmaken)
// ---------------------------------------------------------------------------

export interface InstapContext {
  doelgroepen: Doelgroep[]
  reizen: ReisRij[]
}

export async function laadInstapContext(tx: Tx): Promise<InstapContext> {
  const doelgroepen = (await tx.select().from(schema.doelgroepen).where(eq(schema.doelgroepen.status, 'actief')))
    .map((d) => ({ id: d.id, naam: d.naam, status: d.status as Doelgroep['status'], prioriteit: d.prioriteit, data: d.data ?? {} }))
  const reizen = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.status, 'actief'))
  return { doelgroepen, reizen }
}

/** Reis, fase en doelgroep voor een nieuw account; de velden gaan mee in de insert. */
export function instapVelden(ctx: InstapContext, account: DoelgroepAccount, gebeurtenis: Gebeurtenis = 'import') {
  const reisId = kiesReis(account, ctx.doelgroepen, ctx.reizen.map((r) => ({ id: r.id, doelgroepId: r.doelgroepId, isStandaard: r.isStandaard, status: r.status })))
  const reis = ctx.reizen.find((r) => r.id === reisId)
  if (!reis) throw new ReisFout(500, 'Deze organisatie heeft nog geen standaardreis. Vul de startset aan.')
  const faseId = instapFase(reis.data, gebeurtenis)
  return { reisId: reis.id, faseId, versie: reis.versie, doelgroepId: kiesDoelgroep(account, ctx.doelgroepen) }
}

/** Inschrijving en reisgeschiedenis voor nieuw aangemaakte accounts (in bulk). */
export async function schrijfInstap(tx: Tx, organisatieId: string, rijen: { accountId: string; reisId: string; faseId: string | null; versie: number }[], gebeurtenis: Gebeurtenis, door: string) {
  const nu = new Date().toISOString()
  const reizen = rijen.filter((r) => r.faseId).map((r) => ({
    id: crypto.randomUUID(), organisationId: organisatieId, reistemplateId: r.reisId, templateVersie: r.versie, accountId: r.accountId,
    faseId: r.faseId!, nbStatus: 'nieuw', faseSinds: nu, gestartOp: nu,
  }))
  for (let i = 0; i < reizen.length; i += 500) await tx.insert(schema.prospectreizen).values(reizen.slice(i, i + 500))
  const regels = reizen.map((p) => ({
    organisationId: organisatieId, accountId: p.accountId, prospectreisId: p.id, versie: p.templateVersie, vanFaseId: null, naarFaseId: p.faseId,
    vanStatus: null, naarStatus: 'nieuw', gebeurtenis, door, op: nu, reden: null,
  }))
  for (let i = 0; i < regels.length; i += 500) await tx.insert(schema.reisgeschiedenis).values(regels.slice(i, i + 500))
}

// ---------------------------------------------------------------------------
// Wissel: fase en status samen, met inschrijving, geschiedenis, log en audit
// ---------------------------------------------------------------------------

interface Wissel {
  naarFaseId: string | null
  naarStatus: string
  gebeurtenis: Gebeurtenis
  reden?: string | null
  door: string
  data?: Partial<AccountRij['data']>
  terugOp?: string | null
  terugRegelId?: string | null
  reisId?: string
  nu: Date
}

async function laadReis(tx: Tx, reisId: string | null): Promise<ReisRij | undefined> {
  if (reisId) {
    const [r] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, reisId))
    if (r) return r
  }
  const [s] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.isStandaard, true))
  return s
}

async function voerWisselUit(tx: Tx, a: AccountRij, reis: ReisRij, w: Wissel) {
  const nu = w.nu.toISOString()
  const vanFase = a.reisId === reis.id ? a.faseId : null
  const faseGewisseld = !!w.naarFaseId && w.naarFaseId !== a.faseId
  const naarFase = w.naarFaseId ?? a.faseId
  await meldpuntAan(tx)
  const set: Partial<typeof schema.accounts.$inferInsert> = {
    reisId: reis.id, faseId: naarFase, nbStatus: w.naarStatus, updatedAt: nu,
    ...(faseGewisseld ? { faseSinds: nu } : {}),
    ...(w.data ? { data: { ...(a.data ?? {}), ...w.data } } : {}),
    ...(w.terugOp !== undefined ? { terugOp: w.terugOp, terugRegelId: w.terugRegelId ?? null } : {}),
  }
  await tx.update(schema.accounts).set(set).where(eq(schema.accounts.id, a.id))

  // Inschrijving: één actieve per account; een eindfase rondt hem af en
  // heropvolging daarna start een nieuwe (geen overschrijving).
  const eind = zoekFase(reis.data, naarFase)?.eind
  let [pr] = await tx.select().from(schema.prospectreizen).where(and(eq(schema.prospectreizen.accountId, a.id), isNull(schema.prospectreizen.afgerondOp)))
  if (pr && pr.reistemplateId !== reis.id) {
    await tx.update(schema.prospectreizen).set({ afgerondOp: nu, data: { ...pr.data, verplaatst: true } }).where(eq(schema.prospectreizen.id, pr.id))
    pr = undefined
  }
  if (!pr) {
    ;[pr] = await tx.insert(schema.prospectreizen).values({
      organisationId: a.organisationId, reistemplateId: reis.id, templateVersie: reis.versie, accountId: a.id, faseId: naarFase ?? '',
      nbStatus: w.naarStatus, faseSinds: nu, gestartOp: nu, afgerondOp: eind ? nu : null,
    }).returning()
  } else {
    await tx.update(schema.prospectreizen).set({
      faseId: naarFase ?? pr.faseId, nbStatus: w.naarStatus, ...(faseGewisseld ? { faseSinds: nu } : {}), ...(eind ? { afgerondOp: nu } : {}),
    }).where(eq(schema.prospectreizen.id, pr.id))
  }
  await tx.insert(schema.reisgeschiedenis).values({
    organisationId: a.organisationId, accountId: a.id, prospectreisId: pr!.id, versie: reis.versie, vanFaseId: vanFase, naarFaseId: naarFase,
    vanStatus: a.nbStatus, naarStatus: w.naarStatus, gebeurtenis: w.gebeurtenis, door: w.door, op: nu, reden: w.reden ?? null,
  })
  await tx.insert(schema.activiteiten).values({
    organisationId: a.organisationId, accountId: a.id, soort: 'reis', door: w.door === 'motor' ? null : w.door, uitvoerder: 'mens', op: nu,
    data: { gebeurtenis: w.gebeurtenis, van: vanFase, naar: naarFase, status: w.naarStatus, reden: w.reden ?? null, tekst: `${GEBEURTENIS_LABEL[w.gebeurtenis]}: ${zoekFase(reis.data, naarFase)?.label ?? naarFase}` },
  })
  await schrijfAudit(tx, {
    organisationId: a.organisationId, actorId: w.door, action: 'reis.gebeurtenis', resourceType: 'accounts', resourceId: a.id,
    changes: { gebeurtenis: w.gebeurtenis, fase: { van: a.faseId, naar: naarFase }, status: { van: a.nbStatus, naar: w.naarStatus }, reden: w.reden ?? null },
  })
}

async function laadAccount(tx: Tx, accountId: string): Promise<AccountRij> {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) throw new ReisFout(404, 'Account onbekend')
  if (a.accountKind === 'klant') throw new ReisFout(422, 'Een klant loopt geen prospectreis; het vervolg loopt in DealDrive of je CRM')
  return a
}

export interface Melding {
  accountId: string
  gebeurtenis: Gebeurtenis
  reden?: string | null
  door: string
  /** Alleen bij `handmatig` (Fase corrigeren). */
  naarFaseId?: string
  context?: { rol?: string | null; kanaal?: string | null }
  nu?: Date
  /** Geen motorrun erna (bij een bulkverwerking die zelf de motor draait). */
  zonderMotor?: boolean
}

/**
 * Meld een gebeurtenis: volgendeFase, volgendeStatus, inschrijving, reisgeschiedenis,
 * activiteit en audit in de transactie van de aanroeper. Idempotent: zonder wissel
 * alleen een regel in activiteiten. De motor (P06) haakt hier later aan.
 */
export async function meldGebeurtenis(tx: Tx, m: Melding): Promise<{ fase: string | null; status: string; gewisseld: boolean }> {
  const nu = m.nu ?? new Date()
  const a = await laadAccount(tx, m.accountId)
  const reis = await laadReis(tx, a.reisId)
  if (!reis) throw new ReisFout(500, 'Deze organisatie heeft nog geen standaardreis. Vul de startset aan.')
  const huidigeFase = a.reisId === reis.id ? a.faseId : null

  let naar: string | null
  if (m.gebeurtenis === 'handmatig') {
    if (!m.reden?.trim()) throw new ReisFout(422, 'Geef een reden bij Fase corrigeren')
    if (!m.naarFaseId || !zoekFase(reis.data, m.naarFaseId)) throw new ReisFout(422, 'Kies een fase uit deze reis')
    naar = m.naarFaseId === huidigeFase ? null : m.naarFaseId
  } else {
    naar = volgendeFase(reis.data, huidigeFase, m.gebeurtenis, { klasse: a.klasse, ...m.context })
  }

  // Gat 3: alleen de eerste melding van een eerste afspraak telt, binnen deze inschrijving.
  let alGemeld = false
  if (m.gebeurtenis === 'eerste-afspraak-gepland') {
    const [pr] = await tx.select({ id: schema.prospectreizen.id }).from(schema.prospectreizen).where(and(eq(schema.prospectreizen.accountId, a.id), isNull(schema.prospectreizen.afgerondOp)))
    if (pr) {
      const [eerder] = await tx.select({ id: schema.reisgeschiedenis.id }).from(schema.reisgeschiedenis)
        .where(and(eq(schema.reisgeschiedenis.prospectreisId, pr.id), eq(schema.reisgeschiedenis.gebeurtenis, 'eerste-afspraak-gepland'))).limit(1)
      alGemeld = !!eerder
    }
  }
  const doelFase = zoekFase(reis.data, naar ?? huidigeFase)
  const status = alGemeld ? a.nbStatus : volgendeStatus(a.nbStatus, m.gebeurtenis, { naarHoofdfase: doelFase?.hoofdfase, naarEind: doelFase?.eind ?? null })
  if (alGemeld) naar = null
  const gewisseld = (naar !== null) || status !== a.nbStatus

  if (!gewisseld) {
    await tx.insert(schema.activiteiten).values({
      organisationId: a.organisationId, accountId: a.id, soort: 'reis', door: m.door === 'motor' ? null : m.door, op: nu.toISOString(),
      data: { gebeurtenis: m.gebeurtenis, gewisseld: false, reden: m.reden ?? null, tekst: `${GEBEURTENIS_LABEL[m.gebeurtenis]} (geen wissel)` },
    })
    return { fase: huidigeFase, status: a.nbStatus, gewisseld: false }
  }

  const data: Partial<AccountRij['data']> = {}
  let terugOp: string | null | undefined
  if (m.gebeurtenis === 'heropvolging') {
    // Terug in de reis: de terugkomregel is afgehandeld; de nee blijft in de historie.
    Object.assign(data, { terugkom: null, wachtendTot: null, pauzeReden: null, vorigeNee: a.data?.nee ?? a.data?.vorigeNee ?? null, nee: null })
    terugOp = null
  }
  await voerWisselUit(tx, a, reis, {
    naarFaseId: naar, naarStatus: status, gebeurtenis: m.gebeurtenis, reden: m.reden ?? null, door: m.door, nu,
    data: Object.keys(data).length ? data : undefined, terugOp, terugRegelId: null,
  })
  // Hercontactritme (P07): Gekwalificeerd start het ritme; heropvolging start winback.
  if (naar === 'gekwalificeerd') await startRitmeVoorAccount(tx, a.id, { winback: m.gebeurtenis === 'heropvolging', nu })
  // Direct na de gebeurtenis: gebeurtenisregels en startactiviteiten voor dit ene account (motor, P06).
  if (!m.zonderMotor) await draaiMotor(tx, a.organisationId, { soort: 'gebeurtenis', door: m.door, accountIds: [a.id], nu })
  return { fase: naar ?? huidigeFase, status, gewisseld: true }
}

// ---------------------------------------------------------------------------
// Handelingen op de kaart: Zet nee, Pauzeer tot, Verplaats naar reis, Terug op
// ---------------------------------------------------------------------------

export interface NeeInvoer {
  reden: string
  toelichting?: string
  verlorenAan?: string | null
  terugOp?: string | null
  afkoeling?: Partial<Afkoeling>
}

const DAG = 864e5
const dagNa = (nu: Date, d: number) => new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()) + d * DAG).toISOString().slice(0, 10)

/** Zet nee: reden, afkoelperiode per kanaal en een terugkomdatum (nooit binnen de afkoelperiode). */
export async function zetNee(tx: Tx, accountId: string, invoer: NeeInvoer, door: string, nu = new Date()) {
  const a = await laadAccount(tx, accountId)
  const reis = await laadReis(tx, a.reisId)
  if (!reis) throw new ReisFout(500, 'Geen standaardreis')
  const instelling = await afkoelingInstelling(tx)
  const afkoeling: Afkoeling = { ...afkoelingVoorNee(invoer.reden, instelling), ...(invoer.reden === 'Niet geschikt' ? {} : schoonAfkoeling(invoer.afkoeling)) }
  const vv = await verkoopverhaal(tx)
  const voorstel = terugkomDatum(invoer.reden, vv, nu, afkoeling, 'nee')
  // De afkoelperiode van het kanaal uit de regel is de ondergrens, ook voor een eigen datum.
  const ondergrens = dagNa(nu, invoer.reden === 'Niet geschikt' ? 365 : afkoeling[voorstel.kanaal])
  let datum = invoer.terugOp && /^\d{4}-\d{2}-\d{2}$/.test(invoer.terugOp) ? invoer.terugOp : voorstel.datum
  if (datum < ondergrens) datum = ondergrens
  const nee: NeeGegevens = {
    reden: invoer.reden, ...(invoer.toelichting ? { toelichting: invoer.toelichting.slice(0, 1000) } : {}),
    ...(invoer.verlorenAan ? { verlorenAan: invoer.verlorenAan } : {}), op: nu.toISOString(), door, afkoeling,
  }
  const huidige = zoekFase(reis.data, a.reisId === reis.id ? a.faseId : null)
  // Na een gehouden eerste afspraak is het de gebeurtenis geen-vervolg; anders gaat het
  // account met een correctie naar de eindfase verloren.
  const viaGeenVervolg = huidige && volgendeFase(reis.data, huidige.id, 'geen-vervolg')
  const verloren = reis.data.fases.find((f) => f.eind === 'verloren')
  const naarFase = viaGeenVervolg ?? (huidige?.eind ? null : verloren?.id ?? null)
  const status = volgendeStatus(a.nbStatus, 'nee')
  if (status !== 'nee') throw new ReisFout(422, `Een account met status ${a.nbStatus} kan niet op nee`)
  const regel = voorstel.regel
  await voerWisselUit(tx, a, reis, {
    naarFaseId: naarFase && naarFase !== a.faseId ? naarFase : null, naarStatus: 'nee', gebeurtenis: viaGeenVervolg ? 'geen-vervolg' : 'handmatig',
    reden: `Nee: ${invoer.reden}${invoer.toelichting ? ` (${invoer.toelichting})` : ''}`, door, nu,
    data: { nee, wachtendTot: null, reis: { ...((a.data as any)?.reis ?? {}), ...((a.data as any)?.reis?.ritme ? { ritme: { ...(a.data as any).reis.ritme, actief: false } } : {}) }, terugkom: { datum, regelId: regel?.id ?? null, reden: regel?.reden ?? invoer.reden, aanpak: regel?.aanpak ?? null, kanaal: regel ? voorstel.kanaal : null } },
    terugOp: datum, terugRegelId: regel?.id ?? null,
  })
  if (invoer.verlorenAan) {
    await meldpuntAan(tx)
    await tx.update(schema.accounts).set({ huidigeLeverancierId: invoer.verlorenAan }).where(eq(schema.accounts.id, a.id))
  }
  return { status: 'nee', terugOp: datum, regel, afkoeling }
}

function schoonAfkoeling(a: Partial<Afkoeling> | undefined): Partial<Afkoeling> {
  const uit: Partial<Afkoeling> = {}
  for (const [k, v] of Object.entries(a ?? {})) {
    const n = Number(v)
    if (Number.isInteger(n) && n >= 0 && n <= 730) uit[k as Kanaal] = n
  }
  return uit
}

/** Pauzeer tot een datum: status wachtend, de fase blijft staan. */
export async function pauzeer(tx: Tx, accountId: string, tot: string, reden: string | null, door: string, nu = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tot) || tot <= nu.toISOString().slice(0, 10)) throw new ReisFout(422, 'Kies een datum na vandaag')
  const a = await laadAccount(tx, accountId)
  const reis = await laadReis(tx, a.reisId)
  if (!reis) throw new ReisFout(500, 'Geen standaardreis')
  const status = volgendeStatus(a.nbStatus, 'pauzeer' as Handeling)
  if (status !== 'wachtend') throw new ReisFout(422, `Een account met status ${a.nbStatus} kun je niet pauzeren`)
  await voerWisselUit(tx, a, reis, {
    naarFaseId: null, naarStatus: 'wachtend', gebeurtenis: 'handmatig', reden: `Gepauzeerd tot ${tot}${reden ? `: ${reden}` : ''}`, door, nu,
    data: { wachtendTot: tot, pauzeReden: reden, terugkom: { datum: tot, reden: reden ?? 'Gepauzeerd' } }, terugOp: tot,
  })
  return { status: 'wachtend', terugOp: tot }
}

/** Verplaats naar een andere reis: de oude inschrijving wordt afgerond, de fase volgt de nieuwe reis. */
export async function verplaatsNaarReis(tx: Tx, accountId: string, reisId: string, reden: string, door: string, nu = new Date()) {
  if (!reden?.trim()) throw new ReisFout(422, 'Geef een reden')
  const a = await laadAccount(tx, accountId)
  const [reis] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, reisId))
  if (!reis || reis.status !== 'actief') throw new ReisFout(422, 'Kies een actieve reis')
  if (reis.id === a.reisId) throw new ReisFout(422, 'Het account zit al in deze reis')
  // Dezelfde fase als die bestaat, anders de instapfase van de nieuwe reis.
  const fase = zoekFase(reis.data, a.faseId)?.id ?? instapFase(reis.data)
  await voerWisselUit(tx, a, reis, { naarFaseId: fase, naarStatus: a.nbStatus, gebeurtenis: 'handmatig', reden: `Verplaatst naar ${reis.naam}: ${reden}`, door, nu, reisId: reis.id })
  return { reisId: reis.id, faseId: fase }
}

/** Terugkomdatum aanpassen met reden (Gevorderd). Raakt fase en status niet. */
export async function zetTerugOp(tx: Tx, accountId: string, datum: string, reden: string, door: string, nu = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum <= nu.toISOString().slice(0, 10)) throw new ReisFout(422, 'Kies een datum na vandaag')
  if (!reden?.trim()) throw new ReisFout(422, 'Geef een reden')
  const a = await laadAccount(tx, accountId)
  if (!['nee', 'wachtend'].includes(a.nbStatus)) throw new ReisFout(422, 'Alleen een account op nee of wachtend heeft een terugkomdatum')
  // Niet binnen de afkoelperiode van het kanaal uit de regel.
  const kanaal = (a.data?.terugkom?.kanaal ?? 'bellen') as Kanaal
  const dagen = a.data?.nee?.afkoeling?.[kanaal]
  if (a.nbStatus === 'nee' && a.data?.nee && dagen != null) {
    const ondergrens = dagNa(new Date(a.data.nee.op), dagen)
    if (datum < ondergrens) throw new ReisFout(422, `De afkoelperiode loopt tot ${ondergrens}`)
  }
  await tx.update(schema.accounts).set({
    terugOp: datum, updatedAt: nu.toISOString(),
    data: { ...(a.data ?? {}), terugkom: { ...(a.data?.terugkom ?? { reden: null }), datum }, ...(a.nbStatus === 'wachtend' ? { wachtendTot: datum } : {}) },
  }).where(eq(schema.accounts.id, a.id))
  await tx.insert(schema.reisgeschiedenis).values({
    organisationId: a.organisationId, accountId: a.id, versie: 1, vanFaseId: a.faseId, naarFaseId: a.faseId, vanStatus: a.nbStatus, naarStatus: a.nbStatus,
    gebeurtenis: 'handmatig', door, op: nu.toISOString(), reden: `Terugkomdatum naar ${datum}: ${reden}`,
  })
  await schrijfAudit(tx, { organisationId: a.organisationId, actorId: door, action: 'account.terugOp', resourceType: 'accounts', resourceId: a.id, changes: { van: a.terugOp, naar: datum, reden } })
  return { terugOp: datum }
}

/**
 * Dagelijkse controle (06:00, en lui bij het openen): accounts op nee of wachtend
 * met een terugkomdatum vandaag of eerder krijgen `heropvolging`. Een tweede run
 * op dezelfde dag doet niets, omdat de terugkomdatum na de melding leeg is.
 */
export async function terugkomControle(tx: Tx, nu = new Date()): Promise<number> {
  const vandaag = nu.toISOString().slice(0, 10)
  const rijen = await tx.select({ id: schema.accounts.id, data: schema.accounts.data }).from(schema.accounts)
    .where(and(lte(schema.accounts.terugOp, vandaag), inArray(schema.accounts.nbStatus, ['nee', 'wachtend']), eq(schema.accounts.accountKind, 'prospect')))
  for (const r of rijen) {
    const t = r.data?.terugkom
    await meldGebeurtenis(tx, { accountId: r.id, gebeurtenis: 'heropvolging', door: 'motor', nu, reden: [t?.reden, t?.aanpak].filter(Boolean).join(' · ') || 'Terugkomdatum bereikt' })
  }
  return rijen.length
}

/** Lui uitvoeren: hoogstens één keer per uur per organisatie (zoals de gezondheid in P02). */
export async function terugkomControleLui(tx: Tx, organisatieId: string, nu = new Date()): Promise<void> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'terugkomControle'))
  const laatst = (r?.value as { op?: string } | undefined)?.op
  if (laatst && nu.getTime() - Date.parse(laatst) < 3600_000) return
  await tx.insert(schema.orgSettings).values({ organisationId: organisatieId, key: 'terugkomControle', value: { op: nu.toISOString() }, updatedAt: nu.toISOString() })
    .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value: { op: nu.toISOString() }, updatedAt: nu.toISOString() } })
  await terugkomControle(tx, nu)
}

/** Vertaal een ReisFout naar een h3-fout. */
export function alsHttpFout(e: unknown): never {
  if (e instanceof ReisFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message })
  throw e
}

export type { ReisData }

// ---------------------------------------------------------------------------
// Hercontactritme (P07): starten bij Gekwalificeerd en parkeren na de laatste poging
// ---------------------------------------------------------------------------

export async function laadRitmes(tx: Tx): Promise<Ritme[]> {
  return (await tx.select().from(schema.hercontactritmes)).map((r) => ({ id: r.id, naam: r.naam, bron: r.bron as Ritme['bron'], status: r.status, werkplek: r.data.werkplek ?? 'alle', stappen: r.data.stappen, parkeerDagen: r.data.parkeerDagen }))
}

const WARM = new Set(['referral', 'signaal', 'beurs'])

/** Start een hercontactritme voor een account zonder lopend ritme (bij Gekwalificeerd). */
export async function startRitmeVoorAccount(tx: Tx, accountId: string, opties: { winback?: boolean; nu?: Date } = {}): Promise<RitmeStand | null> {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a || a.accountKind !== 'prospect') return null
  const huidig = (a.data as any)?.reis?.ritme as RitmeStand | undefined
  if (huidig?.actief && !opties.winback) return huidig
  const [owner] = a.ownerId ? await tx.select({ werkplek: schema.users.werkplek }).from(schema.users).where(eq(schema.users.id, a.ownerId)) : []
  const bron = opties.winback ? 'winback' : WARM.has(a.nbBron ?? '') ? 'warm' : 'koud'
  const ritme = kiesRitme(await laadRitmes(tx), bron, (owner?.werkplek as any) ?? 'binnendienst')
  if (!ritme) return null
  const stand = startRitme(ritme, opties.nu ?? new Date())
  await tx.update(schema.accounts).set({ data: { ...(a.data ?? {}), reis: { ...((a.data as any)?.reis ?? {}), ritme: stand } } }).where(eq(schema.accounts.id, accountId))
  return stand
}


/** Na de laatste poging zonder reactie: gebeurtenis geparkeerd en een terugkomdatum. */
export async function parkeerTot(tx: Tx, accountId: string, tot: string, door: string, nu = new Date()) {
  await meldGebeurtenis(tx, { accountId, gebeurtenis: 'geparkeerd', door, nu, zonderMotor: true, reden: `Laatste poging zonder reactie; terug op ${tot}` })
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) return
  await meldpuntAan(tx)
  // Status wachtend, ook als de fase geen overgang naar Geparkeerd had.
  await tx.update(schema.accounts).set({
    nbStatus: ['nieuw', 'in reis'].includes(a.nbStatus) ? 'wachtend' : a.nbStatus, terugOp: tot,
    data: { ...(a.data ?? {}), wachtendTot: tot, terugkom: { datum: tot, reden: 'Geen reactie na laatste poging', aanpak: 'Alleen bij een nieuwe aanleiding', kanaal: 'bellen' } },
  }).where(eq(schema.accounts.id, accountId))
}
