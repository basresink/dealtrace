// Deactiveren en heractiveren van een prospect (0064). Niets wordt verwijderd: de tijdlijn, taken,
// afspraken, verslagen en de audit blijven staan. Deactiveren stopt wel al het lopende werk, met de reden
// erbij: open taken, het hercontactritme, een opvolgreeks, concepten die wachten en de plek in lopende
// campagnes. De motor, de belblokvuller, campagnes, de signaalradar en de lijsten slaan een account met
// gedeactiveerd_op over; de leadgenerator ontdubbelt er nog wel tegen.
import { eq, sql } from 'drizzle-orm'
import { DEACTIVEER_REDEN_LABEL, magDeactiveren, type AfgerondeDeactivering, type DeactiveerReden, type Gedeactivering } from '../../shared/deactiveren'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { eigenTeams } from './gebruikers'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export class DeactiveerFout extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}

async function laad(tx: Tx, id: string) {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
  if (!a) throw new DeactiveerFout(404, 'Account onbekend')
  return a
}

/** Mag deze gebruiker dit account deactiveren of heractiveren? Eigenaar, salesmanager (eigen teams) of beheerder. */
export async function magDitAccount(tx: Tx, g: { id: string; rol: string }, a: { ownerId: string | null }): Promise<boolean> {
  if (g.rol === 'beheerder' || a.ownerId === g.id) return true
  if (g.rol !== 'salesmanager' || !a.ownerId) return false
  const [eig] = await tx.select({ teamId: schema.users.teamId }).from(schema.users).where(eq(schema.users.id, a.ownerId))
  return magDeactiveren(g, { ownerId: a.ownerId, ownerTeamId: eig?.teamId ?? null }, await eigenTeams(tx, g.id))
}

export async function deactiveer(tx: Tx, org: string, g: { id: string; rol: string }, id: string, invoer: { reden: DeactiveerReden; toelichting?: string }, nu = new Date()) {
  const a = await laad(tx, id)
  if (!(await magDitAccount(tx, g, a))) throw new DeactiveerFout(403, 'Alleen de eigenaar, zijn salesmanager of de beheerder deactiveert dit account')
  if (a.gedeactiveerdOp) throw new DeactiveerFout(409, 'Dit account is al gedeactiveerd')
  const tijd = nu.toISOString()
  const label = DEACTIVEER_REDEN_LABEL[invoer.reden]
  const zin = `Prospect gedeactiveerd: ${label.toLowerCase()}${invoer.toelichting ? ` (${invoer.toelichting})` : ''}`
  const data = (a.data ?? {}) as any
  const ritme = data.reis?.ritme
  const gedeactivering: Gedeactivering = { op: tijd, door: g.id, reden: invoer.reden, ...(invoer.toelichting ? { toelichting: invoer.toelichting } : {}), ...(ritme?.actief ? { ritmeWasActief: true } : {}) }
  const nieuweData = { ...data, gedeactivering, ...(ritme?.actief ? { reis: { ...data.reis, ritme: { ...ritme, actief: false } } } : {}) }
  await tx.update(schema.accounts).set({ gedeactiveerdOp: tijd, data: nieuweData, updatedAt: tijd }).where(eq(schema.accounts.id, id))

  // Open taken (ook die van een reeks, campagne of belblok) stoppen met de reden erbij.
  const taken = (await tx.execute(sql`update tasks set status = 'geannuleerd', updated_at = ${tijd}, data = data || ${JSON.stringify({ annuleerReden: zin, geannuleerdDoor: 'deactiveren' })}::jsonb
    where account_id = ${id} and status in ('open', 'bezig') returning id`)).rows.length
  // Een lopende of gepauzeerde opvolgreeks stopt; geplande stappen worden overgeslagen en hun concepten verworpen.
  const reeksen = (await tx.execute(sql`select id from reeksen where account_id = ${id} and status in ('loopt', 'gepauzeerd')`)).rows as { id: string }[]
  for (const r of reeksen) {
    const stappen = (await tx.execute(sql`update reeksstappen set status = 'overgeslagen', reden = ${zin} where reeks_id = ${r.id} and status in ('gepland', 'open') returning concept_id`)).rows as { concept_id: string | null }[]
    const concepten = stappen.map((s) => s.concept_id).filter(Boolean) as string[]
    if (concepten.length) await tx.execute(sql`update concepten set status = 'verworpen', overname = 'verworpen', besloten_op = ${tijd} where id in ${concepten} and status = 'klaar'`)
    await tx.execute(sql`update reeksen set status = 'gestopt', stopreden = 'handmatig', gestopt_op = ${tijd}, updated_at = ${tijd}, data = data || ${JSON.stringify({ stopToelichting: zin })}::jsonb where id = ${r.id}`)
  }
  // Concepten die nog op goedkeuring wachten (mail, bericht) gaan niet meer de deur uit.
  const concepten = (await tx.execute(sql`update concepten set status = 'verworpen', overname = 'verworpen', besloten_op = ${tijd} where account_id = ${id} and status = 'klaar' returning id`)).rows.length
  // Uit lopende campagnes: de kaart gaat naar Geparkeerd en onthoudt de kolom voor een heractivering.
  const campagnes = (await tx.execute(sql`update campagne_items ci set data = ci.data || jsonb_build_object('gedeactiveerd', jsonb_build_object('vorigeKolom', ci.kolom, 'op', ${tijd}::text)), kolom = 'geparkeerd', updated_at = ${tijd}
    from campagnes cp where cp.id = ci.campagne_id and ci.account_id = ${id} and cp.status in ('concept', 'wacht', 'actief', 'gepauzeerd') and ci.kolom not in ('afspraak', 'geparkeerd', 'afgewezen') returning ci.id`)).rows.length

  await tx.insert(schema.activiteiten).values({ organisationId: org, accountId: id, soort: 'gedeactiveerd', door: g.id, op: tijd, data: { tekst: `${label}${invoer.toelichting ? `: ${invoer.toelichting}` : ''}`, reden: invoer.reden, toelichting: invoer.toelichting ?? null, taken, reeksen: reeksen.length, campagnes, concepten } })
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'account.deactiveren', resourceType: 'accounts', resourceId: id, changes: { naam: a.name, reden: invoer.reden, toelichting: invoer.toelichting ?? null }, metadata: { taken, reeksen: reeksen.length, campagnes, concepten, ritme: !!ritme?.actief } })
  return { id, gedeactiveerdOp: tijd, reden: invoer.reden, gestopt: { taken, reeksen: reeksen.length, campagnes, concepten, ritme: !!ritme?.actief } }
}

export async function heractiveer(tx: Tx, org: string, g: { id: string; rol: string }, id: string, nu = new Date()) {
  const a = await laad(tx, id)
  if (!(await magDitAccount(tx, g, a))) throw new DeactiveerFout(403, 'Alleen de eigenaar, zijn salesmanager of de beheerder heractiveert dit account')
  if (!a.gedeactiveerdOp) throw new DeactiveerFout(409, 'Dit account is niet gedeactiveerd')
  const tijd = nu.toISOString()
  const data = (a.data ?? {}) as any
  const d = data.gedeactivering as Gedeactivering | undefined
  const ronde: AfgerondeDeactivering | null = d ? { ...d, heractiveerdOp: tijd, heractiveerdDoor: g.id } : null
  const { gedeactivering: _weg, ...rest } = data
  const ritme = rest.reis?.ritme
  // Liep er een hercontactritme, dan pakt de motor het weer op: op de geplande poging, of vandaag als die al voorbij is.
  const nieuweData = {
    ...rest, deactiveringen: [...(Array.isArray(rest.deactiveringen) ? rest.deactiveringen : []), ...(ronde ? [ronde] : [])],
    ...(d?.ritmeWasActief && ritme ? { reis: { ...rest.reis, ritme: { ...ritme, actief: true, volgendeOp: ritme.volgendeOp && ritme.volgendeOp > tijd ? ritme.volgendeOp : tijd } } } : {}),
  }
  await tx.update(schema.accounts).set({ gedeactiveerdOp: null, data: nieuweData, updatedAt: tijd }).where(eq(schema.accounts.id, id))
  // Campagnekaarten die door het deactiveren op Geparkeerd kwamen, gaan terug naar hun kolom.
  const campagnes = (await tx.execute(sql`update campagne_items ci set kolom = ci.data->'gedeactiveerd'->>'vorigeKolom', data = ci.data - 'gedeactiveerd', updated_at = ${tijd}
    from campagnes cp where cp.id = ci.campagne_id and ci.account_id = ${id} and ci.kolom = 'geparkeerd' and ci.data ? 'gedeactiveerd' and cp.status in ('concept', 'wacht', 'actief', 'gepauzeerd') returning ci.id`)).rows.length
  await tx.insert(schema.activiteiten).values({ organisationId: org, accountId: id, soort: 'geheractiveerd', door: g.id, op: tijd, data: { tekst: d ? `Was gedeactiveerd: ${DEACTIVEER_REDEN_LABEL[d.reden]?.toLowerCase() ?? d.reden}` : 'Weer actief', campagnes } })
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'account.heractiveren', resourceType: 'accounts', resourceId: id, changes: { naam: a.name, wasReden: d?.reden ?? null }, metadata: { campagnes, ritme: !!d?.ritmeWasActief } })
  return { id, gedeactiveerdOp: null, campagnes }
}

export function alsHttp(e: unknown): never {
  if (e instanceof DeactiveerFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message })
  throw e
}
