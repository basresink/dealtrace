// Sessie en context per verzoek (bouwplan 13.1, 15.3).
//
// Inloggen met een code per mail (P27); in de ontwikkelmodus kun je ook een testgebruiker
// kiezen. De sessie is een ondertekende httpOnly-cookie met het gebruikers-id en het
// toestel; een ingetrokken toestel maakt de sessie ongeldig. Alles wat daarna nodig is,
// haalt de server zelf op.

import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { eq, or, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { beschikbaar, type Weigerreden } from '../../shared/functies'
import { toestelLabel } from '../../shared/inloggen'
import type { FunctieRegel, GebruikerContext, Niveau, OrganisatieContext, Pakket, Rol, Werkplek } from '../../shared/types'
import type { WerkIn } from '../../shared/werkIn'
import { gebruikDb, metOrganisatie, schema } from './db'
import { leesWerkIn } from './werkIn'

export const SESSIE_COOKIE = 'dt_sessie'
const GELDIG_DAGEN = 30

function sleutel(): Uint8Array {
  return new TextEncoder().encode(useRuntimeConfig().sessieGeheim as string)
}

/**
 * Sessie-inhoud. `aal`: verificatieniveau (aal2 na tweestapsverificatie, P27);
 * `hb`: moment van de laatste herbevestiging (TOTP) voor gevaarlijke acties;
 * `act`: laatste activiteit, voor de founder vervalt de sessie na 12 uur stilte.
 */
export interface SessieInhoud { sub: string; aal: 'aal1' | 'aal2'; hb?: string; act?: number; tid?: string; half?: boolean }

export const PLATFORM_STIL_MS = 12 * 3600 * 1000

export async function maakSessie(event: H3Event, gebruikerId: string, extra: Partial<Omit<SessieInhoud, 'sub'>> = {}) {
  const inhoud: Record<string, unknown> = { aal: 'aal1', act: Date.now(), ...extra }
  const token = await new SignJWT(inhoud)
    .setSubject(gebruikerId)
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

export async function leesSessieInhoud(event: H3Event): Promise<SessieInhoud | null> {
  const token = getCookie(event, SESSIE_COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, sleutel())
    const inhoud: SessieInhoud = { sub: String(payload.sub), aal: payload.aal === 'aal2' ? 'aal2' : 'aal1', hb: payload.hb as string | undefined, act: payload.act as number | undefined, tid: payload.tid as string | undefined, half: payload.half === true }
    if (!inhoud.tid) return null
    // Een ingetrokken toestel ("Uitloggen op alle toestellen") maakt de sessie ongeldig.
    const [t] = await gebruikDb().select().from(schema.gebruikerToestellen).where(eq(schema.gebruikerToestellen.id, inhoud.tid))
    if (!t || t.ingetrokkenOp || t.gebruikerId !== inhoud.sub) return null
    if (Date.now() - Date.parse(t.laatstGezien) > 10 * 60_000) await gebruikDb().update(schema.gebruikerToestellen).set({ laatstGezien: new Date().toISOString() }).where(eq(schema.gebruikerToestellen.id, t.id))
    return inhoud
  } catch {
    return null
  }
}

/** Een nieuw toestel bij een geslaagde inlog. */
export async function maakToestel(event: H3Event, gebruiker: { id: string; organisationId: string | null }): Promise<string> {
  const [t] = await gebruikDb().insert(schema.gebruikerToestellen).values({ gebruikerId: gebruiker.id, organisationId: gebruiker.organisationId, label: toestelLabel(getHeader(event, 'user-agent')) }).returning({ id: schema.gebruikerToestellen.id })
  return t!.id
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
  sessie: SessieInhoud
  /** Founder die in een organisatie werkt; gebruiker is dan de founder met de rechten van een beheerder. */
  werkIn?: WerkIn & { organisatieNaam: string }
  /** De echte rol, ook als de founder in een organisatie werkt. */
  echteRol: Rol
}

async function leesGebruiker(event: H3Event, sessie: SessieInhoud): Promise<SessieGebruiker | null> {
  const res = await gebruikDb().execute(sql`select * from dealtrace_sessie_gebruiker(${sessie.sub})`)
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
  const sessie = await leesSessieInhoud(event)
  if (!sessie || sessie.half) throw createError({ statusCode: 401, statusMessage: 'Niet ingelogd' })
  const gebruiker = await leesGebruiker(event, sessie)
  if (!gebruiker) throw createError({ statusCode: 401, statusMessage: 'Niet ingelogd' })

  let ctx: Context
  if (gebruiker.rol === 'founder') {
    // Platformsessies vervallen na 12 uur stilte (15.3); daarna opnieuw inloggen.
    const nu = Date.now()
    if (!sessie.act || nu - sessie.act > PLATFORM_STIL_MS) {
      wisSessie(event)
      throw createError({ statusCode: 401, statusMessage: 'Je platformsessie is verlopen. Log opnieuw in.' })
    }
    if (nu - sessie.act > 5 * 60 * 1000) await maakSessie(event, gebruiker.id, { aal: sessie.aal, hb: sessie.hb, act: nu, tid: sessie.tid })
    const werkIn = await leesWerkIn(event, gebruiker.id)
    if (werkIn) {
      const { organisatie, stand } = await leesOrganisatie(werkIn.organisatieId)
      ctx = {
        gebruiker: { ...gebruiker, rol: 'beheerder', niveau: 'expert', teamId: null },
        organisatie, stand, sessie, echteRol: 'founder',
        werkIn: { ...werkIn, organisatieNaam: organisatie.naam },
      }
    } else {
      ctx = { gebruiker, organisatie: null, stand: [], sessie, echteRol: 'founder' }
    }
  } else {
    const { organisatie, stand } = await leesOrganisatie(gebruiker.organisationId!)
    ctx = { gebruiker, organisatie, stand, sessie, echteRol: gebruiker.rol }
  }
  event.context.dealtrace = ctx
  return ctx
}

/** Context binnen een organisatie; de founder buiten een organisatie krijgt 403. */
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
