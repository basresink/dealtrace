// Accountplannen op de server: lijst, detail, keuzes voor het aanmaakformulier, maken (met contactpersonen,
// blokken, eigen velden en acties), wijzigen (ook eigenaar), afronden, verwijderen, notities, het actieplan
// en de plannen per contact. Een actie is een taak op het account met tasks.accountplan_id; afvinken loopt
// via rondAf (het enige afrondpad), zodat taak en plan nooit uit elkaar lopen.
// Rechten: lezen mag iedereen met de functie (zoals taken); wijzigen, afronden, verwijderen en acties beheren
// de eigenaar van het plan, zijn salesmanager (team) en de beheerder (magTaak). Eigenaar worden kan alleen
// wie jij mag aansturen: jezelf, als salesmanager je teamleden, als beheerder iedereen.
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { nlMoment, nlTijdstip, volgendWerkmoment } from '../../shared/datum'
import { valideerWaarde } from '../../shared/eigenVelden'
import {
  SECTIE_SLEUTELS, bestaandPlanWaarschuwing, controleerNotitie, controleerPlan, sorteerPlannen, voortgang, weergaveStatus,
  type AccountplanSectie, type ActieInvoer, type PlanInvoer,
} from '../../shared/accountplannen'
import type { Niveau } from '../../shared/types'
import { eigenVeldenVoor } from './accounts'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { eigenTeams } from './gebruikers'
import { magTaak, rondAf } from './taken'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
export interface PlanGebruiker { id: string; rol: string; naam?: string; niveau?: Niveau }
type PlanRij = typeof schema.accountplannen.$inferSelect

const fout = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })
const vandaagNl = (nu = new Date()) => nlMoment(nu).datum
const contactNaam = (c: { firstName: string | null; lastName: string }) => [c.firstName, c.lastName].filter(Boolean).join(' ')
const rijen = async (tx: Tx, q: any) => (await tx.execute(q)).rows as any[]
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null)

async function mag(tx: Tx, g: PlanGebruiker, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return true
  return magTaak(tx, { gebruiker: g } as any, ownerId)
}

/** Wie jij eigenaar van een plan mag maken: jezelf, je teamleden (salesmanager) of iedereen (beheerder). */
export async function eigenarenVoor(tx: Tx, g: PlanGebruiker): Promise<{ id: string; naam: string }[]> {
  const basis = tx.select({ id: schema.users.id, naam: schema.users.name, teamId: schema.users.teamId, rol: schema.users.role }).from(schema.users)
    .where(and(eq(schema.users.status, 'actief'), sql`${schema.users.role} in ('accountmanager', 'salesmanager', 'beheerder')`)).orderBy(asc(schema.users.name))
  const alle = await basis
  let lijst = alle.filter((u) => u.id === g.id)
  if (g.rol === 'beheerder') lijst = alle
  else if (g.rol === 'salesmanager') {
    const teams = await eigenTeams(tx, g.id)
    lijst = alle.filter((u) => u.id === g.id || (!!u.teamId && teams.includes(u.teamId)))
  }
  if (!lijst.some((u) => u.id === g.id)) lijst.unshift({ id: g.id, naam: g.naam ?? 'Jij', teamId: null, rol: g.rol })
  return lijst.map((u) => ({ id: u.id, naam: u.naam }))
}

/** De contactpersonen van een account met rol en functie; vertrokken mensen staan erin, gemarkeerd. */
async function contactenVan(tx: Tx, accountId: string) {
  return (await tx.select({ id: schema.contacts.id, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, rol: schema.contacts.rol, status: schema.contacts.status, email: schema.contacts.email, data: schema.contacts.data })
    .from(schema.contacts).where(eq(schema.contacts.accountId, accountId)).orderBy(asc(schema.contacts.lastName)))
    .map((c) => ({ id: c.id, naam: contactNaam(c), rol: c.rol, functie: (c.data as any)?.functie ?? null, email: c.email, vertrokken: c.status === 'vertrokken' }))
}

/** De eigen velden met object accountplan die dit niveau mag zien. */
async function veldDefs(tx: Tx, g: PlanGebruiker) {
  return (await eigenVeldenVoor(tx, 'accountplan', g.niveau ?? 'expert')).map((v) => ({ sleutel: v.sleutel, naam: v.naam, type: v.type, sectie: v.sectie, opties: v.data.opties ?? [], hulp: v.data.hulp ?? null }))
}

/** Controleert eigen velden tegen de definities: onbekende sleutels en ongeldige waarden geven 422. */
async function controleerVelden(tx: Tx, g: PlanGebruiker, velden: Record<string, unknown>, huidig: Record<string, unknown> = {}) {
  const defs = await eigenVeldenVoor(tx, 'accountplan', g.niveau ?? 'expert')
  const uit = { ...huidig }
  for (const [k, v] of Object.entries(velden)) {
    const def = defs.find((d) => d.sleutel === k)
    if (!def) throw fout(422, `Onbekend veld: ${k}`)
    const r = valideerWaarde(def, v)
    if (!r.ok) throw fout(422, r.fout)
    if (r.waarde === null) delete uit[k]
    else uit[k] = r.waarde
  }
  return uit
}

/** De acties (taken) per plan, zonder geannuleerde. */
async function actiesVan(tx: Tx, planIds: string[]) {
  if (!planIds.length) return []
  return tx.select({ id: schema.tasks.id, planId: schema.tasks.accountplanId, title: schema.tasks.title, status: schema.tasks.status, dueDate: schema.tasks.dueDate, contactId: schema.tasks.contactId, ownerId: schema.tasks.ownerId })
    .from(schema.tasks).where(and(inArray(schema.tasks.accountplanId, planIds), sql`${schema.tasks.status} <> 'geannuleerd'`)).orderBy(asc(schema.tasks.dueDate))
}

/** Het overzicht: alle plannen van de organisatie (of van één account), met account, eigenaar en voortgang. */
export async function accountplanLijst(tx: Tx, opties: { accountId?: string | null; eigenaarId?: string | null } = {}, nu = new Date()) {
  const vandaag = vandaagNl(nu)
  const waar = [opties.accountId ? eq(schema.accountplannen.accountId, opties.accountId) : undefined, opties.eigenaarId ? eq(schema.accountplannen.ownerId, opties.eigenaarId) : undefined].filter(Boolean)
  const rijen0 = await tx.select({ p: schema.accountplannen, accountNaam: schema.accounts.name, soort: schema.accounts.accountKind, eigenaar: schema.users.name })
    .from(schema.accountplannen)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.accountplannen.accountId))
    .leftJoin(schema.users, eq(schema.users.id, schema.accountplannen.ownerId))
    .where(waar.length ? and(...(waar as any[])) : undefined)
  const acties = await actiesVan(tx, rijen0.map((r) => r.p.id))
  const plannen = sorteerPlannen(rijen0.map((r) => ({
    id: r.p.id, titel: r.p.titel, status: r.p.status, weergave: weergaveStatus(r.p, vandaag),
    geldigVan: r.p.geldigVan, geldigTot: r.p.geldigTot, createdAt: r.p.createdAt,
    account: { id: r.p.accountId, naam: r.accountNaam, soort: r.soort === 'klant' ? 'klant' : 'prospect' },
    eigenaar: r.p.ownerId ? { id: r.p.ownerId, naam: r.eigenaar ?? 'Onbekend' } : null,
    acties: voortgang(acties.filter((a) => a.planId === r.p.id)),
  })))
  return { plannen, actueel: plannen.filter((p) => p.weergave === 'actueel').length }
}

async function leesPlan(tx: Tx, id: string): Promise<PlanRij> {
  const [p] = await tx.select().from(schema.accountplannen).where(eq(schema.accountplannen.id, id))
  if (!p) throw fout(404, 'Accountplan onbekend')
  return p
}

async function leesProspect(tx: Tx, accountId: unknown) {
  const id = typeof accountId === 'string' ? accountId : ''
  const [a] = id ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, soort: schema.accounts.accountKind, plaats: schema.accounts.city }).from(schema.accounts).where(eq(schema.accounts.id, id)) : []
  if (!a) throw fout(422, 'Kies een prospect')
  // Een plan is voor een topprospect; een plan voor een klant hoort in DealDrive.
  if (a.soort === 'klant') throw fout(422, 'Een plan voor een klant maak je in DealDrive')
  return a
}

/**
 * Wat het aanmaakformulier nodig heeft: wie eigenaar kan worden, de eigen velden en, met een account, de
 * contactpersonen en de waarschuwing als er al een actueel plan loopt.
 */
export async function accountplanOpties(tx: Tx, g: PlanGebruiker, accountId?: string | null, nu = new Date()) {
  const basis = { eigenaren: await eigenarenVoor(tx, g), velden: await veldDefs(tx, g) }
  if (!accountId) return { ...basis, account: null, contacten: [], waarschuwing: null }
  const a = await leesProspect(tx, accountId)
  const lopend = (await tx.select({ status: schema.accountplannen.status, geldigTot: schema.accountplannen.geldigTot }).from(schema.accountplannen).where(eq(schema.accountplannen.accountId, a.id)))
    .filter((p) => weergaveStatus(p, vandaagNl(nu)) === 'actueel').length
  return { ...basis, account: { id: a.id, naam: a.naam, plaats: a.plaats }, contacten: await contactenVan(tx, a.id), waarschuwing: bestaandPlanWaarschuwing(a.naam, lopend) }
}

/** Eén plan met blokken, contactpersonen (met rol), acties, notities, eigen velden en de taken en afspraken van het account. */
export async function accountplanDetail(tx: Tx, id: string, g: PlanGebruiker, nu = new Date()) {
  const p = await leesPlan(tx, id)
  const [a] = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, soort: schema.accounts.accountKind, plaats: schema.accounts.city }).from(schema.accounts).where(eq(schema.accounts.id, p.accountId))
  const [eigenaar] = p.ownerId ? await tx.select({ naam: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.ownerId)) : []
  const contacten = await contactenVan(tx, p.accountId)
  const perContact = new Map(contacten.map((c) => [c.id, c.naam]))
  const acties = (await actiesVan(tx, [p.id])).map((t) => ({ id: t.id, titel: t.title, status: t.status, klaar: t.status === 'klaar', dueDate: t.dueDate, contactId: t.contactId, contactNaam: t.contactId ? perContact.get(t.contactId) ?? null : null }))
  const ids = p.data?.contactIds ?? []
  const kanBewerken = await mag(tx, g, p.ownerId)
  // Notities met de naam van wie ze schreef.
  const notities = p.data?.notities ?? []
  const auteurs = notities.length ? await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users).where(inArray(schema.users.id, [...new Set(notities.map((n) => n.door).filter(Boolean) as string[])].concat('-'))) : []
  // Wat er verder bij dit account loopt (tabbladen Taken en Afspraken): open taken buiten het plan en de afspraken.
  const taken = (await rijen(tx, sql`select t.id, t.title, t.status, t.action_type, t.due_date, t.contact_id, u.name as eigenaar from tasks t left join users u on u.id = t.owner_id
    where t.account_id = ${p.accountId} and t.status in ('open', 'bezig') and (t.accountplan_id is null or t.accountplan_id <> ${p.id}) order by t.due_date nulls last limit 50`))
    .map((t) => ({ id: t.id, titel: t.title, status: t.status, soort: t.action_type, dueDate: iso(t.due_date), contactNaam: t.contact_id ? perContact.get(t.contact_id) ?? null : null, eigenaar: t.eigenaar }))
  const afspraken = (await rijen(tx, sql`select a.id, a.start_at, a.status, a.vorm, a.contact_id, a.data->>'titel' as titel, a.data->>'locatie' as locatie, m.naam as soort from appointments a left join meetingsoorten m on m.id = a.meetingsoort_id
    where a.account_id = ${p.accountId} order by a.start_at desc limit 30`))
    .map((x) => ({ id: x.id, start: iso(x.start_at), status: x.status, titel: x.titel || x.soort || 'Afspraak', locatie: x.locatie, contactNaam: x.contact_id ? perContact.get(x.contact_id) ?? null : null }))
  const velden = await veldDefs(tx, g)
  return {
    id: p.id, titel: p.titel, status: p.status, weergave: weergaveStatus(p, vandaagNl(nu)), geldigVan: p.geldigVan, geldigTot: p.geldigTot,
    secties: Object.fromEntries(SECTIE_SLEUTELS.map((s) => [s, p.data?.secties?.[s] ?? ''])) as Record<AccountplanSectie, string>,
    account: a ? { id: a.id, naam: a.naam, soort: a.soort === 'klant' ? 'klant' : 'prospect', plaats: a.plaats } : null,
    eigenaar: p.ownerId ? { id: p.ownerId, naam: eigenaar?.naam ?? 'Onbekend' } : null,
    beslissers: ids.map((cid) => contacten.find((c) => c.id === cid)).filter(Boolean),
    contacten, acties, voortgang: voortgang(acties),
    notities: [...notities].sort((x, y) => y.op.localeCompare(x.op)).map((n) => ({ ...n, doorNaam: auteurs.find((u) => u.id === n.door)?.naam ?? null, kanWeg: kanBewerken || n.door === g.id })),
    velden: velden.map((v) => ({ ...v, waarde: p.data?.velden?.[v.sleutel] ?? null })),
    taken, afspraken,
    eigenaren: kanBewerken ? await eigenarenVoor(tx, g) : [],
    kan: { bewerken: kanBewerken, verwijderen: kanBewerken },
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

async function controleerContacten(tx: Tx, accountId: string, ids: string[]) {
  if (!ids.length) return
  const bij = await tx.select({ id: schema.contacts.id }).from(schema.contacts).where(and(inArray(schema.contacts.id, ids), eq(schema.contacts.accountId, accountId)))
  if (bij.length !== ids.length) throw fout(422, 'Een contactpersoon hoort niet bij dit account')
}

/** Mag g deze gebruiker eigenaar maken? Jezelf altijd; anders alleen wie je aanstuurt (magTaak). */
async function controleerEigenaar(tx: Tx, g: PlanGebruiker, eigenaarId: string) {
  if (eigenaarId === g.id) return
  const [u] = await tx.select({ id: schema.users.id, status: schema.users.status }).from(schema.users).where(eq(schema.users.id, eigenaarId))
  if (!u || u.status !== 'actief') throw fout(422, 'Onbekende eigenaar')
  if (!(await mag(tx, g, eigenaarId))) throw fout(403, 'Je kunt alleen jezelf of je eigen teamleden eigenaar maken')
}

/** Een actie wordt een taak op het account (en het gekozen contact), op de datum om 09:00, van de eigenaar van het plan. */
async function maakActieTaak(tx: Tx, organisationId: string, p: PlanRij, g: PlanGebruiker, a: ActieInvoer) {
  if (a.contactId) await controleerContacten(tx, p.accountId, [a.contactId])
  // Zonder datum: het volgende hele werkuur, net als een nieuwe taak.
  const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
  const due = (a.datum ? nlTijdstip(a.datum, 9) : volgendWerkmoment(new Date(), werkdagen)).toISOString()
  const owner = p.ownerId ?? g.id
  const [t] = await tx.insert(schema.tasks).values({
    organisationId, ownerId: owner, accountId: p.accountId, contactId: a.contactId, accountplanId: p.id, title: a.titel.slice(0, 200), actionType: 'taak', priority: 'middel', dueDate: due, executor: 'mens',
    data: { herkomst: { bron: 'accountplan', actiesoort: 'taak', uitvoerder: owner, door: g.id }, aanleiding: `Actieplan: ${p.titel}` } as any,
  }).returning()
  return t!
}

/**
 * Een nieuw plan voor een prospect, in één keer met alles wat het formulier heeft: eigenaar (standaard de
 * maker), periode, contactpersonen, blokken, eigen velden en acties (die meteen een taak worden).
 */
export async function maakAccountplan(tx: Tx, organisationId: string, g: PlanGebruiker, b: PlanInvoer & { accountId?: unknown }) {
  const { patch, fouten } = controleerPlan(b, true)
  if (fouten.length) throw fout(422, fouten[0]!)
  const a = await leesProspect(tx, b.accountId)
  const eigenaarId = patch.eigenaarId ?? g.id
  await controleerEigenaar(tx, g, eigenaarId)
  if (patch.contactIds) await controleerContacten(tx, a.id, patch.contactIds)
  for (const x of patch.acties ?? []) if (x.contactId) await controleerContacten(tx, a.id, [x.contactId])
  const velden = patch.velden ? await controleerVelden(tx, g, patch.velden) : {}
  const secties = Object.fromEntries(Object.entries(patch.secties ?? {}).filter(([, v]) => v))
  const [p] = await tx.insert(schema.accountplannen).values({
    organisationId, accountId: a.id, ownerId: eigenaarId, titel: patch.titel!, status: 'actueel', geldigVan: patch.geldigVan ?? null, geldigTot: patch.geldigTot ?? null,
    data: { secties, contactIds: patch.contactIds ?? [], ...(Object.keys(velden).length ? { velden } : {}) }, door: g.id,
  }).returning()
  for (const x of patch.acties ?? []) await maakActieTaak(tx, organisationId, p!, g, x)
  await schrijfAudit(tx, { organisationId, actorId: g.id, action: 'accountplan.maken', resourceType: 'accountplannen', resourceId: p!.id, changes: { titel: p!.titel, accountId: a.id, eigenaarId, acties: patch.acties?.length ?? 0 } })
  return p!
}

/** Wijzigt titel, periode, status, eigenaar, blokken (alleen wat meekomt; leeg wist), contactpersonen of eigen velden. */
export async function wijzigAccountplan(tx: Tx, organisationId: string, id: string, g: PlanGebruiker, b: PlanInvoer) {
  const p = await leesPlan(tx, id)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const { patch, fouten } = controleerPlan(b, false)
  const van = patch.geldigVan !== undefined ? patch.geldigVan : p.geldigVan
  const tot = patch.geldigTot !== undefined ? patch.geldigTot : p.geldigTot
  if (van && tot && tot < van) fouten.push('Geldig tot ligt voor Geldig van')
  if (fouten.length) throw fout(422, fouten[0]!)
  if (patch.contactIds) await controleerContacten(tx, p.accountId, patch.contactIds)
  if (patch.eigenaarId && patch.eigenaarId !== p.ownerId) await controleerEigenaar(tx, g, patch.eigenaarId)
  const secties = { ...(p.data?.secties ?? {}) }
  for (const [k, v] of Object.entries(patch.secties ?? {})) { if (v) secties[k as AccountplanSectie] = v; else delete secties[k as AccountplanSectie] }
  const velden = patch.velden ? await controleerVelden(tx, g, patch.velden, p.data?.velden ?? {}) : p.data?.velden
  const [na] = await tx.update(schema.accountplannen).set({
    ...(patch.titel ? { titel: patch.titel } : {}), ...(patch.status ? { status: patch.status } : {}), ...(patch.eigenaarId ? { ownerId: patch.eigenaarId } : {}),
    geldigVan: van, geldigTot: tot,
    data: { ...(p.data ?? {}), secties, ...(patch.contactIds ? { contactIds: patch.contactIds } : {}), ...(velden ? { velden } : {}) }, updatedAt: new Date().toISOString(),
  }).where(eq(schema.accountplannen.id, id)).returning()
  if (patch.status && patch.status !== p.status) await schrijfAudit(tx, { organisationId, actorId: g.id, action: patch.status === 'afgerond' ? 'accountplan.afronden' : 'accountplan.heropenen', resourceType: 'accountplannen', resourceId: id })
  if (patch.eigenaarId && patch.eigenaarId !== p.ownerId) await schrijfAudit(tx, { organisationId, actorId: g.id, action: 'accountplan.eigenaar', resourceType: 'accountplannen', resourceId: id, changes: { van: p.ownerId, naar: patch.eigenaarId } })
  return na!
}

/** Verwijdert het plan; de acties blijven als taak op het account staan (accountplan_id gaat op null). */
export async function verwijderAccountplan(tx: Tx, organisationId: string, id: string, g: PlanGebruiker) {
  const p = await leesPlan(tx, id)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  await tx.delete(schema.accountplannen).where(eq(schema.accountplannen.id, id))
  await schrijfAudit(tx, { organisationId, actorId: g.id, action: 'accountplan.verwijderen', resourceType: 'accountplannen', resourceId: id, changes: { titel: p.titel } })
  return { id }
}

/** Een actie toevoegen aan een bestaand plan: een taak op het account voor de eigenaar van het plan. */
export async function voegPlanActieToe(tx: Tx, organisationId: string, id: string, g: PlanGebruiker, b: { titel?: unknown; datum?: unknown; contactId?: unknown }) {
  const p = await leesPlan(tx, id)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const titel = typeof b.titel === 'string' ? b.titel.trim() : ''
  if (titel.length < 3) throw fout(422, 'Geef de actie een titel van minstens 3 tekens')
  const datum = typeof b.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : null
  const contactId = typeof b.contactId === 'string' && b.contactId ? b.contactId : null
  return maakActieTaak(tx, organisationId, p, g, { titel, datum, contactId })
}

async function leesActie(tx: Tx, planId: string, taakId: string) {
  const [t] = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.id, taakId), eq(schema.tasks.accountplanId, planId), isNotNull(schema.tasks.accountplanId)))
  if (!t) throw fout(404, 'Actie onbekend')
  return t
}

/** Afvinken rondt de taak af via rondAf; uitvinken zet hem weer open. */
export async function zetPlanActie(tx: Tx, planId: string, taakId: string, g: PlanGebruiker, klaar: boolean) {
  const p = await leesPlan(tx, planId)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const t = await leesActie(tx, planId, taakId)
  if (t.ownerId && !(await mag(tx, g, t.ownerId))) throw fout(403, 'Dit is niet jouw taak')
  if (klaar && t.status !== 'klaar') await rondAf(tx, t.id, { uitkomst: null, laterOp: null, reden: null, toelichting: null, sleutel: null } as any, g.id)
  if (!klaar && t.status === 'klaar') {
    const { afronding: _weg, ...rest } = (t.data ?? {}) as any
    await tx.update(schema.tasks).set({ status: 'open', uitkomst: null, data: rest, updatedAt: new Date().toISOString() }).where(eq(schema.tasks.id, t.id))
  }
  return { id: t.id, klaar }
}

/** Uit het plan halen: de taak wordt geannuleerd met een reden. */
export async function haalPlanActieWeg(tx: Tx, planId: string, taakId: string, g: PlanGebruiker) {
  const p = await leesPlan(tx, planId)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const t = await leesActie(tx, planId, taakId)
  await tx.update(schema.tasks).set({ status: 'geannuleerd', data: { ...(t.data ?? {}), annuleerReden: `Uit het accountplan "${p.titel}" gehaald` }, updatedAt: new Date().toISOString() }).where(eq(schema.tasks.id, t.id))
  return { id: t.id, status: 'geannuleerd' }
}

/** Een notitie bij het plan (nieuwste eerst). Schrijven mag wie het plan mag wijzigen. */
export async function voegNotitieToe(tx: Tx, organisationId: string, id: string, g: PlanGebruiker, tekst: unknown) {
  const p = await leesPlan(tx, id)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const c = controleerNotitie(tekst)
  if (c.fout) throw fout(422, c.fout)
  const n = { id: crypto.randomUUID(), tekst: c.tekst!, door: g.id, op: new Date().toISOString() }
  await tx.update(schema.accountplannen).set({ data: { ...(p.data ?? {}), notities: [n, ...(p.data?.notities ?? [])].slice(0, 200) }, updatedAt: n.op }).where(eq(schema.accountplannen.id, id))
  await schrijfAudit(tx, { organisationId, actorId: g.id, action: 'accountplan.notitie', resourceType: 'accountplannen', resourceId: id })
  return n
}

/** Een notitie weghalen: de schrijver zelf, of wie het plan mag wijzigen. */
export async function verwijderNotitie(tx: Tx, id: string, notitieId: string, g: PlanGebruiker) {
  const p = await leesPlan(tx, id)
  const n = (p.data?.notities ?? []).find((x) => x.id === notitieId)
  if (!n) throw fout(404, 'Notitie onbekend')
  if (n.door !== g.id && !(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw notitie')
  await tx.update(schema.accountplannen).set({ data: { ...(p.data ?? {}), notities: (p.data?.notities ?? []).filter((x) => x.id !== notitieId) }, updatedAt: new Date().toISOString() }).where(eq(schema.accountplannen.id, id))
  return { id: notitieId }
}

/**
 * De plannen waar een contactpersoon in voorkomt (voor de contactkaart): als contactpersoon van het plan
 * (data.contactIds) en/of met een actie in het actieplan.
 */
export async function plannenVanContact(tx: Tx, contactId: string, nu = new Date()) {
  const [c] = await tx.select({ id: schema.contacts.id, accountId: schema.contacts.accountId }).from(schema.contacts).where(eq(schema.contacts.id, contactId))
  if (!c) throw fout(404, 'Contact onbekend')
  const ps = await tx.select({ p: schema.accountplannen, accountNaam: schema.accounts.name, eigenaar: schema.users.name })
    .from(schema.accountplannen).innerJoin(schema.accounts, eq(schema.accounts.id, schema.accountplannen.accountId)).leftJoin(schema.users, eq(schema.users.id, schema.accountplannen.ownerId))
    .where(eq(schema.accountplannen.accountId, c.accountId)).orderBy(desc(schema.accountplannen.createdAt))
  const acties = await actiesVan(tx, ps.map((r) => r.p.id))
  const vandaag = vandaagNl(nu)
  const plannen = ps.map((r) => {
    const eigen = acties.filter((a) => a.planId === r.p.id && a.contactId === contactId)
    const inPlan = (r.p.data?.contactIds ?? []).includes(contactId)
    return {
      id: r.p.id, titel: r.p.titel, weergave: weergaveStatus(r.p, vandaag), geldigVan: r.p.geldigVan, geldigTot: r.p.geldigTot,
      account: { id: r.p.accountId, naam: r.accountNaam }, eigenaar: r.p.ownerId ? { id: r.p.ownerId, naam: r.eigenaar ?? 'Onbekend' } : null,
      alsContactpersoon: inPlan, acties: eigen.map((a) => ({ id: a.id, titel: a.title, klaar: a.status === 'klaar', dueDate: a.dueDate })),
      voortgang: voortgang(acties.filter((a) => a.planId === r.p.id)),
    }
  }).filter((p) => p.alsContactpersoon || p.acties.length)
  return { contactId, plannen: sorteerPlannen(plannen) }
}
