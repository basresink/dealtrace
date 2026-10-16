// Opvolgreeksen op de server (F7). Een reeks hoort bij één account (hooguit één lopende of gepauzeerde), heeft
// stappen per dag (mail, LinkedIn-taak, bellen in het belblok, het einde terug naar het ritme) en stopt vanzelf bij
// een reactie: een geplande afspraak, een nee, een afmelding of een gelogde reactie. Dan komt er een taak "bel terug"
// (behalve na een nee). Elke stap gaat eerst langs de Bewaker; mail en LinkedIn krijgen een concept van de Schrijver
// via de AI-schil met credits (bereidVoor) en zijn altijd een concept dat de mens goedkeurt. LinkedIn verstuurt
// Dealtrace nooit zelf: kopieer en vink af. Mandaat B verstuurt een mail op de dag zelf binnen het kader, opnieuw langs
// de Bewaker. Tijdens de reeks staat het hercontactritme stil; aan het einde gaat het verder.
import { and, eq, sql } from 'drizzle-orm'
import { isWerkdag, nlMoment, nlTijdstip, volgendWerkmoment, type WerkdagInstelling } from '../../shared/datum'
import { volgendVastBlok } from '../../shared/belblokken'
import { magBenaderen } from '../../shared/nbStatus'
import {
  REEKS_ACTIE, STARTSJABLONEN, STOPREDEN_LABEL, aanDeBeurt, belTerugNa, mandaatKeuzes, planReeks, reeksStand, schuifOp, stopReden,
  type ReeksKanaal, type ReeksMandaat, type ReeksStap, type ReeksStatus, type Stopreden,
} from '../../shared/opvolgreeks'
import { laadAgentStand, mandaatVoor, toets } from './agents/bewaker'
import { schrijfAudit } from './audit'
import { blokkenVan } from './bellen'
import { besluit, bereidVoor, verstuurConcept } from './briefing'
import { schema } from './db'
import { isAfgemeld } from './mail'
import { magTaak, rondAf } from './taken'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
export interface ReeksGebruiker { id: string; rol: string; niveau: string; werkplek?: string | null; data?: any }
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const KANAAL_VAN: Record<ReeksKanaal, 'mail' | 'linkedin' | 'bellen'> = { mail: 'mail', linkedin: 'linkedin', bellen: 'bellen' }

async function werkdagen(tx: Tx): Promise<WerkdagInstelling> {
  return ((await rijen(tx, sql`select value from org_settings where key = 'werkdagen'`))[0]?.value ?? {}) as WerkdagInstelling
}

/** De startsjablonen voor een organisatie zonder sjablonen (nieuwe organisaties, de wegwerpdatabase). */
export async function zorgVoorSjablonen(tx: Tx, org: string) {
  if ((await rijen(tx, sql`select 1 from reekssjablonen limit 1`)).length) return 0
  for (const s of STARTSJABLONEN) {
    await tx.execute(sql`insert into reekssjablonen (organisation_id, sleutel, naam, omschrijving, na, stappen, einde)
      values (${org}, ${s.sleutel}, ${s.naam}, ${s.omschrijving}, ${s.na}, ${JSON.stringify(s.stappen)}::jsonb, ${JSON.stringify(s.einde)}::jsonb) on conflict (organisation_id, sleutel) do nothing`)
  }
  return STARTSJABLONEN.length
}

export async function sjablonen(tx: Tx, org: string) {
  await zorgVoorSjablonen(tx, org)
  const volgorde = (k: string) => { const i = STARTSJABLONEN.findIndex((x) => x.sleutel === k); return i < 0 ? 99 : i }
  return (await rijen(tx, sql`select * from reekssjablonen where actief order by created_at, naam`)).sort((x, y) => volgorde(x.sleutel) - volgorde(y.sleutel)).map((s) => ({
    id: s.id as string, sleutel: s.sleutel as string, naam: s.naam as string, omschrijving: s.omschrijving as string | null, na: s.na as string | null,
    stappen: s.stappen as { dag: number; kanaal: ReeksKanaal; titel: string }[], einde: s.einde as { dag: number; wachtDagen: number },
  }))
}

const stapUit = (s: Rij): ReeksStap & { gedaanOp: string | null; data: any } => ({
  id: s.id, volgnummer: s.volgnummer, dag: s.dag, kanaal: s.kanaal, titel: s.titel, instructie: s.instructie, status: s.status, geplandOp: iso(s.gepland_op)!,
  taskId: s.task_id, conceptId: s.concept_id, reden: s.reden, gedaanOp: iso(s.gedaan_op), data: s.data ?? {},
})

async function leesReeks(tx: Tx, id: string) {
  const [r] = await rijen(tx, sql`select * from reeksen where id = ${id}`)
  if (!r) fout(404, 'Reeks onbekend')
  return r!
}
async function stappenVan(tx: Tx, reeksId: string) {
  return (await rijen(tx, sql`select * from reeksstappen where reeks_id = ${reeksId} order by volgnummer`)).map(stapUit)
}

/** Mag deze gebruiker de reeks van dit account starten en wijzigen? Eigenaar, zijn salesmanager, beheerder; zonder eigenaar iedereen. */
export async function magVolgen(tx: Tx, g: ReeksGebruiker, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return true
  return magTaak(tx, { gebruiker: g } as any, ownerId)
}

/** De reeks van een account voor het scherm: de lopende, anders de laatste, met stappen, taak en concept. */
export async function reeksVanAccount(tx: Tx, accountId: string, nu = new Date()) {
  const [r] = await rijen(tx, sql`select r.*, u.name as eigenaar, c.first_name, c.last_name from reeksen r left join users u on u.id = r.owner_id left join contacts c on c.id = r.contact_id
    where r.account_id = ${accountId} order by (r.status in ('loopt', 'gepauzeerd')) desc, r.gestart_op desc limit 1`)
  if (!r) return null
  return reeksUit(tx, r, nu)
}

async function reeksUit(tx: Tx, r: Rij, nu: Date) {
  const stappen = await stappenVan(tx, r.id)
  const conceptIds = stappen.map((s) => s.conceptId).filter(Boolean) as string[]
  const taskIds = stappen.map((s) => s.taskId).filter(Boolean) as string[]
  const concepten = new Map((conceptIds.length ? await rijen(tx, sql`select id, status, concept from concepten where id in ${conceptIds}`) : []).map((c) => [c.id, c]))
  const taken = new Map((taskIds.length ? await rijen(tx, sql`select id, status, due_date, belblok_id from tasks where id in ${taskIds}`) : []).map((t) => [t.id, t]))
  const stand = reeksStand({ status: r.status, gestartOp: iso(r.gestart_op)!, stopreden: r.stopreden }, stappen, nu)
  const volgende = stappen.find((s) => s.status === 'gepland' || s.status === 'open') ?? null
  return {
    id: r.id as string, naam: r.naam as string, status: r.status as ReeksStatus, mandaat: r.mandaat as ReeksMandaat, stopreden: (r.stopreden ?? null) as Stopreden | null,
    stopLabel: r.stopreden ? STOPREDEN_LABEL[r.stopreden as Stopreden] : null, gestartOp: iso(r.gestart_op)!, gestoptOp: iso(r.gestopt_op), eigenaar: (r.eigenaar ?? null) as string | null, ownerId: r.owner_id as string,
    contact: r.contact_id ? { id: r.contact_id as string, naam: [r.first_name, r.last_name].filter(Boolean).join(' ') } : null,
    stand, belTerugTaakId: (r.data?.belTerugTaakId ?? null) as string | null, aanleiding: (r.data?.aanleiding ?? null) as string | null,
    volgende: volgende ? { kanaal: volgende.kanaal, titel: volgende.titel, geplandOp: volgende.geplandOp } : null,
    stappen: stappen.map((s) => {
      const c = s.conceptId ? concepten.get(s.conceptId) : null
      const t = s.taskId ? taken.get(s.taskId) : null
      return {
        id: s.id, volgnummer: s.volgnummer, dag: s.dag, kanaal: s.kanaal, titel: s.titel, status: s.status, geplandOp: s.geplandOp, gedaanOp: s.gedaanOp, reden: s.reden ?? null,
        taak: t ? { id: t.id as string, status: t.status as string, dueDate: iso(t.due_date), inBelblok: !!t.belblok_id } : null,
        concept: c ? { id: c.id as string, status: c.status as string, onderwerp: (c.concept?.onderwerp ?? null) as string | null, tekst: String(c.concept?.tekst ?? ''), stijlscore: c.concept?.stijlscore ?? null, bronnen: c.concept?.bronnen ?? [] } : null,
        autoMislukt: s.data?.autoMislukt ?? null,
      }
    }),
  }
}

/** Een reeks starten vanuit een sjabloon. Hooguit één lopende reeks per account; het ritme staat zolang stil. */
export async function startReeks(tx: Tx, org: string, g: ReeksGebruiker, accountId: string, b: { sjabloonId?: string; contactId?: string | null; mandaat?: string; aanleiding?: string | null }, basisUrl: string, nu = new Date()) {
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  if (!a) fout(404, 'Account onbekend')
  if (!(await magVolgen(tx, g, a!.ownerId))) fout(403, 'Alleen de eigenaar, zijn salesmanager of de beheerder start een reeks op dit account')
  if (a!.nbStatus === 'overgedragen') fout(422, 'Dit account is overgedragen; het vervolg loopt in DealDrive of het CRM')
  if (a!.nbStatus === 'nee') fout(422, 'Dit account staat op nee; de afkoeling loopt nog')
  await zorgVoorSjablonen(tx, org)
  const [s] = await rijen(tx, sql`select * from reekssjablonen where id = ${b.sjabloonId ?? ''} and actief`)
  if (!s) fout(422, 'Kies een sjabloon')
  const mandaat = (b.mandaat ?? 'C') as ReeksMandaat
  const stand = await laadAgentStand(tx, org)
  if (!mandaatKeuzes(mandaatVoor(stand, 'verzender', { id: g.id, niveau: g.niveau, data: g.data }, true)).includes(mandaat)) fout(422, 'Je mandaat staat alleen "Elke stap goedkeuren" toe')
  const contacten = await tx.select().from(schema.contacts).where(and(eq(schema.contacts.accountId, accountId), sql`${schema.contacts.status} <> 'vertrokken'`))
  const contact = b.contactId ? contacten.find((c) => c.id === b.contactId) : contacten.find((c) => c.rol === 'beslisser') ?? contacten.find((c) => c.rol === 'champion') ?? contacten[0]
  if (b.contactId && !contact) fout(422, 'Dit contact hoort niet bij het account')
  if ((await rijen(tx, sql`select 1 from reeksen where account_id = ${accountId} and status in ('loopt', 'gepauzeerd')`)).length) fout(409, 'Op dit account loopt al een reeks. Stop die eerst.')
  const id = crypto.randomUUID()
  const ritme = (a!.data as any)?.reis?.ritme ?? null
  await tx.execute(sql`insert into reeksen (id, organisation_id, account_id, contact_id, sjabloon_id, naam, owner_id, mandaat, status, gestart_op, data)
    values (${id}, ${org}, ${accountId}, ${contact?.id ?? null}, ${s!.id}, ${s!.naam}, ${g.id}, ${mandaat}, 'loopt', ${nu.toISOString()}, ${JSON.stringify({ ritmeVoor: ritme?.actief ? ritme : null, aanleiding: b.aanleiding ?? s!.na ?? null, wachtDagen: s!.einde?.wachtDagen ?? 30 })}::jsonb)`)
  for (const st of planReeks({ stappen: s!.stappen, einde: s!.einde }, nu, await werkdagen(tx))) {
    await tx.execute(sql`insert into reeksstappen (organisation_id, reeks_id, volgnummer, dag, kanaal, titel, instructie, gepland_op)
      values (${org}, ${id}, ${st.volgnummer}, ${st.dag}, ${st.kanaal}, ${st.titel}, ${st.instructie ?? null}, ${st.geplandOp})`)
  }
  // Nooit twee ritmes op één account: het hercontactritme staat stil en open ritmepogingen vervallen.
  if (ritme?.actief) {
    await tx.update(schema.accounts).set({ data: { ...(a!.data ?? {}), reis: { ...((a!.data as any)?.reis ?? {}), ritme: { ...ritme, actief: false, reeksId: id } } } }).where(eq(schema.accounts.id, accountId))
    await tx.execute(sql`update tasks set status = 'geannuleerd', data = data || ${JSON.stringify({ annuleerReden: 'Vervangen door de opvolgreeks' })}::jsonb, updated_at = now()
      where account_id = ${accountId} and status in ('open', 'bezig') and data ? 'poging' and coalesce(data->'herkomst'->>'bron', '') = 'ritme'`)
  }
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'reeks.gestart', resourceType: 'reeks', resourceId: id, changes: { sjabloon: s!.naam, mandaat, contactId: contact?.id ?? null }, metadata: { accountId } })
  await werkReeksBij(tx, org, id, nu, { gebruiker: g, basisUrl })
  return reeksVanAccount(tx, accountId, nu)
}

/** Mandaat wijzigen, pauzeren, hervatten of stoppen. */
export async function wijzigReeks(tx: Tx, org: string, g: ReeksGebruiker, id: string, b: { mandaat?: string; actie?: string }, nu = new Date()) {
  const r = await leesReeks(tx, id)
  const [a] = await rijen(tx, sql`select owner_id from accounts where id = ${r.account_id}`)
  if (!(await magVolgen(tx, g, a?.owner_id ?? null)) && r.owner_id !== g.id) fout(403, 'Deze reeks is van een collega')
  if (b.mandaat !== undefined) {
    if (!['B', 'C'].includes(b.mandaat)) fout(422, 'Kies B of C')
    if (!['loopt', 'gepauzeerd'].includes(r.status)) fout(409, 'Deze reeks loopt niet meer')
    const stand = await laadAgentStand(tx, org)
    const [eigenaar] = await rijen(tx, sql`select id, niveau, data from users where id = ${r.owner_id}`)
    if (!mandaatKeuzes(mandaatVoor(stand, 'verzender', eigenaar ? { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data } : null, true)).includes(b.mandaat as ReeksMandaat)) fout(422, 'Het mandaat staat alleen "Elke stap goedkeuren" toe')
    await tx.execute(sql`update reeksen set mandaat = ${b.mandaat}, updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'reeks.mandaat', resourceType: 'reeks', resourceId: id, changes: { van: r.mandaat, naar: b.mandaat } })
  }
  if (b.actie === 'pauzeer') {
    if (r.status !== 'loopt') fout(409, 'Alleen een lopende reeks pauzeer je')
    await tx.execute(sql`update reeksen set status = 'gepauzeerd', gepauzeerd_op = ${nu.toISOString()}, updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'reeks.gepauzeerd', resourceType: 'reeks', resourceId: id })
  } else if (b.actie === 'hervat') {
    if (r.status !== 'gepauzeerd') fout(409, 'Deze reeks staat niet op pauze')
    const pauze = nu.getTime() - Date.parse(iso(r.gepauzeerd_op) ?? nu.toISOString())
    for (const s of schuifOp(await stappenVan(tx, id), pauze, nu)) if (s.status === 'gepland') await tx.execute(sql`update reeksstappen set gepland_op = ${s.geplandOp} where id = ${s.id}`)
    await tx.execute(sql`update reeksen set status = 'loopt', gepauzeerd_op = null, updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'reeks.hervat', resourceType: 'reeks', resourceId: id })
  } else if (b.actie === 'stop') {
    if (!['loopt', 'gepauzeerd'].includes(r.status)) fout(409, 'Deze reeks loopt niet meer')
    await stopReeks(tx, org, r, 'handmatig', g.id, nu)
  } else if (b.actie !== undefined) fout(400, 'Kies pauzeer, hervat of stop')
  return reeksVanAccount(tx, r.account_id, nu)
}

/** Een reactie loggen (mail beantwoord, teruggebeld, LinkedIn-bericht): de reeks stopt en er komt een taak "bel terug". */
export async function logReactie(tx: Tx, org: string, g: ReeksGebruiker, id: string, b: { kanaal?: string; notitie?: string | null }, nu = new Date()) {
  const r = await leesReeks(tx, id)
  if (!['loopt', 'gepauzeerd'].includes(r.status)) fout(409, 'Deze reeks loopt niet meer')
  const kanaal = ['mail', 'telefoon', 'linkedin', 'anders'].includes(b.kanaal ?? '') ? b.kanaal! : 'anders'
  await tx.insert(schema.activiteiten).values({ organisationId: org, accountId: r.account_id, contactId: r.contact_id, soort: 'reactie', kanaal, uitkomst: 'reactie', door: g.id, op: nu.toISOString(), data: { reeksId: id, ...(b.notitie?.trim() ? { tekst: b.notitie.trim().slice(0, 1000) } : {}) } })
  await stopReeks(tx, org, r, 'reactie', g.id, nu)
  return reeksVanAccount(tx, r.account_id, nu)
}

/** Stoppen: open stappen vallen weg, open taken van de reeks worden geannuleerd, en na een reactie een taak "bel terug". */
async function stopReeks(tx: Tx, org: string, r: Rij, reden: Stopreden, door: string, nu: Date) {
  const stappen = await stappenVan(tx, r.id)
  const open = stappen.filter((s) => s.status === 'gepland' || s.status === 'open')
  await tx.execute(sql`update reeksstappen set status = 'overgeslagen', reden = ${STOPREDEN_LABEL[reden]} where reeks_id = ${r.id} and status in ('gepland', 'open')`)
  const taken = open.map((s) => s.taskId).filter(Boolean) as string[]
  if (taken.length) await tx.execute(sql`update tasks set status = 'geannuleerd', data = data || ${JSON.stringify({ annuleerReden: `Opvolgreeks gestopt: ${STOPREDEN_LABEL[reden].toLowerCase()}` })}::jsonb, updated_at = now() where id in ${taken} and status in ('open', 'bezig')`)
  const concepten = open.map((s) => s.conceptId).filter(Boolean) as string[]
  if (concepten.length) await tx.execute(sql`update concepten set status = 'verworpen', overname = 'verworpen', besloten_op = now() where id in ${concepten} and status = 'klaar'`)
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, r.account_id))
  let belTerugTaakId: string | null = null
  let belTerugReden: string | null = null
  if (a && belTerugNa(reden)) {
    const [c] = r.contact_id ? await tx.select().from(schema.contacts).where(eq(schema.contacts.id, r.contact_id)) : []
    const m = magBenaderen({ nbStatus: a.nbStatus, data: a.data as any }, 'bellen', nu, { belMeNiet: !!(c?.data as any)?.belMeNiet })
    if (m.mag) {
      // Bel terug binnen twee uur, binnen werktijd.
      const inst = await werkdagen(tx)
      const twee = new Date(nu.getTime() + 2 * 3600e3)
      const m2 = nlMoment(twee)
      const due = isWerkdag(m2.datum, inst) && m2.uur >= 8 && m2.uur < 18 ? twee : volgendWerkmoment(twee, inst)
      const naam = c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : a.name
      const titel = reden === 'afspraak' ? `Bel ${naam}: bevestig de afspraak` : reden === 'afmelding' ? `Bel terug: ${naam} meldde zich af voor mail` : `Bel terug: ${naam} reageerde`
      const [t] = await tx.insert(schema.tasks).values({
        organisationId: org, ownerId: r.owner_id, accountId: a.id, contactId: r.contact_id ?? null, actionType: 'bellen', priority: 'hoog', dueDate: due.toISOString(), onderwerp: `${a.id}:reeks-${r.id}-terugbellen`,
        title: titel, data: { waarom: `${STOPREDEN_LABEL[reden]}; de opvolgreeks ${r.naam} is gestopt.`, herkomst: { bron: 'reeks', actiesoort: 'bellen', uitvoerder: r.owner_id }, reeks: { id: r.id, terugbellen: true } },
        createdAt: nu.toISOString(), updatedAt: nu.toISOString(),
      }).returning({ id: schema.tasks.id })
      belTerugTaakId = t!.id
    } else belTerugReden = m.reden ?? null
  }
  await tx.execute(sql`update reeksen set status = 'gestopt', stopreden = ${reden}, gestopt_op = ${nu.toISOString()}, updated_at = now(),
    data = data || ${JSON.stringify({ belTerugTaakId, belTerugReden })}::jsonb where id = ${r.id}`)
  // Handmatig gestopt: het ritme gaat verder waar het was. Na een reactie gaat het gesprek voor.
  if (a && reden === 'handmatig') await terugNaarRitme(tx, a, r, nu, 0)
  if (reden !== 'handmatig') {
    await tx.insert(schema.notificaties).values({ id: crypto.randomUUID(), organisationId: org, gebruikerId: r.owner_id, soort: 'hot', titel: `Opvolgreeks gestopt: ${a?.name ?? 'account'}`, tekst: `${STOPREDEN_LABEL[reden]}.${belTerugTaakId ? ' Bel terug binnen twee uur.' : ''}`, link: `/accounts/${r.account_id}?volgen=1`, op: nu.toISOString(), data: { reeksId: r.id } })
  }
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'reeks.gestopt', resourceType: 'reeks', resourceId: r.id, changes: { reden, belTerugTaakId } })
}

/** Het einde van de reeks zonder reactie (of handmatig gestopt): het hercontactritme gaat verder. */
async function terugNaarRitme(tx: Tx, a: typeof schema.accounts.$inferSelect, r: Rij, nu: Date, wachtDagen: number) {
  const voor = r.data?.ritmeVoor
  const nuRitme = (a.data as any)?.reis?.ritme
  if (!voor || (nuRitme?.actief && nuRitme.reeksId !== r.id)) return false
  const vroegst = volgendWerkmoment(new Date(nu.getTime() + wachtDagen * 864e5), await werkdagen(tx))
  const volgendeOp = new Date(Math.max(vroegst.getTime(), Date.parse(voor.volgendeOp ?? nu.toISOString()))).toISOString()
  const { reeksId: _weg, ...rest } = { ...voor } as Record<string, unknown>
  await tx.update(schema.accounts).set({ data: { ...(a.data ?? {}), reis: { ...((a.data as any)?.reis ?? {}), ritme: { ...rest, actief: true, volgendeOp } } } }).where(eq(schema.accounts.id, a.id))
  return true
}

/**
 * De reeks bijwerken: eerst de stand van open stappen uit hun taak en concept, dan de stopregels (afspraak, nee,
 * afmelding, reactie), dan de stappen die aan de beurt zijn klaarzetten (langs de Bewaker), en mandaat B: een mail op de
 * dag zelf versturen. Idempotent: een tweede run verandert niets.
 */
export async function werkReeksBij(tx: Tx, org: string, id: string, nu = new Date(), opties: { gebruiker?: ReeksGebruiker; basisUrl?: string } = {}) {
  const r = await leesReeks(tx, id)
  if (r.status !== 'loopt') return { gestopt: null as Stopreden | null, klaargezet: 0, verstuurd: 0 }
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, r.account_id))
  if (!a) return { gestopt: null, klaargezet: 0, verstuurd: 0 }
  const [c] = r.contact_id ? await tx.select().from(schema.contacts).where(eq(schema.contacts.id, r.contact_id)) : []

  // 1. Open stappen volgen hun taak en concept.
  for (const s of (await stappenVan(tx, id)).filter((x) => x.status === 'open')) {
    const [t] = s.taskId ? await rijen(tx, sql`select status, updated_at from tasks where id = ${s.taskId}`) : []
    const [k] = s.conceptId ? await rijen(tx, sql`select status from concepten where id = ${s.conceptId}`) : []
    if (k?.status === 'verstuurd' || t?.status === 'klaar') {
      await tx.execute(sql`update reeksstappen set status = 'gedaan', gedaan_op = ${t?.status === 'klaar' ? iso(t.updated_at) : nu.toISOString()} where id = ${s.id}`)
      if (t && t.status !== 'klaar' && k?.status === 'verstuurd') await tx.execute(sql`update tasks set status = 'klaar', updated_at = now() where id = ${s.taskId}`)
    } else if (t?.status === 'geannuleerd') await tx.execute(sql`update reeksstappen set status = 'overgeslagen', reden = 'De taak is geannuleerd' where id = ${s.id}`)
  }

  // 2. Stopregels.
  const gestart = iso(r.gestart_op)!
  const afspraken = (await rijen(tx, sql`select created_at, status from appointments where account_id = ${a.id} and created_at > ${gestart}`)).map((x) => ({ createdAt: iso(x.created_at)!, status: x.status }))
  const momenten = (await rijen(tx, sql`select op, soort, uitkomst from activiteiten where account_id = ${a.id} and uitvoerder = 'mens' and op > ${gestart} and soort in ('gebeld', 'mail', 'bericht', 'bezoek', 'reactie')`)).map((x) => ({ op: iso(x.op)!, soort: x.soort, uitkomst: x.uitkomst }))
  const afgemeld = !!c?.email && await isAfgemeld(tx, c.email)
  const reden = stopReden(gestart, { afspraken, nbStatus: a.nbStatus, afgemeld, momenten })
  if (reden) { await stopReeks(tx, org, r, reden, opties.gebruiker?.id ?? r.owner_id, nu); return { gestopt: reden, klaargezet: 0, verstuurd: 0 } }

  // 3. Wat aan de beurt is, klaarzetten.
  const [eigenaarRij] = await rijen(tx, sql`select id, role, niveau, werkplek, data from users where id = ${r.owner_id}`)
  const eigenaar: ReeksGebruiker = { id: r.owner_id, rol: eigenaarRij?.role ?? 'accountmanager', niveau: eigenaarRij?.niveau ?? 'beginner', werkplek: eigenaarRij?.werkplek, data: eigenaarRij?.data ?? {} }
  const handmatig = opties.gebruiker?.id === r.owner_id
  let klaargezet = 0
  let verstuurd = 0
  const stappen = await stappenVan(tx, id)
  const inst = await werkdagen(tx)
  for (const s of stappen.filter((x) => aanDeBeurt(x, nu, inst))) {
    if (s.kanaal === 'einde') {
      await tx.execute(sql`update reeksstappen set status = 'gedaan', gedaan_op = ${nu.toISOString()} where id = ${s.id}`)
      await tx.execute(sql`update reeksstappen set status = 'overgeslagen', reden = 'Niet gedaan voor het einde van de reeks' where reeks_id = ${id} and status = 'gepland'`)
      await tx.execute(sql`update reeksen set status = 'klaar', gestopt_op = ${nu.toISOString()}, updated_at = now() where id = ${id}`)
      await terugNaarRitme(tx, a, r, nu, Number(r.data?.wachtDagen ?? 30))
      await schrijfAudit(tx, { organisationId: org, actorId: r.owner_id, action: 'reeks.klaar', resourceType: 'reeks', resourceId: id })
      break
    }
    // De Bewaker: afkoeling, wachtend, bel-me-niet en consent. De Planner zet een taak klaar; hij benadert niemand.
    const kanaal = KANAAL_VAN[s.kanaal as ReeksKanaal]
    const b = await toets(tx, org, { agent: 'planner', handeling: `reeks:${s.kanaal}`, gebruiker: { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data }, accountId: a.id, contactId: r.contact_id, kanaal }, nu)
    if (!b.mag) { await tx.execute(sql`update reeksstappen set status = 'tegengehouden', reden = ${`Tegengehouden door de Bewaker: ${b.reden ?? 'niet benaderen'}`} where id = ${s.id}`); continue }
    const due = s.kanaal === 'bellen' ? belMoment(eigenaar, new Date(s.geplandOp), inst) : new Date(s.geplandOp)
    const echte = stappen.filter((x) => x.kanaal !== 'einde').length
    const [t] = await tx.insert(schema.tasks).values({
      organisationId: org, ownerId: r.owner_id, accountId: a.id, contactId: r.contact_id ?? null, actionType: REEKS_ACTIE[s.kanaal as ReeksKanaal], priority: 'middel', dueDate: due.toISOString(),
      onderwerp: `${a.id}:reeks-${id}-${s.volgnummer}`, title: s.titel,
      data: { waarom: `Opvolgreeks ${r.naam}, stap ${s.volgnummer} van ${echte}${r.data?.aanleiding ? ` (na: ${r.data.aanleiding})` : ''}.`, herkomst: { bron: 'reeks', actiesoort: REEKS_ACTIE[s.kanaal as ReeksKanaal], uitvoerder: r.owner_id }, reeks: { id, stapId: s.id, n: s.volgnummer, van: echte } },
      createdAt: nu.toISOString(), updatedAt: nu.toISOString(),
    }).returning({ id: schema.tasks.id })
    let conceptId: string | null = null
    let reden: string | null = null
    if (s.kanaal !== 'bellen') {
      // De Schrijver via de AI-schil met credits: altijd een concept dat de mens goedkeurt.
      const k = await bereidVoor(tx, org, { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data }, { soort: 'taak', id: t!.id }, nu, { automatisch: !handmatig }).catch((e: any) => ({ id: null, status: 'mislukt', reden: e?.statusMessage ?? e?.message ?? 'Geen concept' }))
      if (k.status === 'klaar') conceptId = k.id
      else reden = `Nog geen concept: ${k.reden ?? 'de Schrijver gaf geen antwoord'}. Maak het concept zelf.`
    }
    await tx.execute(sql`update reeksstappen set status = 'open', task_id = ${t!.id}, concept_id = ${conceptId}, reden = ${reden} where id = ${s.id}`)
    klaargezet++
  }

  // 4. Mandaat B: een mailconcept op de dag zelf versturen, binnen het kader en opnieuw langs de Bewaker.
  if (r.mandaat === 'B') {
    for (const s of (await stappenVan(tx, id)).filter((x) => x.status === 'open' && x.kanaal === 'mail' && x.conceptId && Date.parse(x.geplandOp) <= nu.getTime() && !x.data?.autoGeprobeerd)) {
      await tx.execute(sql`update reeksstappen set data = data || '{"autoGeprobeerd": true}'::jsonb where id = ${s.id}`)
      const eerder = (await rijen(tx, sql`select 1 from activiteiten where account_id = ${a.id} and soort = 'mail' limit 1`)).length > 0
      const b = await toets(tx, org, { agent: 'verzender', handeling: 'mail.versturen', gebruiker: { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data }, accountId: a.id, contactId: r.contact_id, kanaal: 'mail', naarBuiten: true, binnenKader: true, eersteBericht: !eerder }, nu)
      if (b.uitvoering !== 'direct') { await tx.execute(sql`update reeksstappen set data = data || ${JSON.stringify({ autoMislukt: b.reden ?? 'Per stuk goedkeuren' })}::jsonb where id = ${s.id}`); continue }
      try {
        await besluit(tx, { id: eigenaar.id, rol: eigenaar.rol }, s.conceptId!, { besluit: 'goedkeuren' })
        await verstuurConcept(tx, org, { id: eigenaar.id, rol: eigenaar.rol, niveau: eigenaar.niveau, data: eigenaar.data }, s.conceptId!, opties.basisUrl ?? process.env.URL ?? 'http://localhost:3000', nu)
        await tx.execute(sql`update reeksstappen set status = 'gedaan', gedaan_op = ${nu.toISOString()} where id = ${s.id}`)
        await tx.execute(sql`update tasks set status = 'klaar', updated_at = now() where id = ${s.taskId} and status in ('open', 'bezig')`)
        verstuurd++
      } catch (e: any) {
        await tx.execute(sql`update reeksstappen set data = data || ${JSON.stringify({ autoMislukt: e?.statusMessage ?? 'Versturen lukte niet' })}::jsonb where id = ${s.id}`)
      }
    }
  }
  return { gestopt: null, klaargezet, verstuurd }
}

/** Een belstap landt in het eerste vaste belblok op de geplande dag; anders om 09:00. */
function belMoment(g: ReeksGebruiker, gepland: Date, inst: WerkdagInstelling): Date {
  const dag = nlMoment(gepland).datum
  const blok = volgendVastBlok(blokkenVan({ werkplek: g.werkplek, data: g.data }).blokken, nlTijdstip(dag, 0), inst)
  return blok && nlMoment(blok.start).datum === dag ? blok.start : gepland
}

/** Een handeling op één stap: concept maken, goedkeuren en versturen, LinkedIn kopiëren en afvinken, of overslaan. */
export async function stapActie(tx: Tx, org: string, g: ReeksGebruiker, reeksId: string, stapId: string, b: { actie?: string; tekst?: string | null; onderwerp?: string | null }, basisUrl: string, nu = new Date()) {
  const r = await leesReeks(tx, reeksId)
  if (r.owner_id !== g.id) fout(403, 'Alleen de eigenaar van de reeks handelt de stappen af')
  if (!['loopt', 'gepauzeerd'].includes(r.status)) fout(409, 'Deze reeks loopt niet meer')
  const s = (await stappenVan(tx, reeksId)).find((x) => x.id === stapId)
  if (!s) fout(404, 'Stap onbekend')
  const stap = s!
  if (stap.status !== 'open') fout(409, 'Deze stap staat niet open')
  let tekst = 'Klaar.'
  if (b.actie === 'concept') {
    if (stap.kanaal === 'bellen' || !stap.taskId) fout(422, 'Deze stap heeft geen concept')
    const k = await bereidVoor(tx, org, { id: g.id, niveau: g.niveau, data: g.data }, { soort: 'taak', id: stap.taskId! }, nu)
    if (k.status !== 'klaar') fout(502, k.reden ?? 'De Schrijver gaf geen bruikbaar antwoord')
    await tx.execute(sql`update reeksstappen set concept_id = ${k.id}, reden = null where id = ${stap.id}`)
    tekst = 'Concept klaar.'
  } else if (b.actie === 'verstuur') {
    if (stap.kanaal !== 'mail' || !stap.conceptId) fout(422, 'Deze stap heeft geen mailconcept')
    await besluit(tx, { id: g.id, rol: g.rol }, stap.conceptId!, { besluit: 'goedkeuren', tekst: b.tekst ?? null, onderwerp: b.onderwerp ?? null })
    await verstuurConcept(tx, org, { id: g.id, rol: g.rol, niveau: g.niveau, data: g.data }, stap.conceptId!, basisUrl, nu)
    await tx.execute(sql`update reeksstappen set status = 'gedaan', gedaan_op = ${nu.toISOString()} where id = ${stap.id}`)
    await tx.execute(sql`update tasks set status = 'klaar', updated_at = now() where id = ${stap.taskId} and status in ('open', 'bezig')`)
    tekst = 'Goedgekeurd en verstuurd.'
  } else if (b.actie === 'zelf-verstuurd' || b.actie === 'kopieer') {
    // Zelf verstuurd (eigen mail) of LinkedIn: kopiëren en afvinken. Dealtrace verstuurt LinkedIn nooit zelf.
    if (b.actie === 'kopieer' && stap.kanaal !== 'linkedin') fout(422, 'Kopiëren en afvinken is voor een LinkedIn-stap')
    if (b.actie === 'zelf-verstuurd' && stap.kanaal !== 'mail') fout(422, 'Dit is geen mailstap')
    if (stap.conceptId) await besluit(tx, { id: g.id, rol: g.rol }, stap.conceptId, { besluit: 'goedkeuren', tekst: b.tekst ?? null, onderwerp: b.onderwerp ?? null })
    if (stap.taskId) await rondAf(tx, stap.taskId, { uitkomst: 'verstuurd', sleutel: `reeks-${stap.id}` }, g.id, nu)
    await tx.execute(sql`update reeksstappen set status = 'gedaan', gedaan_op = ${nu.toISOString()} where id = ${stap.id}`)
    tekst = b.actie === 'kopieer' ? 'Tekst gekopieerd en de taak afgevinkt.' : 'Afgevinkt als verstuurd.'
  } else if (b.actie === 'overslaan') {
    if (stap.taskId) await tx.execute(sql`update tasks set status = 'geannuleerd', data = data || '{"annuleerReden": "Stap overgeslagen in de opvolgreeks"}'::jsonb, updated_at = now() where id = ${stap.taskId} and status in ('open', 'bezig')`)
    if (stap.conceptId) await tx.execute(sql`update concepten set status = 'verworpen', overname = 'verworpen', besloten_op = now() where id = ${stap.conceptId} and status = 'klaar'`)
    await tx.execute(sql`update reeksstappen set status = 'overgeslagen', reden = 'Overgeslagen' where id = ${stap.id}`)
    tekst = 'Stap overgeslagen.'
  } else fout(400, 'Kies concept, verstuur, zelf-verstuurd, kopieer of overslaan')
  return { tekst, reeks: await reeksVanAccount(tx, r.account_id, nu) }
}

/** De cron: alle lopende reeksen van de organisatie bijwerken. */
export async function reeksSweep(tx: Tx, org: string, nu = new Date(), basisUrl?: string) {
  const ids = (await rijen(tx, sql`select id from reeksen where status = 'loopt' order by gestart_op limit 500`)).map((x) => x.id as string)
  let gestopt = 0, klaargezet = 0, verstuurd = 0
  for (const id of ids) {
    const u = await werkReeksBij(tx, org, id, nu, { basisUrl })
    if (u.gestopt) gestopt++
    klaargezet += u.klaargezet
    verstuurd += u.verstuurd
  }
  return { reeksen: ids.length, gestopt, klaargezet, verstuurd }
}

