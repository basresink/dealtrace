// Gedeelde regels voor gebruikersbeheer (bouwplan 3.2, 3.3, F22).

import { and, eq, ne, sql } from 'drizzle-orm'
import { rolMag } from '../../shared/permissions'
import type { Context } from './sessie'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { verplaatsAccounts } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

/** De teams waarvan de gebruiker salesmanager is. */
export async function eigenTeams(tx: Tx, gebruikerId: string): Promise<string[]> {
  const rijen = await tx.select({ id: schema.teams.id }).from(schema.teams)
    .where(sql`${gebruikerId} = any(${schema.teams.managerIds})`)
  return rijen.map((r) => r.id)
}

/** Mag de gebruiker uit de context deze actie op de doelgebruiker? */
export async function magGebruiker(
  tx: Tx,
  ctx: Context,
  doel: { id: string; teamId: string | null },
  actie: 'lezen' | 'schrijven',
): Promise<boolean> {
  const eigen = doel.id === ctx.gebruiker.id
  const team = ctx.gebruiker.rol === 'salesmanager' && !!doel.teamId && (await eigenTeams(tx, ctx.gebruiker.id)).includes(doel.teamId)
  return rolMag(ctx.gebruiker.rol, 'gebruikers', actie, { eigen, team })
}

/** Aantal actieve beheerders behalve de opgegeven gebruiker. */
export async function andereBeheerders(tx: Tx, behalve: string): Promise<number> {
  const rijen = await tx.select({ id: schema.users.id }).from(schema.users)
    .where(and(eq(schema.users.role, 'beheerder'), eq(schema.users.status, 'actief'), ne(schema.users.id, behalve)))
  return rijen.length
}

export function gebruikerRij(u: typeof schema.users.$inferSelect) {
  return {
    id: u.id,
    naam: u.name,
    email: u.email,
    rol: u.role,
    niveau: u.niveau,
    teamId: u.teamId,
    werkplek: u.werkplek,
    laatsteInlog: u.laatsteInlog,
    status: u.status,
    eigenPortefeuille: u.role === 'salesmanager' ? u.data?.eigenPortefeuille === true : null,
  }
}

// Archiveren met overdracht, heractiveren, wijzigen en teams verwijderen (pakket B). Alleen de beheerder;
// de API-routes controleren de rol, deze functies de regels. Elke actie schrijft een auditregel.
const fout = (statusCode: number, statusMessage: string, data?: unknown): never => { throw Object.assign(new Error(statusMessage), { statusCode, statusMessage, data }) }
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Record<string, any>[]
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface ArchiveerOverdracht {
  gebruiker: { id: string; naam: string }
  prospects: number
  taken: number
  reeksen: number
  /** Standaard: de (eerste actieve) manager van het team van de gebruiker. */
  standaard: string | null
  ontvangers: { id: string; naam: string; rol: string }[]
}

/** Wat er bij archiveren verhuist en aan wie het kan. */
export async function overdrachtStand(tx: Tx, doelId: string): Promise<ArchiveerOverdracht> {
  const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, doelId))
  if (!doel) fout(404, 'Gebruiker onbekend')
  const [t] = await rijen(tx, sql`select
    (select count(*)::int from accounts where owner_id = ${doelId}) as prospects,
    (select count(*)::int from tasks where owner_id = ${doelId} and status in ('open', 'bezig')) as taken,
    (select count(*)::int from reeksen where owner_id = ${doelId} and status in ('loopt', 'gepauzeerd')) as reeksen`)
  const ontvangers = (await rijen(tx, sql`select id, name as naam, role as rol from users
    where status <> 'gearchiveerd' and id <> ${doelId} and role in ('accountmanager', 'salesmanager', 'beheerder') order by name`))
    .map((r) => ({ id: r.id as string, naam: r.naam as string, rol: r.rol as string }))
  let standaard: string | null = null
  if (doel!.teamId) {
    const [team] = await tx.select({ managerIds: schema.teams.managerIds }).from(schema.teams).where(eq(schema.teams.id, doel!.teamId))
    standaard = (team?.managerIds ?? []).find((m) => ontvangers.some((o) => o.id === m)) ?? null
  }
  return { gebruiker: { id: doel!.id, naam: doel!.name }, prospects: t?.prospects ?? 0, taken: t?.taken ?? 0, reeksen: t?.reeksen ?? 0, standaard, ontvangers }
}

/** Archiveert een gebruiker en draagt prospects, open taken en lopende reeksen over (verplicht als er iets is). */
export async function archiveerMetOverdracht(tx: Tx, org: string, actor: { id: string; rol: string }, doelId: string, naar: string | null | undefined) {
  if (doelId === actor.id) fout(409, 'Je kunt jezelf niet archiveren')
  const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, doelId))
  if (!doel) fout(404, 'Gebruiker onbekend')
  if (doel!.status === 'gearchiveerd') fout(409, 'Deze gebruiker is al gearchiveerd')
  if (doel!.role === 'beheerder' && (await andereBeheerders(tx, doelId)) === 0) fout(409, 'De laatste beheerder kun je niet archiveren')
  const stand = await overdrachtStand(tx, doelId)
  const iets = stand.prospects + stand.taken + stand.reeksen > 0
  if (iets && !naar) fout(422, 'Kies aan wie de prospects, taken en reeksen gaan')
  if (naar && !stand.ontvangers.some((o) => o.id === naar)) fout(422, 'Deze collega kan het werk niet overnemen')
  let prospects = 0
  if (iets && naar) {
    const reden = `Archivering van ${doel!.name}`
    const ids = (await rijen(tx, sql`select id from accounts where owner_id = ${doelId} order by id`)).map((r) => r.id as string)
    for (let i = 0; i < ids.length; i += 500) {
      prospects += (await verplaatsAccounts(tx, org, actor, { accountIds: ids.slice(i, i + 500), naarGebruiker: naar, reden }, { ontvangers: [naar] })).aantal
    }
    await tx.execute(sql`update tasks set owner_id = ${naar}, updated_at = now() where owner_id = ${doelId} and status in ('open', 'bezig')`)
    await tx.execute(sql`update reeksen set owner_id = ${naar}, updated_at = now() where owner_id = ${doelId} and status in ('loopt', 'gepauzeerd')`)
  }
  await tx.update(schema.users).set({ status: 'gearchiveerd', updatedAt: new Date().toISOString() }).where(eq(schema.users.id, doelId))
  const overdracht = { naar: naar ?? null, prospects, taken: stand.taken, reeksen: stand.reeksen }
  await schrijfAudit(tx, { organisationId: org, actorId: actor.id, action: 'gebruiker.archiveren', resourceType: 'users', resourceId: doelId, changes: { status: 'gearchiveerd' }, metadata: { overdracht } })
  return { ok: true, overdracht }
}

/** Zet een gearchiveerde gebruiker terug, binnen de seats van het contract (anders 409 met aanvragen). */
export async function heractiveerGebruiker(tx: Tx, org: string, actor: { id: string }, doelId: string) {
  const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, doelId))
  if (!doel) fout(404, 'Gebruiker onbekend')
  if (doel!.status !== 'gearchiveerd') fout(409, 'Deze gebruiker is niet gearchiveerd')
  const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, org))
  const seats = o?.contract?.seats ?? 0
  const n = Number((await rijen(tx, sql`select count(*)::int as n from users where status <> 'gearchiveerd'`))[0]?.n ?? 0)
  if (n >= seats) fout(409, `Alle ${seats} seats zijn in gebruik. Vraag een extra seat aan of archiveer eerst iemand anders.`, { aanvragen: true })
  const status = doel!.laatsteInlog ? 'actief' : 'uitgenodigd'
  const [nieuw] = await tx.update(schema.users).set({ status, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, doelId)).returning()
  await schrijfAudit(tx, { organisationId: org, actorId: actor.id, action: 'gebruiker.heractiveren', resourceType: 'users', resourceId: doelId, changes: { status } })
  return gebruikerRij(nieuw!)
}

/** Naam, e-mail en eigen portefeuille (alleen een salesmanager) controleren en omzetten naar een wijziging. */
export function persoonWijziging(doel: typeof schema.users.$inferSelect, b: { naam?: string; email?: string; eigenPortefeuille?: boolean }, rolNa: string) {
  const w: Partial<typeof schema.users.$inferInsert> = {}
  if (b.naam !== undefined) {
    if (typeof b.naam !== 'string' || !b.naam.trim()) fout(400, 'Naam is verplicht')
    if (b.naam.trim() !== doel.name) w.name = b.naam.trim()
  }
  if (b.email !== undefined) {
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
    if (!EMAIL.test(email)) fout(400, 'Geef een geldig e-mailadres')
    if (email !== doel.email) w.email = email
  }
  if (b.eigenPortefeuille !== undefined) {
    if (rolNa !== 'salesmanager') fout(400, 'Eigen portefeuille geldt alleen voor een salesmanager')
    if (!!b.eigenPortefeuille !== (doel.data?.eigenPortefeuille === true)) w.data = { ...(doel.data ?? {}), eigenPortefeuille: !!b.eigenPortefeuille }
  }
  return w
}

/** Verwijdert een leeg team. Met leden of teamregels: 409 met uitleg wat er eerst moet. */
export async function verwijderTeam(tx: Tx, org: string, actor: { id: string }, teamId: string) {
  const [team] = await tx.select().from(schema.teams).where(eq(schema.teams.id, teamId))
  if (!team) fout(404, 'Team onbekend')
  const [t] = await rijen(tx, sql`select
    (select count(*)::int from users where team_id = ${teamId} and status <> 'gearchiveerd') as leden,
    (select count(*)::int from activity_rules where scope = 'team' and team_id = ${teamId}) as regels`)
  const leden = t?.leden ?? 0
  const regels = t?.regels ?? 0
  if (leden || regels) {
    const delen = [
      leden ? `${leden} ${leden === 1 ? 'gebruiker staat' : 'gebruikers staan'} nog in dit team. Zet ${leden === 1 ? 'die' : 'ze'} eerst in een ander team.` : null,
      regels ? `${regels} ${regels === 1 ? 'regel geldt' : 'regels gelden'} nog voor dit team. Pas ${regels === 1 ? 'die' : 'ze'} eerst aan in Regels.` : null,
    ].filter(Boolean)
    fout(409, delen.join(' '), { leden, regels })
  }
  await tx.execute(sql`update users set team_id = null, updated_at = now() where team_id = ${teamId}`)
  await tx.execute(sql`update teams set gekoppelde_teams = array_remove(gekoppelde_teams, ${teamId}), updated_at = now() where ${teamId} = any(gekoppelde_teams)`)
  await tx.delete(schema.teams).where(eq(schema.teams.id, teamId))
  await schrijfAudit(tx, { organisationId: org, actorId: actor.id, action: 'team.verwijderen', resourceType: 'teams', resourceId: teamId, changes: { naam: team!.naam } })
  return { ok: true }
}
