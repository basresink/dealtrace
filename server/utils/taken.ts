// Taken en inzichten op de server (F06, F13). `rondAf` is het enige afrondpad: flyout,
// lijst, vegen, bulk en de offline wachtrij komen hier allemaal uit (gat 11).
import { kolomUitUitkomst } from '../../shared/campagnes'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { afrondTekst, type RitmeStand } from '../../shared/hercontact'
import { rondTaakAf, type AfrondInvoer } from '../../shared/taken'
import { herbereken } from './accounts'
import { schema } from './db'
import { eigenTeams } from './gebruikers'
import { draaiMotor } from './motor'
import { ReisFout, laadRitmes, meldGebeurtenis, parkeerTot, pauzeer, zetNee } from './reis'
import type { Context } from './sessie'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type TaakRij = typeof schema.tasks.$inferSelect
type Ctx = Context & { organisatie: NonNullable<Context['organisatie']> }

/** Mag de gebruiker deze taak zien en bewerken? Eigen taken; salesmanager zijn teams; beheerder alles. */
export async function magTaak(tx: Tx, ctx: Ctx, ownerId: string | null): Promise<boolean> {
  if (ctx.gebruiker.rol === 'beheerder' || ownerId === ctx.gebruiker.id) return true
  if (ctx.gebruiker.rol === 'salesmanager' && ownerId) {
    const teams = await eigenTeams(tx, ctx.gebruiker.id)
    const [u] = await tx.select({ teamId: schema.users.teamId }).from(schema.users).where(eq(schema.users.id, ownerId))
    return !!u?.teamId && teams.includes(u.teamId)
  }
  // Accountmanagers lezen alles, maar ronden alleen hun eigen taken af.
  return false
}

async function hercontactRegelId(tx: Tx): Promise<string> {
  const [r] = await tx.select({ id: schema.activityRules.id }).from(schema.activityRules).where(sql`${schema.activityRules.data}->'trigger'->>'patroon' = 'hercontact-vervolg'`).limit(1)
  return r?.id ?? 'ritme'
}

export interface AfrondUitkomst { taakId: string; status: string; tekst: string; volgende: { op: string; kanaal: string; stap: number; van: number } | null; vervolgId: string | null; accountStatus: string | null; alAfgerond?: boolean }

/** Het enige afrondpad. Idempotent op de sleutel: een tweede keer geeft hetzelfde antwoord. */
export async function rondAf(tx: Tx, taakId: string, invoer: AfrondInvoer & { activiteit?: Record<string, unknown> }, door: string, nu = new Date()): Promise<AfrondUitkomst> {
  const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, taakId))
  if (!t) throw new ReisFout(404, 'Taak onbekend')
  const vorig = (t.data as any)?.afronding
  if (t.status === 'klaar' && vorig?.resultaat && (!invoer.sleutel || vorig.sleutel === invoer.sleutel)) return { ...vorig.resultaat, alAfgerond: true }
  const [a] = t.accountId ? await tx.select().from(schema.accounts).where(eq(schema.accounts.id, t.accountId)) : []
  const stand = ((a?.data as any)?.reis?.ritme ?? null) as RitmeStand | null
  const ritmes = stand ? await laadRitmes(tx) : []
  const ritme = stand ? ritmes.find((r) => r.id === stand.ritmeId) ?? null : null
  const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
  const r = rondTaakAf(
    { id: t.id, title: t.title, status: t.status, actionType: t.actionType, priority: t.priority, dueDate: t.dueDate, ownerId: t.ownerId, accountId: t.accountId, ruleId: t.ruleId, signalId: t.signalId, data: t.data as any },
    invoer, { nu, ritme, stand, eersteContact: a?.faseId === 'gekwalificeerd', inst: werkdagen },
  )
  if (r.fout) throw new ReisFout(r.alAfgerond ? 409 : 422, r.fout)
  const tijd = nu.toISOString()

  // Taak, activiteit en stuurvelden.
  await tx.update(schema.tasks).set({ status: 'klaar', uitkomst: r.taakPatch.uitkomst, laterOp: r.taakPatch.laterOp, data: { ...(t.data ?? {}), ...r.taakPatch.data }, updatedAt: tijd }).where(eq(schema.tasks.id, t.id))
  await tx.insert(schema.activiteiten).values({ organisationId: t.organisationId, accountId: t.accountId, contactId: t.contactId, taskId: t.id, soort: r.activiteit.soort, kanaal: r.activiteit.kanaal, uitkomst: r.activiteit.uitkomst, door, op: tijd, data: { ...r.activiteit.data, ...(invoer.activiteit ?? {}), status: 'afgerond' } })
  if (a) {
    if (r.ritme) await tx.update(schema.accounts).set({ data: { ...(a.data ?? {}), reis: { ...((a.data as any)?.reis ?? {}), ritme: r.ritme.stand } } }).where(eq(schema.accounts.id, a.id))
    await herbereken(tx, a.id, nu)
  }

  // Vervolgtaak (volgende poging of herhaling) erft de herkomst (gat 12).
  let vervolgId: string | null = null
  if (r.vervolgtaak) {
    const ruleId = r.ritme ? await hercontactRegelId(tx) : t.ruleId
    const [v] = await tx.insert(schema.tasks).values({
      organisationId: t.organisationId, ownerId: t.ownerId, accountId: t.accountId, contactId: t.contactId, signalId: t.signalId, ruleId,
      onderwerp: r.ritme?.volgende ? `${t.accountId}:poging-${r.ritme.volgende.stap}` : t.onderwerp, actionType: r.vervolgtaak.actionType, title: r.vervolgtaak.title,
      priority: r.vervolgtaak.priority, dueDate: r.vervolgtaak.due, executor: t.executor, campaignId: t.campaignId, data: { ...r.vervolgtaak.data, waarom: (t.data as any)?.waarom, ...((t.data as any)?.campagneId ? { campagneId: (t.data as any).campagneId } : {}) }, createdAt: tijd, updatedAt: tijd,
    }).returning({ id: schema.tasks.id })
    vervolgId = v!.id
  }

  // Reis en status: via het meldpunt (een motorrun aan het eind).
  if (a && a.accountKind === 'prospect') {
    for (const g of r.gebeurtenissen.filter((x) => x !== 'geparkeerd')) await meldGebeurtenis(tx, { accountId: a.id, gebeurtenis: g, door, nu, zonderMotor: true, reden: `Uitkomst: ${r.taakPatch.uitkomst}` })
    if (r.ritme?.actie === 'parkeren' && r.ritme.parkeerTot) await parkeerTot(tx, a.id, r.ritme.parkeerTot, door, nu)
    if (r.nee) await zetNee(tx, a.id, { reden: r.nee.reden, toelichting: r.nee.toelichting ?? undefined }, door, nu).catch((e) => { if (!(e instanceof ReisFout)) throw e })
    if (r.later) await pauzeer(tx, a.id, r.later, 'Gesproken, later', door, nu).catch((e) => { if (!(e instanceof ReisFout)) throw e })
    await draaiMotor(tx, t.organisationId, { soort: 'gebeurtenis', door, accountIds: [a.id], nu })
  }
  // P16: een taak uit een campagne zet het item op het bord in de kolom van de uitkomst (gat 38).
  if (t.campaignId && t.accountId) await volgItem(tx, t.campaignId, t.accountId, r.taakPatch.uitkomst, r.ritme?.actie === 'parkeren', vervolgId)
  const [na] = a ? await tx.select({ nbStatus: schema.accounts.nbStatus }).from(schema.accounts).where(eq(schema.accounts.id, a.id)) : []
  const resultaat: AfrondUitkomst = {
    taakId: t.id, status: 'klaar', tekst: r.ritme ? afrondTekst(r.ritme) : r.vervolgtaak ? `Afgerond. Volgende keer ${new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(r.vervolgtaak.due))}.` : 'Afgerond.',
    volgende: r.ritme?.volgende ?? null, vervolgId, accountStatus: na?.nbStatus ?? null,
  }
  await tx.update(schema.tasks).set({ data: sql`jsonb_set(${schema.tasks.data}, '{afronding,resultaat}', ${JSON.stringify(resultaat)}::jsonb)` }).where(eq(schema.tasks.id, t.id))
  return resultaat
}

/** Het campagne-item volgt de taak: kolom uit de uitkomst, poging erbij, de volgende taak als volgende stap. */
async function volgItem(tx: Tx, campagneId: string, accountId: string, uitkomst: string | null, laatstePoging: boolean, vervolgId: string | null) {
  const kolom = kolomUitUitkomst(uitkomst, laatstePoging)
  const [v] = vervolgId ? await tx.select({ due: schema.tasks.dueDate, titel: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.id, vervolgId)) : []
  await tx.execute(sql`update campagne_items set poging = poging + 1, kolom = coalesce(${kolom}, kolom), einddoel_gehaald = einddoel_gehaald or ${kolom === 'afspraak'},
    volgende_stap = ${v?.titel ?? null}, volgende_op = ${v?.due ?? null}, updated_at = now() where campagne_id = ${campagneId} and account_id = ${accountId}`)
}

export async function takenVan(tx: Tx, ids: string[]): Promise<TaakRij[]> {
  return ids.length ? tx.select().from(schema.tasks).where(inArray(schema.tasks.id, ids)) : []
}

export { and }
