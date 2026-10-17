// Het logo van de organisatie: een bijlage (record_soort 'organisatie', soort 'foto', naam 'logo') met een verwijzing in
// org_settings.logo. De beheerder wisselt of verwijdert het; iedereen in de organisatie ziet het in de zijbalk.
import { sql } from 'drizzle-orm'
import { controleerLogo } from '../../shared/organisatieLogo'
import { schrijfAudit } from './audit'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export interface LogoInstelling { bijlageId: string; mime: string; grootte: number; op: string }

export async function leesLogo(tx: Tx): Promise<LogoInstelling | null> {
  const [r] = (await tx.execute(sql`select value from org_settings where key = 'logo'`)).rows as any[]
  return r?.value?.bijlageId ? (r.value as LogoInstelling) : null
}

/** De url voor het scherm; ?v= wisselt mee met het logo, zodat de browser hem lang mag bewaren. */
export const logoUrl = (l: LogoInstelling | null) => (l ? `/api/organisatie/logo?v=${encodeURIComponent(l.bijlageId.slice(0, 8))}` : null)

export async function bewaarLogo(tx: Tx, org: string, actorId: string, inhoud: Buffer): Promise<LogoInstelling> {
  const c = controleerLogo(inhoud)
  if (!c.ok) throw createError({ statusCode: inhoud.length > 0 && c.fout.includes('te groot') ? 413 : 415, statusMessage: c.fout })
  const oud = await leesLogo(tx)
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud, bewaren_tot, naam)
    values (${id}, ${org}, ${actorId}, 'organisatie', ${org}, 'foto', ${c.mime}, ${inhoud.length}, ${inhoud}, date '9999-12-31', 'logo')`)
  const nieuw: LogoInstelling = { bijlageId: id, mime: c.mime, grootte: inhoud.length, op: new Date().toISOString() }
  await tx.execute(sql`insert into org_settings (organisation_id, key, value, updated_at) values (${org}, 'logo', ${JSON.stringify(nieuw)}::jsonb, now())
    on conflict (organisation_id, key) do update set value = excluded.value, updated_at = now()`)
  if (oud) await tx.execute(sql`delete from bijlagen where id = ${oud.bijlageId} and organisation_id = ${org} and record_soort = 'organisatie' and naam = 'logo'`)
  await schrijfAudit(tx, { organisationId: org, actorId, action: 'organisatie.logo', resourceType: 'org_settings', resourceId: 'logo', changes: { mime: c.mime, grootte: inhoud.length, vervangen: !!oud } })
  return nieuw
}

export async function verwijderLogo(tx: Tx, org: string, actorId: string): Promise<void> {
  const oud = await leesLogo(tx)
  if (!oud) return
  await tx.execute(sql`delete from bijlagen where id = ${oud.bijlageId} and organisation_id = ${org} and record_soort = 'organisatie' and naam = 'logo'`)
  await tx.execute(sql`delete from org_settings where organisation_id = ${org} and key = 'logo'`)
  await schrijfAudit(tx, { organisationId: org, actorId, action: 'organisatie.logo', resourceType: 'org_settings', resourceId: 'logo', changes: { verwijderd: true } })
}
