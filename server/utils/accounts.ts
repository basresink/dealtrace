// Gedeelde serverlogica voor accounts en contacten (P03). Rekenregels staan in
// shared/ (score, laatste contact, primair contact, ontdubbelen); hier alleen laden en opslaan.
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { AccountRij } from '../../shared/accountFilters'
import { primairContact, sorteerContacten, ontbrekendeRollen } from '../../shared/contactgegevens'
import { veldenVoorNiveau, type VeldDefinitie } from '../../shared/eigenVelden'
import { berekenScore, laatsteContact } from '../../shared/score'
import type { Niveau } from '../../shared/types'
import { schema } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export async function eigenVeldenVoor(tx: Tx, object: string, niveau: Niveau, alles = false): Promise<(VeldDefinitie & { id: string })[]> {
  const rijen = await tx.select().from(schema.eigenVelden).where(eq(schema.eigenVelden.object, object)).orderBy(schema.eigenVelden.sectie, schema.eigenVelden.volgorde)
  const defs = rijen.map((r) => ({ id: r.id, object: r.object as any, sleutel: r.sleutel, naam: r.naam, type: r.type as any, sectie: r.sectie, volgorde: r.volgorde, gearchiveerd: r.gearchiveerd, data: r.data ?? {} }))
  return alles ? defs : veldenVoorNiveau(defs, niveau)
}

/** Alleen de eigen velden die dit niveau mag zien gaan mee in een respons. */
export function zichtbareCustomFields(cf: Record<string, unknown> | undefined, zichtbaar: { sleutel: string }[]): Record<string, unknown> {
  const toegestaan = new Set(zichtbaar.map((v) => v.sleutel))
  return Object.fromEntries(Object.entries(cf ?? {}).filter(([k]) => toegestaan.has(k)))
}

export async function accountRijen(tx: Tx, soort: 'prospect' | 'klant', zichtbareVelden: { sleutel: string }[]): Promise<AccountRij[]> {
  const accounts = await tx.select().from(schema.accounts).where(eq(schema.accounts.accountKind, soort))
  if (!accounts.length) return []
  const contacten = await tx.select({ accountId: schema.contacts.accountId, id: schema.contacts.id, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, rol: schema.contacts.rol, status: schema.contacts.status, email: schema.contacts.email, data: schema.contacts.data, updatedAt: schema.contacts.updatedAt })
    .from(schema.contacts).where(inArray(schema.contacts.accountId, accounts.map((a) => a.id)))
  const teams = new Map((await tx.select({ id: schema.users.id, teamId: schema.users.teamId }).from(schema.users)).map((u) => [u.id, u.teamId]))
  const perAccount = new Map<string, typeof contacten>()
  for (const c of contacten) (perAccount.get(c.accountId) ?? perAccount.set(c.accountId, []).get(c.accountId)!).push(c)
  return accounts.map((a) => ({
    id: a.id, name: a.name, city: a.city, klasse: a.klasse, ownerId: a.ownerId, ownerTeamId: a.ownerId ? teams.get(a.ownerId) ?? null : null,
    nbStatus: a.nbStatus, gedeactiveerd: !!a.gedeactiveerdOp, gedeactiveerdOp: a.gedeactiveerdOp, score: a.score, aanleiding: a.data?.aanleiding ?? null, laatsteContactOp: a.laatsteContactOp, faseSinds: a.faseSinds, faseId: a.faseId, reisId: a.reisId,
    telefoon: a.data?.telefoon ?? null, email: a.data?.email ?? null,
    contacten: sorteerContacten((perAccount.get(a.id) ?? []).map((c) => ({ id: c.id, naam: `${c.firstName ?? ''} ${c.lastName}`.trim(), rol: c.rol, status: c.status, email: c.email, telefoon: c.data?.telefoon ?? null, mobiel: c.data?.mobiel ?? null, updatedAt: c.updatedAt, fotoUrl: typeof c.data?.fotoId === 'string' ? `/api/bijlagen/${c.data.fotoId}` : null }))),
    cf: zichtbareCustomFields(a.data?.customFields, zichtbareVelden),
    // extra velden voor de rij
    website: a.data?.website ?? null, linkedin: a.data?.linkedin ?? null, branche: a.data?.branche ?? null, domein: a.domein, kind: a.accountKind,
    logoUrl: (a.data as any)?.logoUrl ?? null, logoUit: !!(a.data as any)?.logoUit,
  } as AccountRij & Record<string, unknown>))
}

/** Herberekent laatste contact en score van een account (na elke wijziging die ertoe doet). */
export async function herbereken(tx: Tx, accountId: string, nu = new Date()) {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) return null
  const contacten = await tx.select().from(schema.contacts).where(eq(schema.contacts.accountId, accountId))
  const acts = await tx.select({ soort: schema.activiteiten.soort, op: schema.activiteiten.op, data: schema.activiteiten.data }).from(schema.activiteiten).where(inArray(schema.activiteiten.accountId, [accountId, ...(a.data?.samengevoegdUit ?? [])]))
  const lc = laatsteContact(acts.map((x) => ({ soort: x.soort, op: x.op, status: (x.data as any)?.status ?? 'afgerond', bron: (x.data as any)?.bron })), nu)
  const s = berekenScore({
    nu, laatsteContactOp: lc, aanleidingen: a.data?.aanleiding ? [a.data.aanleiding] : [],
    contacten: contacten.map((c) => ({ rol: c.rol, status: c.status, telefoon: c.data?.telefoon, mobiel: c.data?.mobiel, email: c.email })),
  })
  await tx.update(schema.accounts).set({ score: s.score, laatsteContactOp: lc, data: { ...a.data, scoreOpbouw: s.opbouw }, updatedAt: nu.toISOString() }).where(eq(schema.accounts.id, accountId))
  return s
}

export function contactUit(c: typeof schema.contacts.$inferSelect, zichtbaar: { sleutel: string }[]) {
  return {
    id: c.id, accountId: c.accountId, voornaam: c.firstName, achternaam: c.lastName, naam: `${c.firstName ?? ''} ${c.lastName}`.trim(),
    email: c.email, rol: c.rol, status: c.status, functie: c.data?.functie ?? null, telefoon: c.data?.telefoon ?? null, mobiel: c.data?.mobiel ?? null,
    linkedin: c.data?.linkedin ?? null, consent: c.data?.consent ?? {}, voorkeurskanaal: c.data?.voorkeurskanaal ?? null, belMeNiet: !!c.data?.belMeNiet,
    vertrokkenOp: c.data?.vertrokkenOp ?? null, bron: c.data?.bron ?? null, herkomst: c.data?.herkomst?.naam ?? null, zekerheid: c.data?.zekerheid ?? null, updatedAt: c.updatedAt,
    customFields: zichtbareCustomFields(c.data?.customFields, zichtbaar),
    // Foto (bijlage met record_soort 'contact'), sociale kanalen en eigen bronnen (opzet uit DealDrive).
    fotoUrl: typeof c.data?.fotoId === 'string' ? `/api/bijlagen/${c.data.fotoId}` : null,
    instagram: (c.data?.instagram as string | undefined) ?? null, facebook: (c.data?.facebook as string | undefined) ?? null,
    extraBronnen: Array.isArray(c.data?.extraBronnen) ? c.data.extraBronnen as { label: string; url: string }[] : [],
  }
}

export { primairContact, ontbrekendeRollen, and, desc, sql }

/** Het niveau voor zichtbaarheid; "Iedereen ziet alles" telt als Expert. */
export function effectiefNiveau(ctx: { gebruiker: { niveau: Niveau }; organisatie: { iedereenAlles: boolean } }): Niveau {
  return ctx.organisatie.iedereenAlles ? 'expert' : ctx.gebruiker.niveau
}

/** Beschikbaar? Zonder 403, voor het tonen van knoppen. */
export function kan(ctx: any, functie: string): boolean {
  return beschikbaarFn(functie, ctx.gebruiker, ctx.organisatie, ctx.stand).ok
}
import { beschikbaar as beschikbaarFn } from '../../shared/functies'
