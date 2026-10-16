// Accountplannen op de server: lijst, detail, maken, wijzigen, verwijderen en het actieplan. Een actie is een
// taak op het account met tasks.accountplan_id; afvinken loopt via rondAf (het enige afrondpad), zodat taak en
// plan nooit uit elkaar lopen. Lezen mag iedereen met de functie; wijzigen de eigenaar van het plan, zijn
// salesmanager en de beheerder (dezelfde regel als bij taken).
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { nlMoment, nlTijdstip, volgendWerkmoment } from '../../shared/datum'
import { SECTIE_SLEUTELS, controleerPlan, sorteerPlannen, voortgang, weergaveStatus, type AccountplanSectie, type PlanInvoer } from '../../shared/accountplannen'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { magTaak, rondAf } from './taken'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
export interface PlanGebruiker { id: string; rol: string; naam?: string }
type PlanRij = typeof schema.accountplannen.$inferSelect

const fout = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })
const vandaagNl = (nu = new Date()) => nlMoment(nu).datum
const contactNaam = (c: { firstName: string | null; lastName: string }) => [c.firstName, c.lastName].filter(Boolean).join(' ')

async function mag(tx: Tx, g: PlanGebruiker, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return true
  return magTaak(tx, { gebruiker: g } as any, ownerId)
}

/** De acties (taken) per plan, zonder geannuleerde. */
async function actiesVan(tx: Tx, planIds: string[]) {
  if (!planIds.length) return []
  return tx.select({ id: schema.tasks.id, planId: schema.tasks.accountplanId, title: schema.tasks.title, status: schema.tasks.status, dueDate: schema.tasks.dueDate, contactId: schema.tasks.contactId, ownerId: schema.tasks.ownerId })
    .from(schema.tasks).where(and(inArray(schema.tasks.accountplanId, planIds), sql`${schema.tasks.status} <> 'geannuleerd'`)).orderBy(asc(schema.tasks.dueDate))
}

/** Het overzicht: alle plannen van de organisatie (of van één account), met account, eigenaar en voortgang. */
export async function accountplanLijst(tx: Tx, opties: { accountId?: string | null } = {}, nu = new Date()) {
  const vandaag = vandaagNl(nu)
  const rijen = await tx.select({ p: schema.accountplannen, accountNaam: schema.accounts.name, soort: schema.accounts.accountKind, eigenaar: schema.users.name })
    .from(schema.accountplannen)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.accountplannen.accountId))
    .leftJoin(schema.users, eq(schema.users.id, schema.accountplannen.ownerId))
    .where(opties.accountId ? eq(schema.accountplannen.accountId, opties.accountId) : undefined)
  const acties = await actiesVan(tx, rijen.map((r) => r.p.id))
  const plannen = sorteerPlannen(rijen.map((r) => ({
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

/** Eén plan met blokken, beslissers, acties (taken) en de contactpersonen van het account om uit te kiezen. */
export async function accountplanDetail(tx: Tx, id: string, g: PlanGebruiker, nu = new Date()) {
  const p = await leesPlan(tx, id)
  const [a] = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, soort: schema.accounts.accountKind, plaats: schema.accounts.city }).from(schema.accounts).where(eq(schema.accounts.id, p.accountId))
  const [eigenaar] = p.ownerId ? await tx.select({ naam: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.ownerId)) : []
  const contacten = (await tx.select({ id: schema.contacts.id, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, rol: schema.contacts.rol, status: schema.contacts.status, data: schema.contacts.data })
    .from(schema.contacts).where(eq(schema.contacts.accountId, p.accountId)).orderBy(asc(schema.contacts.lastName)))
    .map((c) => ({ id: c.id, naam: contactNaam(c), rol: c.rol, functie: (c.data as any)?.functie ?? null, vertrokken: c.status === 'vertrokken' }))
  const perContact = new Map(contacten.map((c) => [c.id, c.naam]))
  const acties = (await actiesVan(tx, [p.id])).map((t) => ({ id: t.id, titel: t.title, status: t.status, klaar: t.status === 'klaar', dueDate: t.dueDate, contactId: t.contactId, contactNaam: t.contactId ? perContact.get(t.contactId) ?? null : null }))
  const ids = p.data?.contactIds ?? []
  return {
    id: p.id, titel: p.titel, status: p.status, weergave: weergaveStatus(p, vandaagNl(nu)), geldigVan: p.geldigVan, geldigTot: p.geldigTot,
    secties: Object.fromEntries(SECTIE_SLEUTELS.map((s) => [s, p.data?.secties?.[s] ?? ''])) as Record<AccountplanSectie, string>,
    account: a ? { id: a.id, naam: a.naam, soort: a.soort === 'klant' ? 'klant' : 'prospect', plaats: a.plaats } : null,
    eigenaar: p.ownerId ? { id: p.ownerId, naam: eigenaar?.naam ?? 'Onbekend' } : null,
    beslissers: ids.map((cid) => contacten.find((c) => c.id === cid)).filter(Boolean),
    contacten, acties, voortgang: voortgang(acties),
    kan: { bewerken: await mag(tx, g, p.ownerId) },
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

async function controleerContacten(tx: Tx, accountId: string, ids: string[]) {
  if (!ids.length) return
  const bij = await tx.select({ id: schema.contacts.id }).from(schema.contacts).where(and(inArray(schema.contacts.id, ids), eq(schema.contacts.accountId, accountId)))
  if (bij.length !== ids.length) throw fout(422, 'Een contactpersoon hoort niet bij dit account')
}

/** Een nieuw plan voor een account. De maker is de eigenaar. */
export async function maakAccountplan(tx: Tx, organisationId: string, g: PlanGebruiker, b: PlanInvoer & { accountId?: unknown }) {
  const { patch, fouten } = controleerPlan(b, true)
  if (fouten.length) throw fout(422, fouten[0]!)
  const accountId = typeof b.accountId === 'string' ? b.accountId : ''
  const [a] = accountId ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.id, accountId)) : []
  if (!a) throw fout(422, 'Kies een klant of prospect')
  if (patch.contactIds) await controleerContacten(tx, a.id, patch.contactIds)
  const [p] = await tx.insert(schema.accountplannen).values({
    organisationId, accountId: a.id, ownerId: g.id, titel: patch.titel!, status: 'actueel', geldigVan: patch.geldigVan ?? null, geldigTot: patch.geldigTot ?? null,
    data: { secties: patch.secties ?? {}, contactIds: patch.contactIds ?? [] }, door: g.id,
  }).returning()
  await schrijfAudit(tx, { organisationId, actorId: g.id, action: 'accountplan.maken', resourceType: 'accountplannen', resourceId: p!.id, changes: { titel: p!.titel, accountId: a.id } })
  return p!
}

/** Wijzigt titel, periode, status, blokken (alleen wat meekomt; leeg wist) of beslissers. */
export async function wijzigAccountplan(tx: Tx, organisationId: string, id: string, g: PlanGebruiker, b: PlanInvoer) {
  const p = await leesPlan(tx, id)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const { patch, fouten } = controleerPlan(b, false)
  const van = patch.geldigVan !== undefined ? patch.geldigVan : p.geldigVan
  const tot = patch.geldigTot !== undefined ? patch.geldigTot : p.geldigTot
  if (van && tot && tot < van) fouten.push('Geldig tot ligt voor Geldig van')
  if (fouten.length) throw fout(422, fouten[0]!)
  if (patch.contactIds) await controleerContacten(tx, p.accountId, patch.contactIds)
  const secties = { ...(p.data?.secties ?? {}) }
  for (const [k, v] of Object.entries(patch.secties ?? {})) { if (v) secties[k as AccountplanSectie] = v; else delete secties[k as AccountplanSectie] }
  const [na] = await tx.update(schema.accountplannen).set({
    ...(patch.titel ? { titel: patch.titel } : {}), ...(patch.status ? { status: patch.status } : {}),
    geldigVan: van, geldigTot: tot, data: { ...(p.data ?? {}), secties, ...(patch.contactIds ? { contactIds: patch.contactIds } : {}) }, updatedAt: new Date().toISOString(),
  }).where(eq(schema.accountplannen.id, id)).returning()
  if (patch.status && patch.status !== p.status) await schrijfAudit(tx, { organisationId, actorId: g.id, action: patch.status === 'afgerond' ? 'accountplan.afronden' : 'accountplan.heropenen', resourceType: 'accountplannen', resourceId: id })
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

/** Een actie toevoegen: een taak op het account (en het gekozen contact) op de datum om 09:00. */
export async function voegPlanActieToe(tx: Tx, organisationId: string, id: string, g: PlanGebruiker, b: { titel?: unknown; datum?: unknown; contactId?: unknown }) {
  const p = await leesPlan(tx, id)
  if (!(await mag(tx, g, p.ownerId))) throw fout(403, 'Dit is niet jouw accountplan')
  const titel = typeof b.titel === 'string' ? b.titel.trim() : ''
  if (titel.length < 3) throw fout(422, 'Geef de actie een titel van minstens 3 tekens')
  const datum = typeof b.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : null
  let contactId: string | null = null
  if (typeof b.contactId === 'string' && b.contactId) { await controleerContacten(tx, p.accountId, [b.contactId]); contactId = b.contactId }
  // Zonder datum: het volgende hele werkuur, net als een nieuwe taak.
  const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
  const due = (datum ? nlTijdstip(datum, 9) : volgendWerkmoment(new Date(), werkdagen)).toISOString()
  const [t] = await tx.insert(schema.tasks).values({
    organisationId, ownerId: g.id, accountId: p.accountId, contactId, accountplanId: p.id, title: titel.slice(0, 200), actionType: 'taak', priority: 'middel', dueDate: due, executor: 'mens',
    data: { herkomst: { bron: 'accountplan', actiesoort: 'taak', uitvoerder: g.id }, aanleiding: `Actieplan: ${p.titel}` } as any,
  }).returning()
  return t!
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
