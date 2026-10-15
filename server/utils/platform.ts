// Platformlaag (F23, 15.3, ADR-011). Tweede laag van drie: middleware geeft 404
// voor iedereen zonder founderrol op /api/platform/**, en elk platformendpoint
// roept zelf requireFounder() aan (bouwcheck check:platform).
import type { H3Event } from 'h3'
import { sql } from 'drizzle-orm'
import { HERBEVESTIG_MS } from '../../shared/werkIn'
import { gebruikDb, schema } from './db'
import { vereisSessie, type Context } from './sessie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]

/** Founder met tweestapsverificatie (aal2); anders 404 (geen founder) of 401 (geen aal2). */
export async function requireFounder(event: H3Event): Promise<Context> {
  let ctx: Context
  try {
    ctx = await vereisSessie(event)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
  }
  if (ctx.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
  if (ctx.sessie.aal !== 'aal2') throw createError({ statusCode: 401, statusMessage: 'Tweestapsverificatie vereist' })
  return ctx
}

/** Gevaarlijke actie: herbevestiging (TOTP) binnen 15 minuten, anders 428. */
export function vereisHerbevestiging(ctx: Context) {
  const hb = ctx.sessie.hb ? Date.parse(ctx.sessie.hb) : 0
  if (!hb || Date.now() - hb > HERBEVESTIG_MS) {
    throw createError({ statusCode: 428, statusMessage: 'Bevestig eerst met je authenticator-code', data: { herbevestigen: true } })
  }
}

/** Werk als dealtrace_platform: over organisaties heen, maar zonder klantdata. */
export async function alsPlatform<T>(werk: (tx: Tx) => Promise<T>): Promise<T> {
  return gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return werk(tx)
  })
}

/** Platformhandeling in platform_audit én een kopie in audit_events van de klant. */
export async function platformAudit(
  tx: Tx,
  event: H3Event,
  ctx: Context,
  regel: { organisatieId: string | null; handeling: string; object?: string; voor?: unknown; na?: unknown; reden?: string },
) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null
  await tx.insert(schema.platformAudit).values({
    actorId: ctx.gebruiker.id, actieveOrganisatie: regel.organisatieId, handeling: regel.handeling,
    object: regel.object ?? null, voor: (regel.voor ?? null) as any, na: (regel.na ?? null) as any, reden: regel.reden ?? null, ip,
  })
  if (regel.organisatieId) {
    await tx.insert(schema.auditEvents).values({
      id: crypto.randomUUID(), occurredAt: new Date().toISOString(),
      organisationId: regel.organisatieId, actorId: ctx.gebruiker.id, action: `leverancier.${regel.handeling}`,
      resourceType: 'platform', resourceId: regel.object ?? null,
      changes: { voor: regel.voor ?? null, na: regel.na ?? null } as any,
      metadata: { reden: regel.reden ?? null, door: ctx.gebruiker.naam, leverancier: true } as any,
    })
  }
}

/** Melding aan alle actieve beheerders van een organisatie (via de platformrol: alleen toevoegen). */
export async function meldBeheerders(tx: Tx, organisatieId: string, titel: string, tekst: string, link: string | null) {
  await tx.execute(sql`
    insert into notificaties (organisation_id, gebruiker_id, soort, titel, tekst, link)
    select ${organisatieId}, u.id, 'systeem', ${titel}, ${tekst}, ${link}
    from users u where u.organisation_id = ${organisatieId} and u.role = 'beheerder' and u.status = 'actief'`)
}
