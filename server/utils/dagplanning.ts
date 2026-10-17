// De automatische dagplanning op de server (F3 Dagplanner): de voorkeur per gebruiker, de vaste punten
// van vandaag als vingerafdruk, het schrijven, verschuiven en weghalen van wat de Dagplanner in de agenda
// zette (belblokken via sessieOp en hangAanBlok, voorbereiding en kansen als taken met herkomst
// "dagplanner") en ongedaan maken per blok of voor de hele dag. Het besluit om te plannen of herplannen
// neemt de agent in server/utils/agents/dagplanner.ts, na de toets van de Bewaker. Ongedaan maken is een
// handeling van de mens en schrijft een auditregel.
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { volgendVastBlok } from '../../shared/belblokken'
import { dagplanningVoorkeur, ITEM_LABEL, type DagplanningVoorkeur, type Doorschuiven, type PlanItem, type VastStand } from '../../shared/dagplanning'
import { nlMoment, nlTijdstip, plusDagen, volgendeWerkdag, type WerkdagInstelling } from '../../shared/datum'
import { bezetExtern } from './agenda'
import { schrijfAudit } from './audit'
import { blokkenVan, hangAanBlok, sessieOp } from './bellen'
import { gebruikDb } from './db'
import { onderteken } from './geheimen'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const dagLabel = (d: Date) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(d)
const tijdLabel = (d: Date) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(d)

export async function werkdagInstelling(tx: Tx): Promise<WerkdagInstelling> {
  const [r] = await rijen(tx, sql`select value from org_settings where key = 'werkdagen'`)
  return (r?.value as WerkdagInstelling) ?? {}
}

// ── Voorkeur ───────────────────────────────────────────────────────────────

export async function leesVoorkeur(tx: Tx, gebruikerId: string): Promise<DagplanningVoorkeur> {
  const [p] = await rijen(tx, sql`select data->'dagplanning' as d from persoonlijke_instellingen where id = ${gebruikerId}`)
  return dagplanningVoorkeur(p?.d)
}
export async function zetVoorkeur(tx: Tx, org: string, gebruikerId: string, v: DagplanningVoorkeur) {
  await tx.execute(sql`insert into persoonlijke_instellingen (id, organisation_id, data) values (${gebruikerId}, ${org}, ${JSON.stringify({ dagplanning: v })}::jsonb)
    on conflict (id) do update set data = persoonlijke_instellingen.data || excluded.data, updated_at = now()`)
  await schrijfAudit(tx, { organisationId: org, actorId: gebruikerId, action: 'dagplanning.voorkeur', resourceType: 'persoonlijke_instellingen', resourceId: gebruikerId, changes: { ...v } })
}

// ── Vaste punten ───────────────────────────────────────────────────────────

/** De vaste punten van vandaag (afspraken met hun status en bezet in de gekoppelde agenda), in dezelfde vorm als planBron. */
export async function vastStandVoor(tx: Tx, gebruikerId: string, dag: string): Promise<VastStand[]> {
  const van = nlTijdstip(dag, 0).toISOString()
  const tot = nlTijdstip(plusDagen(dag, 1), 0).toISOString()
  const afs = await rijen(tx, sql`select ap.id, ap.start_at, ap.end_at, ap.vorm, ap.status, ap.data->>'titel' as eigen_titel, m.naam as soort, a.name from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id
    where ap.owner_id = ${gebruikerId} and ap.status in ('gepland', 'afgerond', 'geannuleerd', 'niet_verschenen') and ap.start_at >= ${van} and ap.start_at < ${tot}`)
  const bezet = await bezetExtern(tx, gebruikerId, new Date(van), new Date(tot)).catch(() => [])
  return [
    ...afs.map((a) => ({ id: a.id as string, soort: a.vorm === 'bezoek' ? 'bezoek' : 'afspraak', start: iso(a.start_at)!, eind: iso(a.end_at)!, titel: a.eigen_titel || (a.name ? `${a.soort} ${a.name}` : a.soort), status: a.status as string })),
    ...bezet.map((b) => ({ id: `bezet:${b.start}:${b.eind}`, soort: 'bezet', start: b.start, eind: b.eind, titel: b.titel || 'Bezet' })),
  ]
}

export async function dagplanningVan(tx: Tx, gebruikerId: string, dag: string): Promise<Rij | null> {
  const [r] = await rijen(tx, sql`select * from dagplanningen where gebruiker_id = ${gebruikerId} and datum = ${dag}`)
  return r ?? null
}

// ── Doorschuiven ───────────────────────────────────────────────────────────

export interface Doel { belacties: { sessie: { start: string; eind: string; blokId: string; soort: string; plek?: string } | null; due: string; label: string }; bezoek: { due: string; label: string } }

/**
 * Het eerstvolgende passende moment na vandaag: belacties naar het eerstvolgende vaste belblok (vanaf de
 * volgende werkdag), anders de volgende werkdag om 09:00; een kans naar de volgende werkdag.
 */
export function doelVoorDoorschuiven(g: { werkplek?: string | null; data?: any }, nu: Date, w: WerkdagInstelling): Doel {
  const morgen = volgendeWerkdag(nlMoment(nu).datum, w)
  const negen = nlTijdstip(morgen, 9)
  const vb = volgendVastBlok(blokkenVan(g).blokken, nlTijdstip(morgen, 0), w)
  const bel = vb
    ? { sessie: { start: vb.start.toISOString(), eind: new Date(vb.start.getTime() + vb.blok.minuten * 60_000).toISOString(), blokId: vb.blok.id, soort: vb.blok.soort, plek: vb.blok.plek }, due: vb.start.toISOString(), label: `je vaste belblok van ${dagLabel(vb.start)} ${tijdLabel(vb.start)}` }
    : { sessie: null, due: negen.toISOString(), label: `${dagLabel(negen)} 09:00` }
  return { belacties: bel, bezoek: { due: negen.toISOString(), label: dagLabel(negen) } }
}
export const doorschuifTekst = (d: Doel): Doorschuiven => ({ belacties: d.belacties.label, bezoek: d.bezoek.label })

// ── Schrijven, verschuiven en weghalen ─────────────────────────────────────

/** De belacties die de Dagplanner aan zijn blokken mag hangen: open, niet aan een ander blok, geen gedeactiveerde prospect. */
export async function belPool(tx: Tx, gebruikerId: string, dag: string, eigenSessies: string[] = []) {
  const tot = nlTijdstip(plusDagen(dag, 1), 0).toISOString()
  return rijen(tx, sql`select t.id, t.account_id, t.contact_id, t.due_date, a.name from tasks t left join accounts a on a.id = t.account_id
    where t.owner_id = ${gebruikerId} and t.status in ('open', 'bezig') and t.action_type = 'bellen' and (t.due_date is null or t.due_date < ${tot}) and a.gedeactiveerd_op is null
      and (t.belblok_id is null ${eigenSessies.length ? sql`or t.belblok_id = any(string_to_array(${eigenSessies.join(',')}, ','))` : sql``})
    order by case t.priority when 'urgent' then 0 when 'hoog' then 1 when 'middel' then 2 else 3 end, t.due_date nulls last, t.created_at`)
}

/**
 * Eén item echt in de agenda zetten. Belblok: een sessie met de belacties uit de pool; voorbereiding:
 * een taak op dat moment; kans: de bestaande bezoektaak op dat moment of een nieuwe. Lunch en focus
 * houden alleen de tijd vrij. Geeft het item met wat er geschreven is, of null als het niet kon.
 */
export async function schrijfItem(tx: Tx, org: string, gebruikerId: string, item: PlanItem, pool: Rij[], gebruikt: Set<string>, dag: string): Promise<PlanItem | null> {
  const herkomst = { bron: 'dagplanner', uitvoerder: gebruikerId }
  const nuIso = new Date().toISOString()
  if (item.soort === 'belblok') {
    const s = await sessieOp(tx, org, gebruikerId, item.start, item.eind, { soort: 'gemengd', handmatig: true, gesprekken: [], dagplanner: { datum: dag, sleutel: item.sleutel } } as any)
    if (s.status !== 'gepland' || !(s.data as any)?.dagplanner) return null
    const deel = pool.filter((t) => !gebruikt.has(t.id)).slice(0, item.aantal ?? 0)
    for (const t of deel) gebruikt.add(t.id)
    if (deel.length) await hangAanBlok(tx, org, gebruikerId, s.id, item.start, deel.map((t) => ({ taskId: t.id, accountId: t.account_id, contactId: t.contact_id, accountNaam: t.name, reden: 'Dagplanner' })) as any)
    return { ...item, sessieId: s.id, aantal: deel.length, titel: deel.length ? `Belblok ${deel.length === 1 ? '1 gesprek' : `${deel.length} gesprekken`}` : item.titel, taken: deel.map((t) => ({ id: t.id, due: iso(t.due_date) })) }
  }
  if (item.soort === 'voorbereiding') {
    const [t] = await rijen(tx, sql`insert into tasks (organisation_id, owner_id, account_id, action_type, title, priority, due_date, executor, data, created_at, updated_at)
      values (${org}, ${gebruikerId}, ${item.accountId ?? null}, 'taak', ${item.titel}, 'middel', ${item.start}, 'mens', ${JSON.stringify({ herkomst, waarom: 'De Dagplanner zette een half uur voorbereiding voor je eerste afspraak: lees de briefing en bepaal wat je wilt weten.', dagplanner: { datum: dag, sleutel: item.sleutel }, afspraakId: item.afspraakId ?? null })}::jsonb, ${nuIso}, ${nuIso}) returning id`)
    return { ...item, taakId: t!.id, taakBestond: false }
  }
  if (item.soort === 'kans' && item.accountId) {
    const [al] = await rijen(tx, sql`select t.id, t.due_date from tasks t join accounts a on a.id = t.account_id where t.owner_id = ${gebruikerId} and t.account_id = ${item.accountId} and t.action_type = 'bezoek' and t.status in ('open', 'bezig') and t.belblok_id is null and a.gedeactiveerd_op is null order by t.due_date nulls last limit 1`)
    if (al) {
      await tx.execute(sql`update tasks set due_date = ${item.start}, data = data || ${JSON.stringify({ dagplanner: { datum: dag, sleutel: item.sleutel } })}::jsonb, updated_at = now() where id = ${al.id}`)
      return { ...item, taakId: al.id, taakBestond: true, vorigeDue: iso(al.due_date) }
    }
    const [g] = await rijen(tx, sql`select 1 from accounts where id = ${item.accountId} and gedeactiveerd_op is null`)
    if (!g) return null
    const [t] = await rijen(tx, sql`insert into tasks (organisation_id, owner_id, account_id, action_type, title, priority, due_date, executor, data, created_at, updated_at)
      values (${org}, ${gebruikerId}, ${item.accountId}, 'bezoek', ${item.titel.replace(/^Kans: /, 'Bezoek: ')}, 'middel', ${item.start}, 'mens', ${JSON.stringify({ herkomst, waarom: `Kans langs je route${item.sub ? `: ${item.sub}` : ''}. Loop binnen als het uitkomt.`, dagplanner: { datum: dag, sleutel: item.sleutel } })}::jsonb, ${nuIso}, ${nuIso}) returning id`)
    return { ...item, taakId: t!.id, taakBestond: false }
  }
  return { ...item }
}

/** Een item naar een ander moment vandaag: de sessie en de taken die eraan hangen, of de taak zelf. */
export async function verplaatsItem(tx: Tx, oud: PlanItem, nieuw: PlanItem): Promise<PlanItem> {
  if (oud.soort === 'belblok' && oud.sessieId) {
    await tx.execute(sql`update belblok_sessies set start_op = ${nieuw.start}, eind_op = ${nieuw.eind} where id = ${oud.sessieId} and status = 'gepland'`)
    await tx.execute(sql`update tasks set due_date = ${nieuw.start}, updated_at = now() where belblok_id = ${oud.sessieId} and status in ('open', 'bezig')`)
  } else if (oud.taakId) {
    await tx.execute(sql`update tasks set due_date = ${nieuw.start}, updated_at = now() where id = ${oud.taakId} and status in ('open', 'bezig')`)
  }
  return nieuw
}

/**
 * Een item weghalen. `ongedaan`: alles terug zoals het was (belacties uit het blok met hun oude datum,
 * een nieuwe taak geannuleerd, een bestaande bezoektaak met haar oude datum). `doorschuiven`: wat niet
 * meer past gaat naar het eerstvolgende passende moment (het doel); een voorbereiding vervalt met de afspraak.
 */
export async function haalItemWeg(tx: Tx, org: string, gebruikerId: string, item: PlanItem, wijze: 'ongedaan' | 'doorschuiven', doel?: Doel): Promise<void> {
  if (item.soort === 'belblok' && item.sessieId) {
    await tx.execute(sql`update belblok_sessies set status = 'geannuleerd' where id = ${item.sessieId} and status = 'gepland'`)
    const open = (await rijen(tx, sql`select id, account_id, contact_id from tasks where belblok_id = ${item.sessieId} and status in ('open', 'bezig')`))
    if (wijze === 'ongedaan') {
      for (const t of open) {
        const was = item.taken?.find((x) => x.id === t.id)
        await tx.execute(sql`update tasks set belblok_id = null, due_date = ${was ? was.due : null}, data = data - 'belblokId', updated_at = now() where id = ${t.id}`)
      }
    } else if (open.length && doel?.belacties.sessie) {
      const v = doel.belacties.sessie
      const s = await sessieOp(tx, org, gebruikerId, v.start, v.eind, { soort: v.soort, plek: v.plek, gesprekken: [] } as any, v.blokId)
      await tx.execute(sql`update tasks set belblok_id = null where belblok_id = ${item.sessieId} and status in ('open', 'bezig')`)
      if (s.status === 'gepland') await hangAanBlok(tx, org, gebruikerId, s.id, v.start, open.map((t) => ({ taskId: t.id, accountId: t.account_id, contactId: t.contact_id })) as any)
      else await tx.execute(sql`update tasks set due_date = ${doel.belacties.due}, updated_at = now() where id = any(string_to_array(${open.map((t) => t.id).join(',')}, ','))`)
    } else if (open.length) {
      await tx.execute(sql`update tasks set belblok_id = null, due_date = ${doel?.belacties.due ?? null}, data = data - 'belblokId', updated_at = now() where belblok_id = ${item.sessieId} and status in ('open', 'bezig')`)
    }
    return
  }
  if (!item.taakId) return
  if (item.soort === 'kans' && wijze === 'doorschuiven') {
    await tx.execute(sql`update tasks set due_date = ${doel?.bezoek.due ?? null}, updated_at = now() where id = ${item.taakId} and status in ('open', 'bezig')`)
  } else if (item.taakBestond) {
    await tx.execute(sql`update tasks set due_date = ${item.vorigeDue ?? null}, data = data - 'dagplanner', updated_at = now() where id = ${item.taakId} and status in ('open', 'bezig')`)
  } else {
    const reden = wijze === 'ongedaan' ? 'Ongedaan gemaakt in de dagplanning' : 'De afspraak staat niet meer op dit moment'
    await tx.execute(sql`update tasks set status = 'geannuleerd', data = data || ${JSON.stringify({ annuleerReden: reden })}::jsonb, updated_at = now() where id = ${item.taakId} and status in ('open', 'bezig')`)
  }
}

// ── Ongedaan maken ─────────────────────────────────────────────────────────

/**
 * Ongedaan maken door de gebruiker: één blok (sleutel) of de hele dag (zonder sleutel). Een blok dat al
 * begon of voorbij is, blijft. De hele dag ongedaan zet de status op ongedaan: die dag plant de
 * Dagplanner niet meer vanzelf (wel met "Plan mijn dag nu").
 */
export async function maakOngedaan(tx: Tx, org: string, gebruikerId: string, sleutel: string | null, nu = new Date()) {
  const dag = nlMoment(nu).datum
  const dp = await dagplanningVan(tx, gebruikerId, dag)
  if (!dp || dp.status !== 'gepland') fout(404, 'Er is vandaag geen dagplanning om ongedaan te maken')
  const items = (dp!.data?.items ?? []) as PlanItem[]
  const kies = items.filter((i) => i.status === 'actief' && (!sleutel || i.sleutel === sleutel))
  if (sleutel && !kies.length) fout(404, 'Dit blok staat niet (meer) in je dagplanning')
  const begonnen = kies.filter((i) => Date.parse(i.start) <= nu.getTime())
  if (sleutel && begonnen.length) fout(409, 'Dit blok is al begonnen')
  const weg = kies.filter((i) => Date.parse(i.start) > nu.getTime())
  for (const i of weg) await haalItemWeg(tx, org, gebruikerId, i, 'ongedaan')
  const nieuw = items.map((i) => (weg.some((w) => w.sleutel === i.sleutel) ? { ...i, status: 'ongedaan' as const } : i))
  const regel = sleutel ? `${weg[0]!.soort === 'belblok' ? 'Het belblok' : ITEM_LABEL[weg[0]!.soort]} van ${tijdLabel(new Date(weg[0]!.start))} is ongedaan gemaakt.` : `Je hebt de dagplanning ongedaan gemaakt${weg.length ? ` (${weg.length === 1 ? '1 blok' : `${weg.length} blokken`})` : ''}.`
  const wijzigingen = [...(dp!.data?.wijzigingen ?? []), { op: nu.toISOString(), aanleiding: 'ongedaan', regels: [regel] }]
  await tx.execute(sql`update dagplanningen set status = ${sleutel ? 'gepland' : 'ongedaan'}, data = data || ${JSON.stringify({ items: nieuw, wijzigingen })}::jsonb where id = ${dp!.id}`)
  await schrijfAudit(tx, { organisationId: org, actorId: gebruikerId, action: sleutel ? 'dagplanning.blok-ongedaan' : 'dagplanning.ongedaan', resourceType: 'dagplanningen', resourceId: dp!.id, changes: { sleutels: weg.map((i) => i.sleutel) } })
  return { ongedaan: weg.length, dag: !sleutel, tekst: regel }
}

/** Een melding in de app (soort dagstart), die de verzender per kanaal en buiten de stille uren doorzet. */
export async function meldDagplanning(tx: Tx, org: string, gebruikerId: string, titel: string, tekst: string, nu: Date) {
  await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${gebruikerId}, 'dagstart', ${titel}, ${tekst.slice(0, 900)}, '/dagstart', ${nu.toISOString()}, ${JSON.stringify({ bron: 'dagplanner' })}::jsonb)`)
}

// ── Melding van de gekoppelde agenda (webhook) ──────────────────────────────

/** Het token dat een agendaprovider bij elke wijziging terugstuurt (clientState bij Microsoft, kanaaltoken bij Google). */
export function agendaMeldingToken(org: string, gebruikerId: string): string {
  return `${Buffer.from(`${org}\n${gebruikerId}`).toString('base64url')}.${onderteken(`${org}:${gebruikerId}`, 'agenda')}`
}
/** Leest en controleert het token; null bij een onbekend of vervalst token. */
export function leesAgendaMeldingToken(token: string | null | undefined): { org: string; gebruikerId: string } | null {
  const [deel, sig] = String(token ?? '').split('.')
  if (!deel || !sig) return null
  const [org, gebruikerId] = Buffer.from(deel, 'base64url').toString('utf8').split('\n')
  if (!org || !gebruikerId) return null
  const goed = onderteken(`${org}:${gebruikerId}`, 'agenda')
  if (sig.length !== goed.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(goed))) return null
  return { org, gebruikerId }
}
