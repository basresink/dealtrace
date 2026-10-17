// Team, coaching en resultaten op de server (P21, F20). De salesmanager ziet alleen zijn teams (server-side
// afgedwongen); een beheerder ziet alles. Elke cel komt uit dezelfde ruwe lijsten als de lijst die hij
// opent, zodat het aantal altijd klopt.
import { sql } from 'drizzle-orm'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { aandachtspunten, kpi, tempo, type KpiActiviteit, type Periode, type TeamRij } from '../../shared/team'
import { schrijfAudit } from './audit'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const lijst = (ids: string[]) => ids.join(',')
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())

export interface Kijker { id: string; rol: string }
/** De teams die deze gebruiker mag zien: beheerder alle, salesmanager de teams waar hij manager van is. */
export async function zichtbareTeams(tx: Tx, g: Kijker) {
  const alle = await rijen(tx, sql`select t.id, t.naam, t.manager_ids, (select count(*)::int from users u where u.team_id = t.id and u.status = 'actief' and u.role = 'accountmanager') as leden from teams t order by t.naam`)
  return alle.filter((t) => g.rol === 'beheerder' || (g.rol === 'salesmanager' && (t.manager_ids ?? []).includes(g.id))).filter((t) => t.leden > 0).map((t) => ({ id: t.id as string, naam: t.naam as string, leden: t.leden as number }))
}
export async function vereisTeam(tx: Tx, g: Kijker, teamId: string) {
  const t = (await zichtbareTeams(tx, g)).find((x) => x.id === teamId)
  if (!t) fout(403, 'Dit team valt niet onder jou')
  return t!
}
/** Mag de kijker deze accountmanager coachen of bekijken? */
export async function vereisTeamlid(tx: Tx, g: Kijker, gebruikerId: string) {
  const [u] = await rijen(tx, sql`select id, name, niveau, werkplek, team_id, role, email from users where id = ${gebruikerId} and status = 'actief'`)
  if (!u) fout(404, 'Gebruiker onbekend')
  if (g.rol !== 'beheerder' && !(await zichtbareTeams(tx, g)).some((t) => t.id === u!.team_id)) fout(403, 'Deze persoon valt niet onder jou')
  return u!
}
export async function ledenVan(tx: Tx, teamIds: string[]) {
  if (!teamIds.length) return []
  return rijen(tx, sql`select id, name as naam, niveau, werkplek, team_id from users where status = 'actief' and role = 'accountmanager' and team_id = any(string_to_array(${lijst(teamIds)}, ',')) order by name`)
}

export interface Ruw {
  activiteiten: (KpiActiviteit & { id: string; account: string | null; tekst: string | null; kanaal: string | null; bezwaar: string | null })[]
  achterstallig: { id: string; owner: string; title: string; due: string; account: string | null }[]
  afgerondOpDag: { id: string; owner: string; title: string; due: string }[]
  takenVandaag: { id: string; owner: string }[]
  belblokken: { id: string; gebruiker: string; start: string; status: string }[]
  concepten: { id: string; gebruiker: string; handeling: string; account: string | null }[]
  afsprakenGehouden: { id: string; owner: string; start: string; account: string | null; uitkomst: string | null }[]
  overgedragen: { id: string; door: string; op: string; account: string | null; naar: string }[]
}
/** De ruwe lijsten voor een groep gebruikers in een periode (NL-datums). */
export async function ruw(tx: Tx, ids: string[], p: Periode, nu = new Date()): Promise<Ruw> {
  const leeg: Ruw = { activiteiten: [], achterstallig: [], afgerondOpDag: [], takenVandaag: [], belblokken: [], concepten: [], afsprakenGehouden: [], overgedragen: [] }
  if (!ids.length) return leeg
  const van = nlTijdstip(p.van, 0).toISOString()
  const tot = nlTijdstip(plusDagen(p.tot, 1), 0).toISOString()
  const vandaagStart = nlTijdstip(nlMoment(nu).datum, 0).toISOString()
  const l = lijst(ids)
  const acts = await rijen(tx, sql`select a.id, a.door, a.op, a.soort, a.kanaal, a.uitkomst, a.account_id, acc.name as account, a.data->>'tekst' as tekst, a.data->>'bezwaar' as bezwaar,
      coalesce(c.rol = 'beslisser', false) as beslisser, coalesce(a.kanaal = 'intern', false) as intern
    from activiteiten a left join contacts c on c.id = a.contact_id left join accounts acc on acc.id = a.account_id
    where a.door = any(string_to_array(${l}, ',')) and a.op >= ${van} and a.op < ${tot} order by a.op`)
  const achter = await rijen(tx, sql`select t.id, t.owner_id, t.title, t.due_date, acc.name as account from tasks t left join accounts acc on acc.id = t.account_id
    where t.owner_id = any(string_to_array(${l}, ',')) and t.status in ('open', 'bezig') and t.due_date < ${vandaagStart} order by t.due_date`)
  const opDag = await rijen(tx, sql`select t.id, t.owner_id, t.title, t.due_date, t.status, t.updated_at from tasks t
    where t.owner_id = any(string_to_array(${l}, ',')) and t.due_date >= ${van} and t.due_date < ${tot} and t.status <> 'geannuleerd'`)
  const bb = await rijen(tx, sql`select id, gebruiker_id, start_op, status from belblok_sessies where gebruiker_id = any(string_to_array(${l}, ',')) and start_op >= ${van} and start_op < ${tot} and status <> 'geannuleerd'`)
  const co = await rijen(tx, sql`select c.id, c.gebruiker_id, c.handeling, acc.name as account from concepten c left join accounts acc on acc.id = c.account_id where c.gebruiker_id = any(string_to_array(${l}, ',')) and c.status = 'klaar'`)
  const ap = await rijen(tx, sql`select ap.id, ap.owner_id, ap.start_at, ap.uitkomst_code, acc.name as account from appointments ap left join accounts acc on acc.id = ap.account_id
    where ap.owner_id = any(string_to_array(${l}, ',')) and ap.status = 'afgerond' and ap.start_at >= ${van} and ap.start_at < ${tot}`)
  const ov = await rijen(tx, sql`select o.id, o.door, o.op, o.naar, acc.name as account from overdrachten o left join accounts acc on acc.id = o.account_id where o.door = any(string_to_array(${l}, ',')) and o.op >= ${van} and o.op < ${tot}`)
  const dagVan = (v: unknown) => nlMoment(new Date(String(v instanceof Date ? v.toISOString() : v))).datum
  return {
    activiteiten: acts.map((a) => ({ id: a.id, door: a.door, op: iso(a.op)!, soort: a.soort, uitkomst: a.uitkomst, accountId: a.account_id, account: a.account, beslisser: !!a.beslisser, intern: !!a.intern, tekst: a.tekst, kanaal: a.kanaal, bezwaar: a.bezwaar })),
    achterstallig: achter.map((t) => ({ id: t.id, owner: t.owner_id, title: t.title, due: iso(t.due_date)!, account: t.account })),
    // Op de dag afgerond: klaar en bijgewerkt op dezelfde NL-dag als de vervaldag.
    afgerondOpDag: opDag.filter((t) => t.status === 'klaar' && dagVan(t.updated_at) === dagVan(t.due_date)).map((t) => ({ id: t.id, owner: t.owner_id, title: t.title, due: iso(t.due_date)! })),
    takenVandaag: opDag.map((t) => ({ id: t.id, owner: t.owner_id })),
    belblokken: bb.map((b) => ({ id: b.id, gebruiker: b.gebruiker_id, start: iso(b.start_op)!, status: b.status })),
    concepten: co.map((c) => ({ id: c.id, gebruiker: c.gebruiker_id, handeling: c.handeling, account: c.account })),
    afsprakenGehouden: ap.map((a) => ({ id: a.id, owner: a.owner_id, start: iso(a.start_at)!, account: a.account, uitkomst: a.uitkomst_code })),
    overgedragen: ov.map((o) => ({ id: o.id, door: o.door, op: iso(o.op)!, account: o.account, naar: o.naar })),
  }
}

export const METRIEKEN = ['pogingen', 'gesprekken', 'beslisser', 'afspraken', 'achterstallig', 'afgerondOpDag', 'belblokkenGepland', 'belblokkenGehouden', 'afsprakenGehouden', 'overgedragen', 'concepten'] as const
export type Metriek = typeof METRIEKEN[number]
/** De records achter één cel; de cel is de lengte van deze lijst. */
export function celRecords(r: Ruw, gebruikerId: string, m: Metriek): { id: string; titel: string; meta: string; link: string | null }[] {
  const d = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  const acts = r.activiteiten.filter((a) => a.door === gebruikerId && !a.intern && ['gebeld', 'mail', 'bericht', 'bezoek', 'linkedin', 'whatsapp', 'kaart'].includes(a.soort))
  const NIET = new Set(['geen_reactie', 'voicemail', 'verzonden', 'niet_bereikt', 'verkeerd_nummer', 'bezet', '', null, undefined])
  const act = (l: typeof acts) => l.map((a) => ({ id: a.id, titel: a.account ?? 'Zonder account', meta: `${a.soort}${a.uitkomst ? ` · ${a.uitkomst}` : ''} · ${d(a.op)}`, link: a.accountId ? `/accounts/${a.accountId}` : null }))
  switch (m) {
    case 'pogingen': return act(acts)
    case 'gesprekken': return act(acts.filter((a) => !NIET.has(a.uitkomst as any)))
    case 'beslisser': return act(acts.filter((a) => !NIET.has(a.uitkomst as any) && a.beslisser))
    case 'afspraken': return act(acts.filter((a) => a.uitkomst === 'afspraak'))
    case 'achterstallig': return r.achterstallig.filter((t) => t.owner === gebruikerId).map((t) => ({ id: t.id, titel: t.title, meta: `vervallen ${d(t.due)}${t.account ? ` · ${t.account}` : ''}`, link: `/taken?taak=${t.id}` }))
    case 'afgerondOpDag': return r.afgerondOpDag.filter((t) => t.owner === gebruikerId).map((t) => ({ id: t.id, titel: t.title, meta: d(t.due), link: `/taken?taak=${t.id}` }))
    case 'belblokkenGepland': return r.belblokken.filter((b) => b.gebruiker === gebruikerId).map((b) => ({ id: b.id, titel: `Belblok ${d(b.start)}`, meta: b.status, link: null }))
    case 'belblokkenGehouden': return r.belblokken.filter((b) => b.gebruiker === gebruikerId && b.status === 'klaar').map((b) => ({ id: b.id, titel: `Belblok ${d(b.start)}`, meta: 'gehouden', link: null }))
    case 'afsprakenGehouden': return r.afsprakenGehouden.filter((a) => a.owner === gebruikerId).map((a) => ({ id: a.id, titel: a.account ?? 'Afspraak', meta: `${d(a.start)}${a.uitkomst ? ` · ${a.uitkomst}` : ''}`, link: `/agenda?afspraak=${a.id}` }))
    case 'overgedragen': return r.overgedragen.filter((o) => o.door === gebruikerId).map((o) => ({ id: o.id, titel: o.account ?? 'Overdracht', meta: `naar ${o.naar} · ${d(o.op)}`, link: null }))
    case 'concepten': return r.concepten.filter((c) => c.gebruiker === gebruikerId).map((c) => ({ id: c.id, titel: c.account ?? c.handeling, meta: c.handeling, link: '/concepten' }))
  }
}

/** De teamtabel, aandachtspunten, werkverdeling en goedkeuringen. */
export async function teamOverzicht(tx: Tx, g: Kijker, teamId: string, p: Periode, nu = new Date()) {
  const team = await vereisTeam(tx, g, teamId)
  const leden = await ledenVan(tx, [teamId])
  const r = await ruw(tx, leden.map((l) => l.id), p, nu)
  const tel = (id: string, m: Metriek) => celRecords(r, id, m).length
  const rijenTeam: (TeamRij & Record<string, any>)[] = leden.map((l) => {
    const k = kpi(l.id, p, r.activiteiten)
    const takenDag = r.takenVandaag.filter((t) => t.owner === l.id).length
    return {
      id: l.id, naam: l.naam, niveau: l.niveau, werkplek: l.werkplek, kpi: k,
      achterstallig: tel(l.id, 'achterstallig'), belblokkenGepland: tel(l.id, 'belblokkenGepland'), belblokkenGehouden: tel(l.id, 'belblokkenGehouden'), conceptenWachten: tel(l.id, 'concepten'),
      afgerondOpDag: tel(l.id, 'afgerondOpDag'), takenOpDag: takenDag, afgerondProcent: takenDag ? Math.round((tel(l.id, 'afgerondOpDag') / takenDag) * 100) : null,
      afsprakenGehouden: tel(l.id, 'afsprakenGehouden'), overgedragen: tel(l.id, 'overgedragen'), tempo: tempo(k, l.werkplek),
    }
  })
  const vandaag = nlMoment(nu).datum
  const [terug] = await rijen(tx, sql`select count(*)::int as n from accounts where owner_id = any(string_to_array(${lijst(leden.map((l) => l.id)) || '-'}, ',')) and nb_status = 'wachtend' and terug_op between ${vandaag} and ${plusDagen(vandaag, 7)}`)
  const verdeling = await rijen(tx, sql`select owner_id, coalesce(fase_id, '-') as fase, nb_status, count(*)::int as n from accounts where account_kind = 'prospect' and owner_id = any(string_to_array(${lijst(leden.map((l) => l.id)) || '-'}, ',')) group by 1, 2, 3 order by 1, 2`)
  // Faselabels uit de reizen, zodat de chips "Afspraak gehouden" tonen en geen ruwe fase-id (B21).
  const faseLabels = new Map<string, string>()
  for (const r of await rijen(tx, sql`select data from reistemplates`)) for (const f of ((r.data as any)?.fases ?? []) as { id: string; label: string }[]) if (!faseLabels.has(f.id)) faseLabels.set(f.id, f.label)
  const goedkeuringen = [
    ...(await rijen(tx, sql`select id, naam, 'reis' as soort from reistemplates where status = 'concept'`)).map((x) => ({ id: x.id, soort: 'Reisversie', titel: x.naam, link: `/reizen/${x.id}` })),
    ...(await rijen(tx, sql`select id, naam from campagnes where status = 'concept' and coalesce((data->>'bovenCapaciteit')::boolean, false)`)).map((x) => ({ id: x.id, soort: 'Campagne boven capaciteit', titel: x.naam, link: `/campagnes/${x.id}` })),
  ]
  const opSchema = rijenTeam.filter((x) => x.tempo.stand === 'op schema').length
  return {
    team, teams: await zichtbareTeams(tx, g), periode: p,
    kop: rijenTeam.length ? `${opSchema === rijenTeam.length ? 'Iedereen ligt' : `${opSchema} van de ${rijenTeam.length} liggen`} op schema.` : 'Er zit nog niemand in dit team.',
    rijen: rijenTeam, aandachtspunten: aandachtspunten(rijenTeam, { terugDezeWeek: terug?.n ?? 0 }),
    werkverdeling: leden.map((l) => ({ id: l.id, naam: l.naam, fases: verdeling.filter((v) => v.owner_id === l.id).map((v) => ({ fase: v.fase, label: faseLabels.get(v.fase) ?? (v.fase === '-' ? 'Zonder fase' : v.fase), status: v.nb_status, aantal: v.n })) })),
    goedkeuringen, stapels: await teamStapels(tx, leden as any),
  }
}

/** Telefoonstapels (8.12): gesprekken zonder verslag, eerste afspraken niet overgedragen, achter op het ritme. */
export async function teamStapels(tx: Tx, leden: { id: string; naam: string }[]) {
  const ids = lijst(leden.map((l) => l.id)) || '-'
  const zonder = await rijen(tx, sql`select owner_id, count(*)::int as n from appointments where owner_id = any(string_to_array(${ids}, ',')) and status = 'afgerond' and coalesce(data->'verslag'->>'tekst', '') = '' group by 1`)
  const nietOver = await rijen(tx, sql`select ap.owner_id, count(*)::int as n from appointments ap join accounts a on a.id = ap.account_id where ap.owner_id = any(string_to_array(${ids}, ',')) and ap.status = 'afgerond' and coalesce((ap.data->>'overdragen')::boolean, false) and a.nb_status <> 'overgedragen' group by 1`)
  const achter = await rijen(tx, sql`select owner_id, count(*)::int as n from tasks where owner_id = any(string_to_array(${ids}, ',')) and status in ('open', 'bezig') and data->'poging' is not null and due_date < now() group by 1`)
  const per = (l: Rij[]) => leden.map((x) => ({ id: x.id, naam: x.naam, aantal: l.find((r) => r.owner_id === x.id)?.n ?? 0 })).filter((x) => x.aantal > 0)
  return { zonderVerslag: per(zonder), nietOvergedragen: per(nietOver), achterOpRitme: per(achter) }
}

/** nb_kpi_dag: per gebruiker per dag de kernmetrieken, opnieuw te berekenen uit de activiteitenlog. */
export async function herberekenKpi(tx: Tx, org: string, p: Periode) {
  const gebruikers = (await rijen(tx, sql`select id from users where status = 'actief' and role in ('accountmanager', 'salesmanager')`)).map((u) => u.id as string)
  const r = await ruw(tx, gebruikers, p)
  await tx.execute(sql`delete from nb_kpi_dag where datum between ${p.van} and ${p.tot}`)
  let n = 0
  for (let d = p.van; d <= p.tot; d = plusDagen(d, 1)) {
    for (const g of gebruikers) {
      const k = kpi(g, { van: d, tot: d }, r.activiteiten)
      if (!k.pogingen) continue
      for (const [m, w] of [['pogingen', k.pogingen], ['gesprekken', k.gesprekken], ['beslisser', k.beslisser], ['afspraken', k.afspraken]] as const) {
        await tx.execute(sql`insert into nb_kpi_dag (organisation_id, gebruiker_id, datum, metriek, waarde) values (${org}, ${g}, ${d}, ${m}, ${w})`)
        n++
      }
    }
  }
  return n
}
/** Weekreeks uit nb_kpi_dag voor de trend (laatste vier weken). */
export async function weekreeks(tx: Tx, gebruikerIds: string[], van: string) {
  return rijen(tx, sql`select gebruiker_id, date_trunc('week', datum)::date as week, metriek, sum(waarde)::float as waarde from nb_kpi_dag
    where gebruiker_id = any(string_to_array(${lijst(gebruikerIds) || '-'}, ',')) and datum >= ${van} group by 1, 2, 3 order by 2`)
}

/** "Verplaats" (Werkverdeling): accounts van de eigen teams naar iemand in de eigen teams, met reden en een auditregel per account. */
/** opties.ontvangers: de toegestane ontvangers als de aanroeper die zelf al controleerde (archiveren met overdracht). */
export async function verplaatsAccounts(tx: Tx, org: string, g: Kijker, b: { accountIds?: string[]; van?: { gebruiker: string; fase: string } | null; naarGebruiker?: string; reden?: string }, opties: { ontvangers?: string[] } = {}) {
  const reden = b.reden?.trim()
  if (!reden) fout(422, 'Geef een reden')
  let ids = [...new Set((b.accountIds ?? []).filter((x) => typeof x === 'string'))].slice(0, 500)
  if (!ids.length && b.van?.gebruiker && b.van.fase) ids = (await rijen(tx, sql`select id from accounts where owner_id = ${b.van.gebruiker} and account_kind = 'prospect' and coalesce(fase_id, '-') = ${b.van.fase} limit 500`)).map((r) => r.id as string)
  if (!ids.length || !b.naarGebruiker) fout(422, 'Kies accounts en een collega')
  const leden = opties.ontvangers ?? (await ledenVan(tx, (await zichtbareTeams(tx, g)).map((t) => t.id))).map((l) => l.id as string)
  if (!leden.includes(b.naarGebruiker!)) fout(403, 'Deze collega valt niet onder jou')
  const accounts = await rijen(tx, sql`select id, owner_id from accounts where id = any(string_to_array(${ids.join(',')}, ','))`)
  if (accounts.length !== ids.length || accounts.some((a) => !leden.includes(a.owner_id) && g.rol !== 'beheerder')) fout(403, 'Niet alle accounts vallen onder jou')
  for (const a of accounts) {
    await tx.execute(sql`update accounts set owner_id = ${b.naarGebruiker!}, updated_at = now() where id = ${a.id}`)
    await tx.execute(sql`update tasks set owner_id = ${b.naarGebruiker!}, updated_at = now() where account_id = ${a.id} and status in ('open', 'bezig') and owner_id = ${a.owner_id}`)
    await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'account.eigenaar', resourceType: 'accounts', resourceId: a.id, changes: { van: a.owner_id, naar: b.naarGebruiker }, metadata: { reden } })
  }
  return { aantal: accounts.length }
}
