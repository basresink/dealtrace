// Gedeelde regels voor gebruikersbeheer (bouwplan 3.2, 3.3, F22).

import { and, eq, ne, sql } from 'drizzle-orm'
import { rolMag } from '../../shared/permissions'
import type { Context } from './sessie'
import { schema } from './db'

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
  }
}
