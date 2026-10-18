// Het overzicht van de opvolgreeksen (/opvolgreeksen) en het sjablonenbeheer (/instellingen/opvolgreeksen).
// Een accountmanager ziet zijn eigen reeksen; een salesmanager kiest Mijn reeksen of Mijn team; de beheerder ook de
// hele organisatie. Per reeks de stand in woorden (Concept, Open, Loopt, Raak, Gestopt), stap x van y en de volgende
// stap. Wat op jou wacht (een concept ter goedkeuring of een open stap) staat bovenaan. Ook de strip voor Prospects en
// de belmodus: per account de lopende reeks met stap x van y en de volgende stap.
import { sql } from 'drizzle-orm'
import {
  OVERZICHT_STANDEN, REEKS_UITKOMSTEN, STANDAARD_STOPREGELS, mandaatKeuzes, overzichtKop, overzichtStand, reeksStand, sorteerOverzicht, valideerSjabloon, weekRegel,
  type OverzichtStand, type ReeksKanaal, type ReeksStatus, type SjabloonStap, type Stopreden,
} from '../../shared/opvolgreeks'
import { laadAgentStand, mandaatVoor } from './agents/bewaker'
import { schrijfAudit } from './audit'
import { magVolgen, reeksUit, reeksVanAccount, sjabloonUit, sjablonen, werkReeksBij, type ReeksGebruiker } from './opvolgreeks'
import { teamLeden } from './planning'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())

export type Wie = 'mij' | 'team' | 'org'
export interface OverzichtFilter { wie?: string; stand?: string; sjabloon?: string; q?: string }

/** Welke eigenaren vallen in de gekozen reikwijdte? null is de hele organisatie. */
async function eigenaren(tx: Tx, g: ReeksGebruiker, wie: Wie): Promise<string[] | null> {
  if (wie === 'org' && g.rol === 'beheerder') return null
  if (wie === 'team' && (g.rol === 'salesmanager' || g.rol === 'beheerder')) return teamLeden(tx, { id: g.id, rol: g.rol })
  return [g.id]
}
export const wieKeuzes = (rol: string): Wie[] => (rol === 'beheerder' ? ['mij', 'team', 'org'] : rol === 'salesmanager' ? ['mij', 'team'] : ['mij'])

interface StapRij { reeks_id: string; volgnummer: number; kanaal: string; titel: string; status: string; gepland_op: string; concept_status: string | null }

/** De stappen van een set reeksen in één query, met de status van het concept. */
async function stappenVoor(tx: Tx, ids: string[]): Promise<Map<string, StapRij[]>> {
  const m = new Map<string, StapRij[]>()
  if (!ids.length) return m
  const rs = await rijen(tx, sql`select s.reeks_id, s.volgnummer, s.kanaal, s.titel, s.status, s.gepland_op, c.status as concept_status
    from reeksstappen s left join concepten c on c.id = s.concept_id where s.reeks_id in ${ids} order by s.reeks_id, s.volgnummer`)
  for (const r of rs) {
    const l = m.get(r.reeks_id) ?? []
    l.push({ ...(r as StapRij), gepland_op: iso(r.gepland_op)! })
    m.set(r.reeks_id, l)
  }
  return m
}

function regelVan(r: Rij, stappen: StapRij[], nu: Date) {
  const st = stappen.map((s) => ({ status: s.status as any, kanaal: s.kanaal as any, conceptStatus: s.concept_status }))
  const stand = reeksStand({ status: r.status, gestartOp: iso(r.gestart_op)!, stopreden: r.stopreden }, st, nu)
  const volgende = stappen.find((s) => s.status === 'open') ?? stappen.find((s) => s.status === 'gepland') ?? null
  return {
    id: r.id as string, naam: r.naam as string, status: r.status as ReeksStatus, stopreden: (r.stopreden ?? null) as Stopreden | null, mandaat: r.mandaat as 'B' | 'C',
    stand: overzichtStand({ status: r.status, stopreden: r.stopreden }, st), label: stand.label, stap: stand.stap, van: stand.van, wacht: stand.wacht, dag: stand.dag,
    account: { id: r.account_id as string, naam: r.account_naam as string }, contact: r.contact_id ? { id: r.contact_id as string, naam: [r.first_name, r.last_name].filter(Boolean).join(' ') } : null,
    eigenaar: { id: r.owner_id as string, naam: (r.eigenaar ?? null) as string | null }, sjabloonId: (r.sjabloon_id ?? null) as string | null,
    gestartOp: iso(r.gestart_op)!, gestoptOp: iso(r.gestopt_op), viaMail: !!r.data?.viaMail,
    volgende: volgende ? { kanaal: volgende.kanaal, titel: volgende.titel, geplandOp: volgende.gepland_op, open: volgende.status === 'open' } : null,
    volgendeOp: volgende?.gepland_op ?? null,
  }
}
export type OverzichtRegel = ReturnType<typeof regelVan>

/** Het overzicht: kop, weekregel, tellers per stand en de lijst (wat op jou wacht bovenaan). */
export async function reeksOverzicht(tx: Tx, org: string, g: ReeksGebruiker, f: OverzichtFilter, nu = new Date()) {
  const keuzes = wieKeuzes(g.rol)
  const wie = (keuzes.includes(f.wie as Wie) ? f.wie : 'mij') as Wie
  const wie_ids = await eigenaren(tx, g, wie)
  // Lopende reeksen eerst bijwerken (stopregels, klaarzetten), zodat de stand klopt; hooguit 50 per keer.
  const lopend = await rijen(tx, sql`select id from reeksen where status = 'loopt' and (${wie_ids === null} or owner_id in ${wie_ids ?? ['-']}) order by updated_at limit 50`)
  for (const l of lopend) await werkReeksBij(tx, org, l.id, nu, { gebruiker: g }).catch(() => null)
  const grens = new Date(nu.getTime() - 60 * 864e5).toISOString()
  const rs = await rijen(tx, sql`select r.*, a.name as account_naam, u.name as eigenaar, c.first_name, c.last_name from reeksen r
    join accounts a on a.id = r.account_id left join users u on u.id = r.owner_id left join contacts c on c.id = r.contact_id
    where (${wie_ids === null} or r.owner_id in ${wie_ids ?? ['-']}) and (r.status in ('loopt', 'gepauzeerd') or coalesce(r.gestopt_op, r.gestart_op) >= ${grens})
    order by r.gestart_op desc limit 400`)
  const stappen = await stappenVoor(tx, rs.map((r) => r.id))
  const alle = rs.map((r) => regelVan(r, stappen.get(r.id) ?? [], nu))
  const zoek = (f.q ?? '').trim().toLowerCase()
  const passend = alle.filter((x) => (!f.sjabloon || x.sjabloonId === f.sjabloon) && (!zoek || x.account.naam.toLowerCase().includes(zoek) || (x.contact?.naam ?? '').toLowerCase().includes(zoek)))
  const tellers = Object.fromEntries(OVERZICHT_STANDEN.map((s) => [s, passend.filter((x) => x.stand === s).length])) as Record<OverzichtStand, number>
  const stand = (OVERZICHT_STANDEN as readonly string[]).includes(f.stand ?? '') ? f.stand as OverzichtStand : null
  const lijst = sorteerOverzicht(stand ? passend.filter((x) => x.stand === stand) : passend)
  const lopendAantal = alle.filter((x) => x.status === 'loopt' || x.status === 'gepauzeerd').length
  const wachten = alle.filter((x) => x.eigenaar.id === g.id && (x.stand === 'concept' || x.stand === 'open')).length
  return {
    kop: overzichtKop(lopendAantal, wachten), week: weekRegel(alle.filter((x) => x.status === 'gestopt').map((x) => ({ stopreden: x.stopreden, gestoptOp: x.gestoptOp })), nu),
    wie, wieKeuzes: keuzes, tellers, totaal: passend.length, lijst,
    sjablonen: (await sjablonen(tx, org, { alle: true })).map((s) => ({ id: s.id, naam: s.naam, actief: s.actief })),
  }
}

/** De detailkolom: de reeks met stappen, concepten en taken (eerst bijgewerkt), plus wat jij mag. */
export async function reeksDetail(tx: Tx, org: string, g: ReeksGebruiker, id: string, nu = new Date()) {
  const [r] = await rijen(tx, sql`select r.id, r.account_id, r.status, r.owner_id, a.name as account_naam, a.owner_id as account_eigenaar from reeksen r join accounts a on a.id = r.account_id where r.id = ${id}`)
  if (!r) fout(404, 'Reeks onbekend')
  const ids = await eigenaren(tx, g, g.rol === 'beheerder' ? 'org' : 'team')
  if (ids !== null && !ids.includes(r!.owner_id)) fout(403, 'Deze reeks is van een collega buiten je team')
  if (r!.status === 'loopt') await werkReeksBij(tx, org, id, nu, { gebruiker: g })
  // reeksVanAccount geeft de lopende of laatste reeks; voor een oudere reeks lezen we hem rechtstreeks.
  const opAccount = await reeksVanAccount(tx, r!.account_id, nu)
  const reeks = opAccount?.id === id ? opAccount : await (async () => {
    const [rij] = await rijen(tx, sql`select r.*, u.name as eigenaar, c.first_name, c.last_name from reeksen r left join users u on u.id = r.owner_id left join contacts c on c.id = r.contact_id where r.id = ${id}`)
    return rij ? reeksUit(tx, rij, nu) : null
  })()
  const stand = await laadAgentStand(tx, org)
  const [eigenaar] = await rijen(tx, sql`select id, niveau, data from users where id = ${r!.owner_id}`)
  return {
    reeks, account: { id: r!.account_id as string, naam: r!.account_naam as string },
    stand: reeks ? overzichtStand({ status: reeks.status, stopreden: reeks.stopreden }, reeks.stappen.map((x) => ({ status: x.status as any, kanaal: x.kanaal, conceptStatus: x.concept?.status ?? null }))) : null,
    mandaten: mandaatKeuzes(mandaatVoor(stand, 'verzender', eigenaar ? { id: eigenaar.id, niveau: eigenaar.niveau, data: eigenaar.data } : null, true)),
    kan: { wijzigen: (await magVolgen(tx, g, r!.account_eigenaar ?? null)) || r!.owner_id === g.id, stappen: r!.owner_id === g.id },
  }
}

/** Per account de lopende of gepauzeerde reeks, voor de strip in Prospects en de belmodus. */
export async function lopendeReeksen(tx: Tx, accountIds: string[], nu = new Date()) {
  const m = new Map<string, { id: string; naam: string; status: ReeksStatus; stap: number; van: number; wacht: number; volgende: { kanaal: string; titel: string; geplandOp: string; open: boolean } | null }>()
  if (!accountIds.length) return m
  const rs = await rijen(tx, sql`select r.*, a.name as account_naam from reeksen r join accounts a on a.id = r.account_id where r.account_id in ${accountIds} and r.status in ('loopt', 'gepauzeerd')`)
  const stappen = await stappenVoor(tx, rs.map((r) => r.id))
  for (const r of rs) {
    const x = regelVan(r, stappen.get(r.id) ?? [], nu)
    m.set(r.account_id, { id: x.id, naam: x.naam, status: x.status, stap: x.stap, van: x.van, wacht: x.wacht, volgende: x.volgende })
  }
  return m
}

// Sjablonenbeheer.
export interface SjabloonInvoer { naam?: string; omschrijving?: string | null; na?: string | null; stappen?: SjabloonStap[]; einde?: { dag: number; wachtDagen: number }; uitkomsten?: string[]; stopregels?: Record<string, boolean>; actief?: boolean }

function schoonStappen(stappen: unknown): SjabloonStap[] {
  if (!Array.isArray(stappen)) return []
  return stappen.map((s: any) => ({
    dag: Number(s?.dag), kanaal: String(s?.kanaal ?? '') as ReeksKanaal, titel: String(s?.titel ?? '').trim(),
    ...(String(s?.onderwerp ?? '').trim() ? { onderwerp: String(s.onderwerp).trim() } : {}), ...(String(s?.instructie ?? '').trim() ? { instructie: String(s.instructie).trim() } : {}),
  })).sort((a, b) => a.dag - b.dag)
}

/** Een sjabloon maken (id null) of wijzigen. Fouten geven 422 met alle redenen. Lopende reeksen houden hun stappen. */
export async function bewaarSjabloon(tx: Tx, org: string, g: ReeksGebruiker, id: string | null, b: SjabloonInvoer) {
  const [oud] = id ? await rijen(tx, sql`select * from reekssjablonen where id = ${id}`) : []
  if (id && !oud) fout(404, 'Sjabloon onbekend')
  const nieuw = {
    naam: (b.naam ?? oud?.naam ?? '').trim().slice(0, 80), omschrijving: (b.omschrijving ?? oud?.omschrijving ?? '')?.toString().trim().slice(0, 300) || null,
    na: (b.na ?? oud?.na ?? '')?.toString().trim().slice(0, 80) || null,
    stappen: b.stappen !== undefined ? schoonStappen(b.stappen) : (oud?.stappen ?? []) as SjabloonStap[],
    einde: b.einde !== undefined ? { dag: Number(b.einde?.dag), wachtDagen: Number(b.einde?.wachtDagen) } : oud?.einde,
    uitkomsten: b.uitkomsten !== undefined ? [...new Set((b.uitkomsten ?? []).map(String))] : (oud?.uitkomsten ?? []) as string[],
    stopregels: { ...STANDAARD_STOPREGELS, ...(oud?.stopregels ?? {}), ...Object.fromEntries(Object.entries(b.stopregels ?? {}).filter(([k]) => k in STANDAARD_STOPREGELS).map(([k, v]) => [k, !!v])) },
    actief: b.actief !== undefined ? !!b.actief : oud ? oud.actief !== false : true,
  }
  const fouten = valideerSjabloon(nieuw as any)
  if (fouten.length) throw Object.assign(new Error(fouten.join('. ')), { statusCode: 422, statusMessage: fouten.join('. '), data: { fouten } })
  for (const u of nieuw.uitkomsten) if (!(REEKS_UITKOMSTEN as readonly string[]).includes(u)) fout(422, `Onbekende uitkomst ${u}`)
  const dubbel = await rijen(tx, sql`select 1 from reekssjablonen where lower(naam) = ${nieuw.naam.toLowerCase()} and id <> ${id ?? ''}`)
  if (dubbel.length) fout(409, 'Er is al een sjabloon met deze naam')
  const uitk = `{${nieuw.uitkomsten.join(',')}}`
  let sjabloonId = id
  if (id) {
    await tx.execute(sql`update reekssjablonen set naam = ${nieuw.naam}, omschrijving = ${nieuw.omschrijving}, na = ${nieuw.na}, stappen = ${JSON.stringify(nieuw.stappen)}::jsonb, einde = ${JSON.stringify(nieuw.einde)}::jsonb,
      uitkomsten = ${uitk}::text[], stopregels = ${JSON.stringify(nieuw.stopregels)}::jsonb, actief = ${nieuw.actief}, gewijzigd_door = ${g.id}, updated_at = now() where id = ${id}`)
  } else {
    const sleutel = `eigen-${crypto.randomUUID().slice(0, 8)}`
    const [rij] = await rijen(tx, sql`insert into reekssjablonen (organisation_id, sleutel, naam, omschrijving, na, stappen, einde, uitkomsten, stopregels, actief, gewijzigd_door)
      values (${org}, ${sleutel}, ${nieuw.naam}, ${nieuw.omschrijving}, ${nieuw.na}, ${JSON.stringify(nieuw.stappen)}::jsonb, ${JSON.stringify(nieuw.einde)}::jsonb, ${uitk}::text[], ${JSON.stringify(nieuw.stopregels)}::jsonb, ${nieuw.actief}, ${g.id}) returning id`)
    sjabloonId = rij!.id
  }
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: id ? 'reekssjabloon.gewijzigd' : 'reekssjabloon.gemaakt', resourceType: 'reekssjabloon', resourceId: sjabloonId!, changes: { naam: nieuw.naam, actief: nieuw.actief, stappen: nieuw.stappen.length } })
  const [na] = await rijen(tx, sql`select * from reekssjablonen where id = ${sjabloonId}`)
  return sjabloonUit(na!)
}

/** Het beheer: alle sjablonen (ook uitgezette) met het aantal lopende reeksen per sjabloon. */
export async function sjablonenBeheer(tx: Tx, org: string) {
  const lijst = await sjablonen(tx, org, { alle: true })
  const tel = new Map((await rijen(tx, sql`select sjabloon_id, count(*)::int as n from reeksen where status in ('loopt', 'gepauzeerd') group by sjabloon_id`)).map((r) => [r.sjabloon_id, r.n as number]))
  return lijst.map((s) => ({ ...s, lopend: tel.get(s.id) ?? 0 }))
}

/**
 * De opvolgreeksen van één prospect (Meer, Opvolgreeksen op de accountkaart): de lopende of gepauzeerde reeks met
 * stap x van y en de volgende stap, de eerdere reeksen met hun uitkomst (nieuwste eerst, hooguit 20) en of je hier een
 * reeks mag starten, met de reden als het niet mag. Dezelfde regels als startReeks: eigenaar, zijn salesmanager of de
 * beheerder; niet op nee, overgedragen of gedeactiveerd; één lopende reeks per account. Een reeks van een collega
 * buiten je team staat erin, maar zonder detail (magOpenen false), net als GET /api/reeksen/:id.
 */
export async function reeksenVanAccount(tx: Tx, org: string, g: ReeksGebruiker, accountId: string, nu = new Date()) {
  const [a] = await rijen(tx, sql`select id, name, owner_id, nb_status, account_kind, to_jsonb(a) ->> 'gedeactiveerd_op' as gedeactiveerd_op from accounts a where a.id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  const lopendId = (await rijen(tx, sql`select id from reeksen where account_id = ${accountId} and status = 'loopt' limit 1`))[0]?.id
  if (lopendId) await werkReeksBij(tx, org, lopendId, nu, { gebruiker: g }).catch(() => null)
  const rs = await rijen(tx, sql`select r.*, a.name as account_naam, u.name as eigenaar, c.first_name, c.last_name from reeksen r
    join accounts a on a.id = r.account_id left join users u on u.id = r.owner_id left join contacts c on c.id = r.contact_id
    where r.account_id = ${accountId} order by (r.status in ('loopt', 'gepauzeerd')) desc, r.gestart_op desc limit 21`)
  const stappen = await stappenVoor(tx, rs.map((r) => r.id))
  const ids = await eigenaren(tx, g, g.rol === 'beheerder' ? 'org' : 'team')
  const lijst = rs.map((r) => ({
    ...regelVan(r, stappen.get(r.id) ?? [], nu),
    toelichting: (r.data?.stopToelichting ?? null) as string | null, mailOnderwerp: (r.data?.mailOnderwerp ?? null) as string | null,
    aanleiding: (r.data?.aanleiding ?? null) as string | null, magOpenen: ids === null || ids.includes(r.owner_id),
    gedaan: (stappen.get(r.id) ?? []).filter((s) => s.kanaal !== 'einde' && s.status === 'gedaan').length,
  }))
  const lopend = lijst.find((x) => x.status === 'loopt' || x.status === 'gepauzeerd') ?? null
  const eerdere = lijst.filter((x) => x !== lopend).slice(0, 20)
  const mag = await magVolgen(tx, g, a!.owner_id ?? null)
  const reden = !mag ? 'Alleen de eigenaar van deze prospect, zijn salesmanager of de beheerder start hier een reeks.'
    : a!.gedeactiveerd_op ? 'Deze prospect is gedeactiveerd; een gedeactiveerde prospect krijgt geen reeks.'
    : a!.nb_status === 'overgedragen' ? 'Deze prospect is overgedragen; het vervolg loopt in DealDrive of het CRM.'
    : a!.nb_status === 'nee' ? 'Deze prospect staat op nee; de afkoeling loopt nog.'
    : lopend ? `Op deze prospect loopt al de reeks ${lopend.naam}. Stop die eerst; één reeks per prospect.`
    : null
  return { account: { id: a!.id as string, naam: a!.name as string }, lopend, eerdere, kan: { starten: !reden, wijzigen: mag, reden } }
}
