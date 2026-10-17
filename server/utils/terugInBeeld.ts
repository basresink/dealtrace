// Terug in beeld op de server: de verloren prospects van de gebruiker (salesmanager: zijn team) met hun
// terugkomdatum, regel, kanaal, wie het oppakt, aanpak en of het hercontact al loopt; het voorbeeld van de drie
// manieren om te starten; het starten zelf en Later. Starten is een heropvolging (terug in de reis, via het
// meldpunt) plus de gekozen eerste stap: het hercontactritme van de regel met poging 1 als taak, één taak, of
// een beltaak in het eerstvolgende koude belblok. De afkoeling bepaalt of starten mag. Pure regels staan in
// shared/terugInBeeld.ts; de terugkomdatum komt uit terugkomDatum en de afkoeling uit afkoelingTot.
import { eq, sql } from 'drizzle-orm'
import { volgendVastBlok } from '../../shared/belblokken'
import { nlMoment, plusDagen, volgendWerkmoment, type WerkdagInstelling } from '../../shared/datum'
import { kiesRitme, type Ritme } from '../../shared/hercontact'
import { afkoelingTot, type Kanaal } from '../../shared/nbStatus'
import { POGING_SOORTEN } from '../../shared/planning'
import { KLASSEN_STANDAARD, type Klasse } from '../../shared/ritmematrix'
import { OPPAKKER_LABEL, oppakkerVan, ritmeTijdlijn, terugDagKort } from '../../shared/terugkomBeheer'
import {
  belblokMag, GESTART_ZICHTBAAR_DAGEN, laterDatum, magStarten, sorteer, startToast, statusVan,
  type StartSoort, type TerugBron, type TerugGestart, type TerugRegel, type TerugRij,
} from '../../shared/terugInBeeld'
import { kanaalVanRegel, terugkomDatum } from '../../shared/verkoopverhaal'
import { schrijfAudit } from './audit'
import { blokkenVan, hangAanBlok, sessieOp, type Kandidaat } from './bellen'
import { schema } from './db'
import { teamLeden } from './planning'
import { afkoelingInstelling, laadRitmes, meldGebeurtenis, pauzeer, ReisFout, startRitmeVoorAccount, verkoopverhaal, zetTerugOp } from './reis'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (status: number, bericht: string): never => { throw new ReisFout(status, bericht) }
const datumVan = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null)

export interface TibGebruiker { id: string; rol: string; niveau?: string; werkplek?: string | null }

/** Wiens prospects: de accountmanager zijn eigen, de salesmanager zijn team, de beheerder iedereen. */
async function eigenaren(tx: Tx, g: TibGebruiker): Promise<string[]> {
  if (g.rol === 'accountmanager') return [g.id]
  return teamLeden(tx, g)
}

const ACTIE_VAN_KANAAL: Record<string, string> = { bellen: 'bellen', mail: 'mailen', linkedin: 'linkedin', bezoek: 'bezoek', whatsapp: 'bericht' }

async function werkdagInstelling(tx: Tx): Promise<WerkdagInstelling> {
  const [r] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen'))
  return (r?.value as WerkdagInstelling) ?? {}
}

interface Context {
  stand: Awaited<ReturnType<typeof verkoopverhaal>>
  ritmes: Ritme[]
  regelRitme: Map<string, string | null>
  klassen: Klasse[]
}
async function laadContext(tx: Tx): Promise<Context> {
  const [stand, ritmes, rr, kl] = await Promise.all([
    verkoopverhaal(tx), laadRitmes(tx),
    rijen(tx, sql`select extern_id, hercontactritme_id from vv_terugkomregels where actief`),
    tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'klassen')),
  ])
  const klassen = ((kl[0]?.value as Klasse[] | undefined)?.length ? kl[0]!.value : KLASSEN_STANDAARD) as Klasse[]
  return { stand, ritmes, regelRitme: new Map(rr.map((r) => [r.extern_id, r.hercontactritme_id ?? null])), klassen }
}

function regelVan(ctx: Context, id: string | null | undefined): TerugRegel | null {
  const r = id ? ctx.stand.terugkomregels.find((x) => x.id === id) : null
  if (!r) return null
  return { id: r.id, naam: r.reden, dagen: r.termijnDagen, oppakker: OPPAKKER_LABEL[oppakkerVan(r)], aanpak: r.aanpak || null, ritmeId: ctx.regelRitme.get(r.id) ?? null }
}

/** Het ritme dat bij de start hoort: dat van de regel, anders het standaard winbackritme. */
function ritmeVoor(ctx: Context, regel: TerugRegel | null, werkplek: string | null | undefined): Ritme | null {
  const actief = ctx.ritmes.filter((r) => (r.status ?? 'actief') === 'actief')
  return actief.find((r) => r.id === regel?.ritmeId) ?? kiesRitme(actief, 'winback', werkplek === 'buitendienst' ? 'buitendienst' : 'binnendienst')
}

const GEEN_AANPAK = 'Er is geen regel voor deze reden. Bel en vraag of de situatie veranderd is.'

/** Eén rij uit een account, of null als hij hier niet (meer) hoort. */
function rijUit(a: Rij, ctx: Context, extra: { taak?: Rij; reeks?: boolean; poging?: string | null }, vandaag: string): TerugRij | null {
  const d = a.data ?? {}
  const k = ctx.klassen.find((x) => x.id === a.klasse)
  const basis = { id: a.id, naam: a.name, plaats: a.city ?? null, klasse: k?.naam ?? a.klasse ?? null, eigenaar: { id: a.owner_id ?? null, naam: a.eigenaar ?? null } }
  let rij: TerugRij
  if (a.nb_status === 'nee' && a.terug_op && d.nee?.reden) {
    // Op nee: datum, regel en afkoeling uit de nee en de terugkomgegevens.
    if (d.nee.reden === 'Niet geschikt') return null
    const tk = d.terugkom ?? {}
    const regel = regelVan(ctx, a.terug_regel_id ?? tk.regelId)
    const kanaal = (tk.kanaal ?? (regel ? kanaalVanRegel(ctx.stand.terugkomregels.find((x) => x.id === regel.id)!.kanaal) : 'bellen')) as Kanaal
    const hand = Array.isArray(d.terugHistorie) && d.terugHistorie.length > 0
    const v = d.nee.op ? terugkomDatum(d.nee.reden, ctx.stand, new Date(d.nee.op), d.nee.afkoeling ?? {}, tk.bron ?? 'nee') : null
    rij = {
      ...basis, bron: (tk.bron ?? 'nee') as TerugBron, reden: d.nee.reden, toelichting: d.nee.toelichting ?? null, verlorenOp: datumVan(d.nee.op), terugOp: a.terug_op,
      opgeschoven: !hand && !!v?.opgeschoven && v.datum === a.terug_op, hand, afkoelEind: afkoelingTot(d.nee, kanaal), kanaal, regel,
      aanpak: regel?.aanpak ?? tk.aanpak ?? GEEN_AANPAK, gestart: null, teruggekomen: false,
    }
  } else if (['deal_verloren', 'offerte_verloren'].includes(d.terugkom?.bron) && a.terug_op) {
    // Teruggemeld uit DealDrive: verwerkTerugkomst zette al een taak.
    const tk = d.terugkom
    const regel = regelVan(ctx, a.terug_regel_id ?? tk.regelId)
    rij = {
      ...basis, bron: tk.bron, reden: tk.verliesReden ?? tk.reden ?? 'Onbekend', toelichting: null, verlorenOp: tk.verlorenOp ?? null, terugOp: a.terug_op,
      opgeschoven: false, hand: false, afkoelEind: null, kanaal: (tk.kanaal ?? 'bellen') as Kanaal, regel, aanpak: regel?.aanpak ?? tk.aanpak ?? GEEN_AANPAK, gestart: null, teruggekomen: false,
    }
  } else if (d.terugInBeeld && typeof d.terugInBeeld === 'object' && ['in reis', 'wachtend', 'nieuw'].includes(a.nb_status)) {
    // Al terug in de reis (heropvolging): de bewaarde stand.
    const t = d.terugInBeeld
    const regel = regelVan(ctx, t.regelId)
    const wacht = a.nb_status === 'wachtend' && a.terug_op
    rij = {
      ...basis, bron: (t.bron ?? 'nee') as TerugBron, reden: t.reden ?? 'Onbekend', toelichting: t.toelichting ?? null, verlorenOp: t.verlorenOp ?? null,
      terugOp: wacht ? a.terug_op : t.terugOp, opgeschoven: false, hand: !!t.hand || !!wacht, afkoelEind: t.afkoelEind ?? null, kanaal: (t.kanaal ?? 'bellen') as Kanaal,
      regel, aanpak: regel?.aanpak ?? t.aanpak ?? GEEN_AANPAK, gestart: t.gestart ?? null, teruggekomen: !wacht,
    }
    if (rij.gestart && datumVan(rij.gestart.op)! < plusDagen(vandaag, -GESTART_ZICHTBAAR_DAGEN)) return null
  } else return null

  // Elders gestart: een open taak uit de terugkomregel, een lopende opvolgreeks of (na de terugkomst) een poging.
  if (!rij.gestart) {
    if (extra.taak) rij.gestart = { soort: 'taak', op: new Date(extra.taak.created_at).toISOString(), eersteOp: datumVan(extra.taak.due_date) ? nlMoment(new Date(extra.taak.due_date)).datum : null, taakId: extra.taak.id, elders: 'taak' }
    else if (extra.reeks) rij.gestart = { soort: 'reeks', op: new Date().toISOString(), eersteOp: null, elders: 'reeks' }
    else if (rij.teruggekomen && extra.poging && extra.poging >= rij.terugOp) rij.gestart = { soort: 'taak', op: `${extra.poging}T09:00:00.000Z`, eersteOp: extra.poging, elders: 'poging' }
    if (rij.gestart?.elders && rij.terugOp < plusDagen(vandaag, -GESTART_ZICHTBAAR_DAGEN)) return null
  }
  return rij
}

/** De rijen voor deze gebruiker; met `ids` alleen die accounts. */
export async function laadRijen(tx: Tx, g: TibGebruiker, nu = new Date(), ids?: string[]): Promise<{ rijen: TerugRij[]; ctx: Context; vandaag: string; accounts: Rij[] }> {
  const vandaag = nlMoment(nu).datum
  const wie = await eigenaren(tx, g)
  const ctx = await laadContext(tx)
  const accounts = await rijen(tx, sql`select a.id, a.organisation_id, a.name, a.city, a.klasse, a.owner_id, u.name as eigenaar, a.nb_status, a.terug_op, a.terug_regel_id, a.data
    from accounts a left join users u on u.id = a.owner_id
    where a.gedeactiveerd_op is null and a.owner_id = any(string_to_array(${wie.join(',') || '-'}, ','))
      ${ids ? sql`and a.id = any(string_to_array(${ids.join(',') || '-'}, ','))` : sql``}
      and ((a.nb_status = 'nee' and a.terug_op is not null)
        or (a.terug_op is not null and a.data->'terugkom'->>'bron' in ('deal_verloren', 'offerte_verloren'))
        or (jsonb_typeof(a.data->'terugInBeeld') = 'object' and a.nb_status in ('in reis', 'wachtend', 'nieuw')))`)
  const aIds = accounts.map((a) => a.id)
  const lijst = aIds.join(',') || '-'
  const [taken, reeksen, pogingen] = aIds.length ? await Promise.all([
    rijen(tx, sql`select distinct on (account_id) id, account_id, due_date, created_at from tasks
      where account_id = any(string_to_array(${lijst}, ',')) and status in ('open', 'bezig') and data->'herkomst'->>'bron' = 'terugkomregel' order by account_id, due_date`),
    rijen(tx, sql`select account_id from reeksen where account_id = any(string_to_array(${lijst}, ',')) and status in ('loopt', 'gepauzeerd')`),
    rijen(tx, sql`select account_id, max(op) as op from activiteiten where account_id = any(string_to_array(${lijst}, ',')) and soort in ${[...POGING_SOORTEN]} group by account_id`),
  ]) : [[], [], []]
  const uit: TerugRij[] = []
  for (const a of accounts) {
    const p = pogingen.find((x) => x.account_id === a.id)
    const r = rijUit(a, ctx, { taak: taken.find((t) => t.account_id === a.id), reeks: reeksen.some((x) => x.account_id === a.id), poging: p ? nlMoment(new Date(p.op)).datum : null }, vandaag)
    if (r) uit.push(r)
  }
  return { rijen: sorteer(uit), ctx, vandaag, accounts }
}

/** Alles voor de pagina. */
export async function terugInBeeld(tx: Tx, g: TibGebruiker, nu = new Date()) {
  const { rijen: lijst, ctx, vandaag } = await laadRijen(tx, g, nu)
  return {
    vandaag, rijen: lijst,
    regels: ctx.stand.terugkomregels.filter((r) => r.lijst === 'verloren').map((r) => ({ id: r.id, naam: r.reden })),
    team: g.rol !== 'accountmanager',
  }
}

async function eenRij(tx: Tx, g: TibGebruiker, id: string, nu: Date) {
  const [bestaat] = await rijen(tx, sql`select owner_id from accounts where id = ${id}`)
  if (!bestaat) fout(404, 'Deze prospect bestaat niet')
  const r = await laadRijen(tx, g, nu, [id])
  const rij = r.rijen[0]
  if (!rij) {
    if (!(await eigenaren(tx, g)).includes(bestaat!.owner_id)) fout(403, 'Dit is niet je eigen prospect')
    fout(404, 'Deze prospect staat niet in Terug in beeld')
  }
  return { rij: rij!, ctx: r.ctx, vandaag: r.vandaag, account: r.accounts.find((a) => a.id === id)! }
}

interface BlokKeuze { start: Date; eind: Date; label: string; vrij: number; blok: ReturnType<typeof blokkenVan>['blokken'][number] }
/** Het eerstvolgende koude of gemengde belblok van de eigenaar met nog ruimte (5 minuten per poging). */
async function volgendBlok(tx: Tx, eigenaarId: string, nu: Date, inst: WerkdagInstelling): Promise<BlokKeuze | null> {
  const [u] = await tx.select({ werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, eigenaarId))
  if (!u) return null
  const koud = blokkenVan(u).blokken.filter((b) => b.soort === 'koud' || b.soort === 'gemengd')
  let na = nu
  for (let i = 0; i < 20; i++) {
    const v = volgendVastBlok(koud, na, inst)
    if (!v) return null
    const eind = new Date(v.start.getTime() + v.blok.minuten * 60_000)
    const [s] = await rijen(tx, sql`select s.status, (select count(*)::int from tasks t where t.belblok_id = s.id and t.status in ('open', 'bezig')) as n
      from belblok_sessies s where s.gebruiker_id = ${eigenaarId} and s.start_op = ${v.start.toISOString()} and s.status <> 'geannuleerd'`)
    const vrij = Math.floor(v.blok.minuten / 5) - (s?.n ?? 0)
    if ((!s || s.status === 'gepland') && vrij > 0) {
      const tijd = (d: Date) => { const m = nlMoment(d); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
      return { start: v.start, eind, vrij, blok: v.blok, label: `${terugDagKort(nlMoment(v.start).datum)} ${tijd(v.start)} tot ${tijd(eind)}` }
    }
    na = new Date(v.start.getTime() + 60_000)
  }
  return null
}

/** De drie manieren om te starten, met de datums vooraf. */
export async function startVoorbeeld(tx: Tx, g: TibGebruiker, id: string, nu = new Date()) {
  const { rij, ctx, vandaag } = await eenRij(tx, g, id, nu)
  const inst = await werkdagInstelling(tx)
  const [eigenaar] = rij.eigenaar.id ? await tx.select({ werkplek: schema.users.werkplek }).from(schema.users).where(eq(schema.users.id, rij.eigenaar.id)) : []
  const ritme = ritmeVoor(ctx, rij.regel, eigenaar?.werkplek)
  const start = volgendWerkmoment(nu, inst)
  const startDag = nlMoment(start).datum
  const bel = belblokMag(rij.kanaal)
  const blok = bel.mag && rij.eigenaar.id ? await volgendBlok(tx, rij.eigenaar.id, nu, inst) : null
  return {
    rij, vandaag, status: statusVan(rij, vandaag), mag: magStarten(rij, vandaag),
    reeks: ritme ? { ritmeId: ritme.id, naam: ritme.naam, vanRegel: !!rij.regel?.ritmeId && rij.regel.ritmeId === ritme.id, parkeerDagen: ritme.parkeerDagen, ...ritmeTijdlijn(ritme.stappen, ritme.parkeerDagen, startDag) } : null,
    taak: { op: start.toISOString(), kanaal: rij.kanaal },
    belblok: bel.mag ? (blok ? { mag: true, label: blok.label, start: blok.start.toISOString(), vrij: blok.vrij } : { mag: false, reden: 'Er is geen koud belblok met ruimte in de komende twee weken.' }) : { mag: false, reden: bel.reden },
  }
}

/** Open pogingen uit een ritme vervallen: er loopt nooit meer dan één hercontact. */
async function annuleerPogingen(tx: Tx, accountId: string, reden: string) {
  await tx.execute(sql`update tasks set status = 'geannuleerd', data = data || ${JSON.stringify({ annuleerReden: reden })}::jsonb, updated_at = now()
    where account_id = ${accountId} and status in ('open', 'bezig') and data ? 'poging'`)
}
async function ritmeUit(tx: Tx, accountId: string) {
  await tx.execute(sql`update accounts set data = jsonb_set(data, '{reis,ritme,actief}', 'false'::jsonb) where id = ${accountId} and data->'reis'->'ritme' is not null`)
}
async function hercontactRegel(tx: Tx): Promise<string | null> {
  const [r] = await rijen(tx, sql`select id from activity_rules where data->'trigger'->>'patroon' = 'hercontact-vervolg' limit 1`)
  return r?.id ?? null
}

/**
 * Start het hercontact: de prospect gaat terug in de reis (heropvolging) en krijgt de gekozen eerste stap.
 * Mag alleen na de afkoeling en als er nog niets loopt.
 */
export async function startHercontact(tx: Tx, org: string, g: TibGebruiker, id: string, soort: StartSoort, nu = new Date()) {
  if (!['reeks', 'taak', 'belblok'].includes(soort)) fout(422, 'Kies opvolgreeks, taak of belblok')
  const { rij, ctx, vandaag, account } = await eenRij(tx, g, id, nu)
  const m = magStarten(rij, vandaag)
  if (!m.mag) fout(rij.gestart ? 409 : 422, m.reden!)
  if (soort === 'belblok' && !belblokMag(rij.kanaal).mag) fout(422, belblokMag(rij.kanaal).reden!)
  const inst = await werkdagInstelling(tx)
  const eigenaar = account.owner_id ?? g.id
  const [u] = await tx.select({ werkplek: schema.users.werkplek }).from(schema.users).where(eq(schema.users.id, eigenaar))
  const blok = soort === 'belblok' ? await volgendBlok(tx, eigenaar, nu, inst) : null
  if (soort === 'belblok' && !blok) fout(422, 'Er is geen koud belblok met ruimte in de komende twee weken. Kies één taak.')

  // Terug in de reis via het meldpunt; de nee en de terugkomdatum zijn daarmee afgehandeld.
  if (['nee', 'wachtend'].includes(account.nb_status)) {
    await meldGebeurtenis(tx, { accountId: id, gebeurtenis: 'heropvolging', door: g.id, nu, zonderMotor: true, reden: `Hercontact gestart vanuit Terug in beeld${rij.regel ? `: ${rij.regel.naam}` : ''}` })
  }
  await annuleerPogingen(tx, id, 'Vervangen: hercontact gestart vanuit Terug in beeld')
  const due = volgendWerkmoment(nu, inst)
  const tijd = nu.toISOString()
  const waarom = `Terug in beeld na ${rij.reden.toLowerCase()}${rij.regel ? `, regel ${rij.regel.naam}` : ''}. Aanpak: ${rij.aanpak}`
  const herkomst = { bron: 'terugkomregel', regelId: rij.regel?.id ?? null, actiesoort: ACTIE_VAN_KANAAL[rij.kanaal] ?? 'bellen', uitvoerder: eigenaar }
  let taakId: string
  let eersteOp = nlMoment(due).datum
  let ritmeNaam: string | null = null
  if (soort === 'reeks') {
    // Het hercontactritme van de regel (zonder regel het standaard winbackritme); poging 1 is meteen een taak.
    const stand = await startRitmeVoorAccount(tx, id, { winback: true, nu, regelId: rij.regel?.id ?? null })
    const ritme = stand ? (await laadRitmes(tx)).find((r) => r.id === stand.ritmeId) ?? null : ritmeVoor(ctx, rij.regel, u?.werkplek)
    if (!stand || !ritme) fout(422, 'Er is geen actief hercontactritme. Kies één taak.')
    ritmeNaam = ritme!.naam
    const eerste = ritme!.stappen[0]!
    const [t] = await tx.insert(schema.tasks).values({
      organisationId: org, ownerId: eigenaar, accountId: id, actionType: ACTIE_VAN_KANAAL[eerste.kanaal] ?? 'bellen', title: `Poging 1: ${rij.naam}`, priority: 'middel', dueDate: due.toISOString(), executor: 'mens',
      ruleId: await hercontactRegel(tx), onderwerp: `${id}:poging-1`,
      data: { waarom: eerste.instructie ? `${eerste.instructie}. ${waarom}` : waarom, herkomst, poging: { n: 1, van: ritme!.stappen.length, kanaal: eerste.kanaal } }, createdAt: tijd, updatedAt: tijd,
    }).returning({ id: schema.tasks.id })
    taakId = t!.id
  } else {
    // Eén taak of een beltaak in het belblok: daarna beslis je zelf, dus geen ritme ernaast.
    await ritmeUit(tx, id)
    const actie = soort === 'belblok' ? 'bellen' : ACTIE_VAN_KANAAL[rij.kanaal] ?? 'bellen'
    const [t] = await tx.insert(schema.tasks).values({
      organisationId: org, ownerId: eigenaar, accountId: id, actionType: actie, title: `Terug in beeld: ${rij.naam}`, priority: 'middel', dueDate: (blok?.start ?? due).toISOString(), executor: 'mens',
      onderwerp: `${id}:terug-${rij.terugOp}`, data: { waarom, herkomst }, createdAt: tijd, updatedAt: tijd,
    }).returning({ id: schema.tasks.id })
    taakId = t!.id
    if (blok) {
      const s = await sessieOp(tx, org, eigenaar, blok.start.toISOString(), blok.eind.toISOString(), { plek: blok.blok.plek, soort: blok.blok.soort, verhouding: blok.blok.verhouding, scriptId: blok.blok.scriptId ?? null, gesprekken: [] }, blok.blok.id)
      if (s.status !== 'gepland') fout(409, 'Dit belblok loopt al of is klaar. Kies één taak.')
      await hangAanBlok(tx, org, eigenaar, s.id, blok.start.toISOString(), [{ taskId: taakId, accountId: id } as Kandidaat])
      eersteOp = nlMoment(blok.start).datum
    }
  }

  const [na] = await tx.select({ data: schema.accounts.data }).from(schema.accounts).where(eq(schema.accounts.id, id))
  const vorig = ((na?.data as any)?.terugInBeeld ?? {}) as Record<string, unknown>
  const gestart: TerugGestart = { soort, op: tijd, door: g.id, eersteOp, taakId, ritmeNaam, blokLabel: blok?.label ?? null }
  const snap = {
    ...vorig, terugOp: rij.terugOp, regelId: rij.regel?.id ?? null, reden: rij.reden, toelichting: rij.toelichting, bron: rij.bron, verlorenOp: rij.verlorenOp, kanaal: rij.kanaal,
    aanpak: rij.aanpak, afkoelEind: rij.afkoelEind, hand: rij.hand, teruggekomenOp: vorig.teruggekomenOp ?? tijd, gestart,
  }
  await tx.execute(sql`update accounts set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('terugInBeeld', ${JSON.stringify(snap)}::jsonb), updated_at = now() where id = ${id}`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'terugInBeeld.start', resourceType: 'accounts', resourceId: id, changes: { soort, taakId, eersteOp, ritme: ritmeNaam, blok: blok?.label ?? null, regelId: rij.regel?.id ?? null } })
  return { soort, taakId, eersteOp, ritmeNaam, blokLabel: blok?.label ?? null, tekst: startToast(soort, rij.naam, { blokLabel: blok?.label }) }
}

/**
 * Later of Pas datum aan: een nieuwe terugkomdatum met een reden, nooit binnen de afkoeling. Op nee via
 * zetTerugOp (met historie en audit); al terug in de reis maar nog niet gestart: pauzeren tot die datum.
 */
export async function zetLater(tx: Tx, g: TibGebruiker, id: string, b: { datum?: string; reden?: string }, nu = new Date()) {
  const datum = String(b.datum ?? '')
  const reden = String(b.reden ?? '').trim().slice(0, 300)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) fout(422, 'Kies een datum')
  if (!reden) fout(422, 'Geef een reden')
  const { rij, vandaag, account } = await eenRij(tx, g, id, nu)
  if (rij.gestart) fout(409, 'Het hercontact loopt al; de datum blijft staan')
  const l = laterDatum(datum, rij, vandaag)
  const melding = l.geschoven ? `Valt binnen de afkoeling; de terugkomdatum is ${l.datum}.` : null
  if (account.nb_status === 'nee' || account.nb_status === 'wachtend') {
    const r = await zetTerugOp(tx, id, l.datum, reden, g.id, nu)
    if (account.data?.terugInBeeld && account.nb_status === 'wachtend') {
      await tx.execute(sql`update accounts set data = jsonb_set(data, '{terugInBeeld}', (data->'terugInBeeld') || ${JSON.stringify({ terugOp: r.terugOp, hand: true })}::jsonb) where id = ${id}`)
    }
    return { terugOp: r.terugOp, melding: r.melding ?? melding }
  }
  // Al terug in de reis: pauzeren tot de nieuwe datum, zonder ritme ernaast.
  await pauzeer(tx, id, l.datum, `Terug in beeld later: ${reden}`, g.id, nu)
  await annuleerPogingen(tx, id, 'Later vanuit Terug in beeld')
  await ritmeUit(tx, id)
  const hist = { van: rij.terugOp, naar: l.datum, op: nu.toISOString(), door: g.id, reden }
  await tx.execute(sql`update accounts set data = jsonb_set(data, '{terugInBeeld}', (data->'terugInBeeld') || ${JSON.stringify({ terugOp: l.datum, hand: true })}::jsonb)
    || jsonb_build_object('terugHistorie', coalesce(data->'terugHistorie', '[]'::jsonb) || ${JSON.stringify([hist])}::jsonb) where id = ${id}`)
  await schrijfAudit(tx, { organisationId: account.organisation_id ?? '', actorId: g.id, action: 'account.terugOp', resourceType: 'accounts', resourceId: id, changes: { van: rij.terugOp, naar: l.datum, reden } })
  return { terugOp: l.datum, melding }
}
