// Sessie en context per verzoek (bouwplan 13.1, 15.3).
//
// Tot P27 (inloggen met een code per mail) is er alleen de ontwikkelmodus: op
// /login kies je een testgebruiker. De sessie is een ondertekende httpOnly-cookie
// met het gebruikers-id; alles wat daarna nodig is, haalt de server zelf op.

import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { eq, or, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { beschikbaar, type Weigerreden } from '../../shared/functies'
import type { FunctieRegel, GebruikerContext, Niveau, OrganisatieContext, Pakket, Rol, Werkplek } from '../../shared/types'
import { gebruikDb, metOrganisatie, schema } from './db'

export const SESSIE_COOKIE = 'dt_sessie'
const GELDIG_DAGEN = 30

function sleutel(): Uint8Array {
  return new TextEncoder().encode(useRuntimeConfig().sessieGeheim as string)
}

export async function maakSessie(event: H3Event, gebruikerId: string) {
  const token = await new SignJWT({ sub: gebruikerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${GELDIG_DAGEN}d`)
    .sign(sleutel())
  setCookie(event, SESSIE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev && getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: GELDIG_DAGEN * 24 * 3600,
  })
}

export function wisSessie(event: H3Event) {
  deleteCookie(event, SESSIE_COOKIE, { path: '/' })
}

export interface SessieGebruiker extends GebruikerContext {
  email: string
  naam: string
  organisationId: string | null
  data: schema.GebruikerData
}

export interface Context {
  gebruiker: SessieGebruiker
  /** null voor de founder buiten een organisatie. */
  organisatie: (OrganisatieContext & { naam: string }) | null
  stand: FunctieRegel[]
}

async function leesGebruiker(event: H3Event): Promise<SessieGebruiker | null> {
  const token = getCookie(event, SESSIE_COOKIE)
  if (!token) return null
  let id: string
  try {
    const { payload } = await jwtVerify(token, sleutel())
    id = String(payload.sub)
  } catch {
    return null
  }
  const res = await gebruikDb().execute(sql`select * from dealtrace_sessie_gebruiker(${id})`)
  const r = res.rows[0] as Record<string, any> | undefined
  if (!r) return null
  const data = (r.data ?? {}) as schema.GebruikerData
  return {
    id: r.id,
    email: r.email,
    naam: r.name,
    organisationId: r.organisation_id,
    rol: r.role as Rol,
    niveau: r.niveau as Niveau,
    werkplek: r.werkplek as Werkplek,
    teamId: r.team_id,
    verborgen: data.verborgen ?? [],
    data,
  }
}

/** Organisatie, instelling "Iedereen ziet alles" en de stand uit functies_per_niveau. */
export async function leesOrganisatie(organisationId: string) {
  return metOrganisatie(organisationId, async (tx) => {
    const [org] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, organisationId))
    if (!org) throw createError({ statusCode: 401, statusMessage: 'Organisatie onbekend' })
    const [niveaus] = await tx.select().from(schema.orgSettings)
      .where(sql`${schema.orgSettings.key} = 'niveaus'`)
    const regels = await tx.select().from(schema.functiesPerNiveau)
      .where(or(isNull(schema.functiesPerNiveau.organisationId), eq(schema.functiesPerNiveau.organisationId, organisationId)))
    const organisatie: OrganisatieContext & { naam: string } = {
      id: org.id,
      naam: org.name,
      pakket: org.pakket as Pakket,
      features: org.features ?? {},
      iedereenAlles: Boolean((niveaus?.value as any)?.iedereenAlles),
    }
    const stand: FunctieRegel[] = regels.map((r) => ({
      functie: r.functie, niveau: r.niveau as Niveau, aan: r.aan, organisationId: r.organisationId,
    }))
    return { organisatie, stand }
  })
}

/** De context van het verzoek; 401 zonder geldige sessie. */
export async function vereisSessie(event: H3Event): Promise<Context> {
  if (event.context.dealtrace) return event.context.dealtrace as Context
  const gebruiker = await leesGebruiker(event)
  if (!gebruiker) throw createError({ statusCode: 401, statusMessage: 'Niet ingelogd' })
  let ctx: Context
  if (!gebruiker.organisationId) {
    ctx = { gebruiker, organisatie: null, stand: [] }
  } else {
    const { organisatie, stand } = await leesOrganisatie(gebruiker.organisationId)
    ctx = { gebruiker, organisatie, stand }
  }
  event.context.dealtrace = ctx
  return ctx
}

/** Context binnen een organisatie; de founder buiten een organisatie krijgt 403 (instappen is P02). */
export async function vereisOrganisatie(event: H3Event) {
  const ctx = await vereisSessie(event)
  if (!ctx.organisatie) throw createError({ statusCode: 403, statusMessage: 'Werk eerst in een organisatie (Platformbeheer)' })
  return ctx as Context & { organisatie: NonNullable<Context['organisatie']> }
}

/** Weigert met 403 en {functie, reden} als de functie niet beschikbaar is (4.2). */
export async function vereisFunctie(event: H3Event, functie: string) {
  const ctx = await vereisOrganisatie(event)
  const b = beschikbaar(functie, ctx.gebruiker, ctx.organisatie, ctx.stand)
  if (!b.ok) weigerFunctie(functie, b.reden)
  return ctx
}

export function weigerFunctie(functie: string, reden: Weigerreden): never {
  throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar', data: { functie, reden } })
}
