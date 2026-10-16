// Invloedskaart (F8) op de server: contacten met rol, houding en rapporteert-aan, contactmomenten en
// gesprekken per contact, de vermoedelijke rollen van de Profielbouwer (accounts.data.committee), citaten uit
// gespreksverslagen, en daaruit de dekking, het grootste risico en één voorgestelde stap (shared/invloed.ts).
// Alleen lezen; schrijven gaat via PUT /api/contacten/:id/invloed en de Notulist (agents/houding.ts).
import { sql } from 'drizzle-orm'
import {
  citatenVoor, dekking, grootsteRisico, isGesprek, isHouding, MOMENT_SOORTEN, vermoedelijkeRollen, voorgesteldeStap,
  type InvloedData, type InvloedPersoon, type Verslag,
} from '../../shared/invloed'
import { gebruikDb } from './db'
import { leesStand } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
const dag = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : '')

/** De personen op de kaart: actieve contacten met hun momenten, plus de rollen zonder naam. */
export async function invloedPersonen(tx: Tx, accountId: string) {
  const [acc] = await rijen(tx, sql`select data from accounts where id = ${accountId}`)
  const cs = await rijen(tx, sql`select id, first_name, last_name, rol, data from contacts where account_id = ${accountId} and status <> 'vertrokken' order by id`)
  const soorten = sql.join(MOMENT_SOORTEN.map((s) => sql`${s}`), sql`, `)
  const acts = await rijen(tx, sql`select contact_id, soort, uitkomst from activiteiten where account_id = ${accountId} and contact_id is not null and soort in (${soorten})`)
  const aps = await rijen(tx, sql`select contact_id from appointments where account_id = ${accountId} and contact_id is not null and status = 'afgerond'`)
  const per = new Map<string, { n: number; gesproken: boolean }>()
  const tel = (id: string, gesprek: boolean) => { const s = per.get(id) ?? { n: 0, gesproken: false }; s.n++; s.gesproken ||= gesprek; per.set(id, s) }
  for (const a of acts) tel(a.contact_id, isGesprek(a.soort, a.uitkomst))
  for (const a of aps) tel(a.contact_id, true)
  const echt: InvloedPersoon[] = cs.map((c) => {
    const inv = (c.data?.invloed ?? {}) as InvloedData
    const zekerheid = typeof c.data?.zekerheid === 'number' ? c.data.zekerheid : null
    const bevestigd = !!inv.rolBevestigdOp
    return {
      id: c.id, naam: `${c.first_name ?? ''} ${c.last_name}`.trim(), functie: c.data?.functie ?? null, rol: c.rol,
      houding: isHouding(inv.houding) ? inv.houding : 'onbekend', momenten: per.get(c.id)?.n ?? 0, gesproken: per.get(c.id)?.gesproken ?? false,
      rapporteertAan: inv.rapporteertAan ?? null, zekerheid, bron: c.data?.bron ?? null, rolBevestigd: bevestigd,
      vermoedelijk: !bevestigd && zekerheid !== null && zekerheid < 60, onbekend: false,
    }
  })
  const ids = new Set(echt.map((p) => p.id))
  for (const p of echt) if (p.rapporteertAan && !ids.has(p.rapporteertAan)) p.rapporteertAan = null
  const vermoedelijk = vermoedelijkeRollen(acc?.data?.committee?.voorstellen, echt)
  return { personen: [...echt, ...vermoedelijk], contacten: cs, committeeOp: acc?.data?.committee?.op ?? null }
}

/** Gespreksverslagen van het account: afspraken, belpogingen met notitie en beltaken met verslag. */
export async function invloedVerslagen(tx: Tx, accountId: string): Promise<Verslag[]> {
  const aps = await rijen(tx, sql`select contact_id, start_at, data from appointments where account_id = ${accountId} and coalesce(data->'verslag'->>'tekst', '') <> '' order by start_at desc limit 40`)
  const acts = await rijen(tx, sql`select contact_id, soort, op, data from activiteiten where account_id = ${accountId} and soort in ('gebeld', 'bezoek', 'notitie')
    and coalesce(data->>'tekst', data->>'notitie', data->>'verslag', '') <> '' order by op desc limit 80`)
  const taken = await rijen(tx, sql`select contact_id, updated_at, data from tasks where account_id = ${accountId} and coalesce(data->'verslag'->>'tekst', '') <> '' order by updated_at desc limit 40`)
  const tr = await rijen(tx, sql`select t.tekst, t.op, coalesce(ap.contact_id, tk.contact_id) as contact_id from transcripten t
    left join appointments ap on t.record_soort = 'appointments' and ap.id = t.record_id left join tasks tk on t.record_soort = 'tasks' and tk.id = t.record_id
    where coalesce(ap.account_id, tk.account_id) = ${accountId} and t.bijlage_id is null order by t.op desc limit 20`)
  const uit: Verslag[] = [
    ...aps.map((a) => ({ tekst: String(a.data.verslag.tekst), bron: `Verslag ${dag(a.start_at)}`, datum: iso(a.start_at), contactId: a.contact_id ?? null })),
    ...taken.map((t) => ({ tekst: String(t.data.verslag.tekst), bron: `Belverslag ${dag(t.data.verslag.op ?? t.updated_at)}`, datum: iso(t.data.verslag.op ?? t.updated_at), contactId: t.contact_id ?? null })),
    ...acts.map((a) => ({ tekst: String(a.data?.verslag ?? a.data?.tekst ?? a.data?.notitie), bron: `${a.soort === 'notitie' ? 'Notitie' : a.soort === 'bezoek' ? 'Bezoek' : 'Gesprek'} ${dag(a.op)}`, datum: iso(a.op), contactId: a.contact_id ?? null })),
    ...tr.map((t) => ({ tekst: String(t.tekst), bron: `Transcript ${dag(t.op)}`, datum: iso(t.op), contactId: t.contact_id ?? null })),
  ]
  // Een verslag op de taak gaat bij afronden ook mee naar de belactiviteit: hetzelfde verslag telt één keer.
  const gezien = new Set<string>()
  return uit.filter((v) => { const k = `${v.contactId}|${v.tekst.slice(0, 120)}`; if (gezien.has(k)) return false; gezien.add(k); return true })
}

/** Het winpunt van de laatste campagne op het account, als dat er is. */
async function winpuntVan(tx: Tx, accountId: string): Promise<string | null> {
  const [cp] = await rijen(tx, sql`select c.data->>'winpuntId' as w from campagne_items ci join campagnes c on c.id = ci.campagne_id where ci.account_id = ${accountId} order by c.updated_at desc limit 1`)
  if (!cp?.w) return null
  const stand = await leesStand(tx)
  return (stand.winpunten ?? []).find((w: any) => w.id === cp.w)?.titel ?? null
}

/** Alleen de dekking: voor de overdrachtsvoorbereiding (waarschuwing in het venster Overdragen). */
export async function dekkingVoor(tx: Tx, accountId: string) {
  const { personen } = await invloedPersonen(tx, accountId)
  return dekking(personen)
}

/** De hele kaart voor GET /api/accounts/:id/invloed. */
export async function laadInvloed(tx: Tx, accountId: string) {
  const [a] = await rijen(tx, sql`select a.id, a.name, a.nb_status, a.klasse, a.data from accounts a where a.id = ${accountId}`)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
  const { personen, contacten, committeeOp } = await invloedPersonen(tx, accountId)
  const verslagen = await invloedVerslagen(tx, accountId)
  const risico = grootsteRisico(personen)
  const winpunt = await winpuntVan(tx, accountId)
  const perContact = new Map(contacten.map((c) => [c.id, (c.data?.invloed ?? {}) as InvloedData]))
  return {
    account: { id: a.id, naam: a.name, status: a.nb_status, medewerkers: a.data?.medewerkers ?? null },
    personen: personen.map((p) => {
      const inv = perContact.get(p.id)
      return { ...p, citaten: p.onbekend ? [] : citatenVoor(p, verslagen, 3, personen.filter((x) => x.id !== p.id && !x.onbekend).map((x) => x.naam)), houdingCitaat: inv?.houdingCitaat ?? null, houdingOp: inv?.houdingOp ?? null, voorstel: inv?.voorstel ?? null }
    }),
    dekking: dekking(personen), risico, stap: voorgesteldeStap(personen, risico, winpunt), winpunt,
    verslagen: verslagen.length, committeeOp,
  }
}
