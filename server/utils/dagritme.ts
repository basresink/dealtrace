// Vandaag op de server (P32): brondata laden voor één gebruiker en dezelfde rekenkern uit shared
// draaien als de client (ADR-020). Ook het signaalbesluit (Gedaan, Later, Weg) staat hier.
import { sql } from 'drizzle-orm'
import { DAG_STANDAARD, bouwDag, type DagBron, type DagInstelling } from '../../shared/dag'
import { LEGE_FOCUS, bepaalVorm, kiesFocus, kiesTip } from '../../shared/dagritme'
import { nlMoment, plusDagen } from '../../shared/datum'
import { bouwRecap } from '../../shared/recap'
import { SIGNAAL_STANDAARD, detecteerSignalen, governor, stilTot, type Besluit, type BesluitRij, type SignaalInstelling } from '../../shared/signalen'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))

export async function instelling(tx: Tx): Promise<DagInstelling & SignaalInstelling> {
  const [r] = await rijen(tx, sql`select value from org_settings where key = 'dagritme'`)
  return { ...DAG_STANDAARD, ...SIGNAAL_STANDAARD, ...((r?.value as object) ?? {}) }
}

/** Brondata van één gebruiker: eigen open taken, eigen accounts (plus accounts van eigen taken) en hun contacten. */
export async function laadBron(tx: Tx, gebruikerId: string): Promise<DagBron & { inzichten: any[]; besluiten: BesluitRij[] }> {
  const taken = await rijen(tx, sql`select id, title, action_type, status, owner_id, account_id, contact_id, due_date, priority, data from tasks where owner_id = ${gebruikerId} and status in ('open', 'bezig')`)
  const accounts = await rijen(tx, sql`select id, name, owner_id, fase_id, nb_status, terug_op, laatste_contact_op, city, data from accounts
    where owner_id = ${gebruikerId} or id in (select account_id from tasks where owner_id = ${gebruikerId} and status in ('open', 'bezig') and account_id is not null)`)
  const ids = accounts.map((a) => a.id as string)
  const contacten = ids.length ? await rijen(tx, sql`select id, account_id, first_name, last_name, rol, status, data from contacts where account_id = any(string_to_array(${ids.join(',')}, ','))`) : []
  const inzichten = await rijen(tx, sql`select id, account_id, owner_id, title, relevance_score, status, created_at, bron from signals where status in ('nieuw', 'gelezen') and (owner_id = ${gebruikerId} or owner_id is null)`)
  const besluiten = await rijen(tx, sql`select signaal_sleutel, besluit, op, stil_tot from signaal_besluiten where gebruiker_id = ${gebruikerId} and op > now() - interval '40 days'`)
  return {
    taken: taken.map((t) => ({ id: t.id, title: t.title, actionType: t.action_type, status: t.status, ownerId: t.owner_id, accountId: t.account_id, contactId: t.contact_id, dueDate: iso(t.due_date), priority: t.priority, data: t.data ?? {} })),
    accounts: accounts.map((a) => ({ id: a.id, naam: a.name, ownerId: a.owner_id, faseId: a.fase_id, nbStatus: a.nb_status, terugOp: a.terug_op ? String(iso(a.terug_op)).slice(0, 10) : null, laatsteContactOp: iso(a.laatste_contact_op), adres: a.data?.adres ?? null, plaats: a.city ?? null, telefoon: a.data?.telefoon ?? null })),
    contacten: contacten.map((c) => ({ id: c.id, accountId: c.account_id, naam: [c.first_name, c.last_name].filter(Boolean).join(' '), rol: c.rol, status: c.status, telefoon: c.data?.telefoon ?? null, mobiel: c.data?.mobiel ?? null })),
    inzichten: inzichten.map((s) => ({ id: s.id, accountId: s.account_id, ownerId: s.owner_id, title: s.title, relevanceScore: s.relevance_score, status: s.status, createdAt: iso(s.created_at)!, bron: s.bron })),
    besluiten: besluiten.map((b) => ({ sleutel: b.signaal_sleutel, besluit: b.besluit, op: iso(b.op)!, stilTot: String(iso(b.stil_tot)).slice(0, 10) })),
  }
}

/** De hele telefoonweergave: dag, focus, signaal, tip, recap. Niveau en werkplek bepalen wat meekomt (8.11). */
export async function telefoonDag(tx: Tx, g: { id: string; werkplek: string; niveau: 'beginner' | 'gevorderd' | 'expert' }, dag: string, nu: Date) {
  const inst = await instelling(tx)
  const bron = await laadBron(tx, g.id)
  const d = bouwDag(bron, { id: g.id, werkplek: g.werkplek }, dag, nu, inst)
  const vorm = bepaalVorm(nu)
  const focus = d.isVandaag ? kiesFocus(d, nu) ?? LEGE_FOCUS : null
  const signalen = detecteerSignalen(bron, { id: g.id }, nu, inst)
  const signaal = d.isVandaag && g.niveau !== 'beginner' ? governor(signalen, bron.besluiten, nu, inst) : null
  const leeg = !Object.values(d.stapels).some((l) => l.length)
  const tip = d.isVandaag && g.niveau !== 'beginner' && !signaal ? kiesTip({ nu, achterstallig: d.achterstand, leeg, werkdagEind: inst.werkdagEind }) : null
  const vandaag = nlMoment(nu).datum
  let recap = null
  if (d.isVandaag) {
    const morgen = plusDagen(vandaag, 1)
    const week = g.niveau === 'expert' ? (await rijen(tx, sql`select
        count(*) filter (where soort = 'gebeld' and uitkomst not in ('geen_reactie', 'voicemail'))::int as gesprekken,
        count(*) filter (where soort in ('afspraak', 'bezoek'))::int as afspraken,
        count(*) filter (where soort = 'reis' and data->>'naar' = 'overgedragen')::int as overgedragen
      from activiteiten where door = ${g.id} and op >= date_trunc('week', now())`))[0] : null
    recap = bouwRecap({
      zonderVerslag: d.stapels.afspraken.filter((a) => a.zonderVerslag).map((a) => ({ accountNaam: a.accountNaam, taakId: a.taakId })),
      morgenTerug: bron.accounts.filter((a) => a.ownerId === g.id && a.terugOp === morgen).map((a) => ({ id: a.id, naam: a.naam })),
      achterstallig: d.achterstand, reisStil: signalen.filter((s) => s.soort === 'reis-stil').length,
      week: week ? { gesprekken: week.gesprekken, afspraken: week.afspraken, overgedragen: week.overgedragen } : null,
    }, g.niveau, nu, vorm)
  }
  return { dag: d, focus, signaal, tip, recap, vorm, bron: { taken: bron.taken, accounts: bron.accounts, contacten: bron.contacten } }
}

/** Gedaan, Later of Weg: idempotent per gebruiker, signaal en dag. */
export async function besluit(tx: Tx, org: string, gebruikerId: string, sleutel: string, b: Besluit, op = new Date()) {
  const inst = await instelling(tx)
  const tot = stilTot(b, op, inst)
  await tx.execute(sql`insert into signaal_besluiten (organisation_id, gebruiker_id, signaal_sleutel, besluit, op, datum, stil_tot) values (${org}, ${gebruikerId}, ${sleutel}, ${b}, ${op.toISOString()}, ${nlMoment(op).datum}, ${tot})
    on conflict (gebruiker_id, signaal_sleutel, datum) do update set besluit = excluded.besluit, stil_tot = excluded.stil_tot`)
  return { sleutel, besluit: b, stilTot: tot }
}
