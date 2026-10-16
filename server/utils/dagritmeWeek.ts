// Het dagritme op de server: weekreview (vrijdag), weekstart (maandag) en dagstart (elke werkdag), en
// de mails ervan. Laadt de brondata van één gebruiker binnen metOrganisatie (RLS) en draait de pure
// kern uit shared/weekreview.ts, shared/dagritme.ts en shared/dagritmeMail.ts, zodat scherm en mail
// hetzelfde zeggen. Elke wijziging (besluit over een blijver, voornemens inplannen) schrijft een
// auditregel in dezelfde transactie.
import { sql } from 'drizzle-orm'
import { bereikVoorDoelgroep, bouwWeekstart, planDag, planModus, watSchoof, weekVan, type BereikPoging, type PlanBlok, type VastPunt } from '../../shared/dagritme'
import { DAGRITME_MAILS, DAGRITME_MAIL_ROUTE, dagstartMail, mailAanDeBeurt, mailSleutel, mailVoorkeuren, weekreviewMail, weekstartMail, type DagritmeMail } from '../../shared/dagritmeMail'
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, type WerkdagInstelling } from '../../shared/datum'
import { regiodagVan } from '../../shared/gebieden'
import { houdtVast } from '../../shared/kanalen'
import { schatReistijd, type Punt } from '../../shared/route'
import { CONTACT_SOORTEN, isGesproken } from '../../shared/team'
import { BLIJVER_VANAF, belblokMomenten, controleerVoornemens, eersteWerkdag, maandagVan, voornaam, voornemenStand, weekreview, type BlijverBesluit, type VoornemenBron } from '../../shared/weekreview'
import { schrijfAudit } from './audit'
import { hangAanBlok, sessieOp } from './bellen'
import { bezoekDag, gebiedenInstelling } from './bezoeken'
import { gebruikDb } from './db'
import { stuurMeldingMail } from './mailer'
import { instellingVan } from './onderwegMeldingen'
import { ruw } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const lijst = (ids: string[]) => ids.join(',')
const hhmm = (v: string) => { const m = nlMoment(new Date(v)); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }

export interface DagritmeGebruiker { id: string; naam: string; email: string | null; werkplek: string; niveau: 'beginner' | 'gevorderd' | 'expert'; rol: string; teamId: string | null; data: Record<string, any> }

export async function gebruikerVan(tx: Tx, id: string): Promise<DagritmeGebruiker> {
  const [u] = await rijen(tx, sql`select id, name, email, werkplek, niveau, role, team_id, data from users where id = ${id}`)
  if (!u) fout(404, 'Gebruiker onbekend')
  return { id: u!.id, naam: u!.name, email: u!.email ?? null, werkplek: u!.werkplek ?? 'binnendienst', niveau: u!.niveau ?? 'beginner', rol: u!.role, teamId: u!.team_id ?? null, data: u!.data ?? {} }
}
async function werkdagen(tx: Tx): Promise<WerkdagInstelling> {
  const [r] = await rijen(tx, sql`select value from org_settings where key = 'werkdagen'`)
  return (r?.value as WerkdagInstelling) ?? {}
}
async function moment(tx: Tx, gebruikerId: string, soort: 'weekreview' | 'weekstart' | 'dagstart', datum: string): Promise<Record<string, any> | null> {
  const [r] = await rijen(tx, sql`select data from dagritme_momenten where gebruiker_id = ${gebruikerId} and soort = ${soort} and datum = ${datum}`)
  return (r?.data as Record<string, any>) ?? null
}
async function zetMoment(tx: Tx, org: string, gebruikerId: string, soort: 'weekreview' | 'weekstart' | 'dagstart', datum: string, patch: Record<string, unknown>) {
  await tx.execute(sql`insert into dagritme_momenten (organisation_id, gebruiker_id, soort, datum, data) values (${org}, ${gebruikerId}, ${soort}, ${datum}, ${JSON.stringify(patch)}::jsonb)
    on conflict (gebruiker_id, soort, datum) do update set data = dagritme_momenten.data || excluded.data, bijgewerkt_op = now()`)
}
/** De manager van het team van de gebruiker (de eerste die niet hijzelf is). */
async function managerVan(tx: Tx, g: DagritmeGebruiker): Promise<{ id: string; naam: string } | null> {
  if (!g.teamId) return null
  const [m] = await rijen(tx, sql`select u.id, u.name from teams t join users u on u.id = any(t.manager_ids) where t.id = ${g.teamId} and u.id <> ${g.id} and u.status = 'actief' order by u.name limit 1`)
  return m ? { id: m.id, naam: m.name } : null
}
async function collegasVan(tx: Tx, g: DagritmeGebruiker) {
  return (await rijen(tx, sql`select id, name from users where id <> ${g.id} and status = 'actief' and role in ('accountmanager', 'salesmanager') order by (team_id = ${g.teamId ?? ''}) desc, name limit 30`))
    .map((u) => ({ id: u.id as string, naam: String(u.name).replace(/^Testgebruiker /, '') }))
}

/** Voornemens met hun stand uit de taken en belblokken die ze werden. */
async function voornemensMetStand(tx: Tx, gebruikerId: string, week: string, nu: Date) {
  const v = await rijen(tx, sql`select id, tekst, soort, status, gedeeld, data from voornemens where gebruiker_id = ${gebruikerId} and week = ${week} order by created_at`)
  const taakIds = v.flatMap((x) => x.data?.taakIds ?? [])
  const sessieIds = v.flatMap((x) => x.data?.sessieIds ?? [])
  const taken = taakIds.length ? await rijen(tx, sql`select id, status from tasks where id = any(string_to_array(${lijst(taakIds)}, ','))`) : []
  const sessies = sessieIds.length ? await rijen(tx, sql`select id, status, start_op from belblok_sessies where id = any(string_to_array(${lijst(sessieIds)}, ','))`) : []
  const bron = { taken: taken.map((t) => ({ id: t.id, status: t.status })), sessies: sessies.map((s) => ({ id: s.id, status: s.status, start: iso(s.start_op)! })) }
  return v.map((x) => {
    const b: VoornemenBron = { id: x.id, tekst: x.tekst, soort: x.soort, status: x.status, gedeeld: x.gedeeld, data: x.data ?? {} }
    return { ...b, stand: voornemenStand(b, bron, nu) }
  })
}

// ── Weekreview ─────────────────────────────────────────────────────────────

/** Welke week de review bekijkt: de gevraagde (deze of vorige), op maandag de vorige als je hem verzette. */
async function reviewMaandag(tx: Tx, g: DagritmeGebruiker, nu: Date, gevraagd?: string | null): Promise<string> {
  const deze = maandagVan(nlMoment(nu).datum)
  const vorige = plusDagen(deze, -7)
  if (gevraagd) {
    if (gevraagd !== deze && gevraagd !== vorige) fout(400, 'Kies deze of vorige week')
    return gevraagd
  }
  const dag = new Date(`${nlMoment(nu).datum}T12:00:00Z`).getUTCDay()
  if (dag >= 1 && dag <= 2) {
    const m = await moment(tx, g.id, 'weekreview', vorige)
    if (m?.verzet && !m.afgerondOp) return vorige
  }
  return deze
}

export async function laadWeekreview(tx: Tx, gebruikerId: string, nu = new Date(), opties: { maandag?: string | null } = {}) {
  const g = await gebruikerVan(tx, gebruikerId)
  const w = await werkdagen(tx)
  const maandag = await reviewMaandag(tx, g, nu, opties.maandag)
  const volgende = plusDagen(maandag, 7)
  const r = await ruw(tx, [g.id], { van: plusDagen(maandag, -56), tot: plusDagen(maandag, 4) }, nu)
  const m = (await moment(tx, g.id, 'weekreview', maandag)) ?? {}
  const besluiten: Record<string, any> = m.besluiten ?? {}
  const open = await rijen(tx, sql`select t.id, t.title, t.verschoven, t.due_date, t.action_type, t.account_id, a.name from tasks t left join accounts a on a.id = t.account_id
    where t.owner_id = ${g.id} and t.status in ('open', 'bezig') and t.verschoven >= ${BLIJVER_VANAF} order by t.verschoven desc, t.title limit 25`)
  const blijvers = [
    ...open.filter((t) => !besluiten[t.id]).map((t) => ({ id: t.id, titel: t.title, accountNaam: t.name ?? null, accountId: t.account_id ?? null, verschoven: t.verschoven, dueDate: iso(t.due_date), actionType: t.action_type })),
    ...Object.entries(besluiten).map(([id, b]) => ({ id, titel: b.titel, accountNaam: b.accountNaam ?? null, accountId: b.accountId ?? null, verschoven: b.verschoven ?? BLIJVER_VANAF, dueDate: null, actionType: b.actionType ?? 'taak' })),
  ]
  const vanT = nlTijdstip(maandag, 0).toISOString()
  const afspraakAccounts = [...new Set(r.activiteiten.filter((a) => a.uitkomst === 'afspraak' && a.accountId && a.op >= vanT).map((a) => a.accountId!))]
  const winpunten = afspraakAccounts.length ? (await rijen(tx, sql`select distinct on (account_id) account_id, data->'winpunt'->>'titel' as titel from belscript_invullingen
    where account_id = any(string_to_array(${lijst(afspraakAccounts)}, ',')) and data->'winpunt'->>'titel' is not null order by account_id, op desc`)).map((x) => ({ accountId: x.account_id, titel: x.titel })) : []
  // Regio's met stille eigen accounts (30 dagen geen contact) voor een regiodag; niet voor de binnendienst.
  let regios: { id: string; naam: string; stil: number; accountIds: string[]; datum: string | null }[] = []
  if (g.werkplek !== 'binnendienst') {
    const { regios: alle } = await gebiedenInstelling(tx)
    const stil = await rijen(tx, sql`select id, gebied_id from accounts where owner_id = ${g.id} and gebied_id is not null and nb_status not in ('overgedragen', 'nee', 'geparkeerd')
      and (laatste_contact_op is null or laatste_contact_op < ${new Date(nu.getTime() - 30 * 864e5).toISOString()}) order by laatste_contact_op nulls first, name limit 200`)
    const feest = ((w as { feestdagen?: string[] }).feestdagen ?? []) as string[]
    regios = alle.map((x) => {
      const ids = stil.filter((a) => a.gebied_id === x.id).map((a) => a.id as string)
      const datum = [0, 1, 2, 3, 4].map((i) => plusDagen(volgende, i)).find((d) => regiodagVan(g.id, d, [x], feest)) ?? null
      return { id: x.id, naam: x.naam, stil: ids.length, accountIds: ids, datum }
    }).filter((x) => x.stil)
  }
  const [zv] = await rijen(tx, sql`select count(*)::int as n from appointments where owner_id = ${g.id} and status = 'gepland' and end_at < ${nu.toISOString()} and end_at >= ${vanT}`)
  const collegas = await collegasVan(tx, g)
  const review = weekreview({
    gebruiker: { id: g.id, naam: g.naam, werkplek: g.werkplek },
    activiteiten: r.activiteiten, overdrachten: r.overgedragen.map((o) => o.op), blijvers, winpunten, regios, zonderVerslag: zv?.n ?? 0,
    besluiten, collegas: collegas.length > 0,
    lopend: await voornemensMetStand(tx, g.id, maandag, nu),
    ingepland: (await voornemensMetStand(tx, g.id, volgende, nu)),
    werkdagen: w,
  }, nu, { maandag })
  return { ...review, manager: await managerVan(tx, g), collegas, verzet: !!m.verzet, afgerondOp: m.afgerondOp ?? null, deelStandaard: !!g.data?.weekreviewDelen }
}

export interface BlijverInvoer { taakId: string; besluit: BlijverBesluit; datum?: string | null; naar?: string | null; reden?: string | null }

/** Plan in, Draag over of Laat los met een reden. Alleen je eigen open taken. */
export async function besluitBlijver(tx: Tx, org: string, gebruikerId: string, maandag: string, b: BlijverInvoer, nu = new Date()) {
  const [t] = await rijen(tx, sql`select t.id, t.title, t.owner_id, t.status, t.due_date, t.verschoven, t.action_type, t.account_id, a.name from tasks t left join accounts a on a.id = t.account_id where t.id = ${b.taakId}`)
  if (!t || t.owner_id !== gebruikerId) fout(404, 'Taak onbekend')
  if (!['open', 'bezig'].includes(t!.status)) fout(409, 'Deze taak is al afgerond')
  const snap = { titel: t!.title, accountNaam: t!.name ?? null, accountId: t!.account_id ?? null, verschoven: t!.verschoven, actionType: t!.action_type, op: nu.toISOString() }
  let extra: Record<string, unknown> = {}
  if (b.besluit === 'inplannen') {
    if (!b.datum || !/^\d{4}-\d{2}-\d{2}$/.test(b.datum) || b.datum < nlMoment(nu).datum) fout(422, 'Kies een datum vanaf vandaag')
    const oud = t!.due_date ? nlMoment(new Date(iso(t!.due_date)!)) : null
    const nieuw = nlTijdstip(b.datum!, oud ? oud.uur : 9, oud ? oud.minuut : 0)
    await tx.execute(sql`update tasks set due_date = ${nieuw.toISOString()}, updated_at = now() where id = ${t!.id}`)
    // Bewust ingepland: de teller begint opnieuw.
    await tx.execute(sql`update tasks set verschoven = 0 where id = ${t!.id}`)
    extra = { datum: b.datum }
  } else if (b.besluit === 'overdragen') {
    const [naar] = b.naar ? await rijen(tx, sql`select id, name from users where id = ${b.naar} and status = 'actief' and role in ('accountmanager', 'salesmanager') and id <> ${gebruikerId}`) : []
    if (!naar) fout(422, 'Kies een collega')
    await tx.execute(sql`update tasks set owner_id = ${naar!.id}, verschoven = 0, updated_at = now(), data = data || ${JSON.stringify({ overgedragenDoor: gebruikerId, overgedragenOp: nu.toISOString() })}::jsonb where id = ${t!.id}`)
    const [ik] = await rijen(tx, sql`select name from users where id = ${gebruikerId}`)
    await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${naar!.id}, 'systeem', ${`Taak overgedragen door ${voornaam(String(ik?.name ?? ''))}`}, ${t!.title}, ${`/taken?taak=${t!.id}`}, ${nu.toISOString()}, '{}'::jsonb)`)
    extra = { naar: naar!.id, naarNaam: String(naar!.name).replace(/^Testgebruiker /, '') }
  } else if (b.besluit === 'loslaten') {
    const reden = (b.reden ?? '').trim()
    if (reden.length < 3) fout(422, 'Geef een reden om los te laten')
    if (/[–—]/.test(reden)) fout(422, 'Gebruik geen gedachtestreepjes')
    await tx.execute(sql`update tasks set status = 'geannuleerd', updated_at = now(), data = data || ${JSON.stringify({ losgelaten: { reden: reden.slice(0, 200), op: nu.toISOString(), bron: 'weekreview' } })}::jsonb where id = ${t!.id}`)
    extra = { reden: reden.slice(0, 200) }
  } else fout(422, 'Kies Plan in, Draag over of Laat los')
  const [m] = await rijen(tx, sql`select data from dagritme_momenten where gebruiker_id = ${gebruikerId} and soort = 'weekreview' and datum = ${maandag}`)
  const besluiten = { ...((m?.data?.besluiten as object) ?? {}), [t!.id]: { besluit: b.besluit, ...snap, ...extra } }
  await zetMoment(tx, org, gebruikerId, 'weekreview', maandag, { besluiten })
  await schrijfAudit(tx, { organisationId: org, actorId: gebruikerId, action: `weekreview.blijver.${b.besluit}`, resourceType: 'task', resourceId: t!.id, changes: extra, metadata: { week: maandag, verschoven: t!.verschoven } })
  return { taakId: t!.id, besluit: b.besluit, ...extra }
}

export interface VoornemenInvoer { soort: 'belblok' | 'taak' | 'regiodag'; tekst: string; data?: Record<string, any> }

/** De gekozen voornemens worden meteen iets concreets in de week erna; delen zet ze in coaching. */
export async function planVoornemens(tx: Tx, org: string, gebruikerId: string, maandag: string, lijstIn: VoornemenInvoer[], delen: boolean, nu = new Date()) {
  const f = controleerVoornemens(lijstIn)
  if (f.length) fout(422, f.join('. '))
  const g = await gebruikerVan(tx, gebruikerId)
  const w = await werkdagen(tx)
  const week = plusDagen(maandag, 7)
  const [al] = await rijen(tx, sql`select count(*)::int as n from voornemens where gebruiker_id = ${g.id} and week = ${week}`)
  if (al?.n) fout(409, 'De voornemens voor volgende week staan er al')
  const eerste = eersteWerkdag(week, w)
  const manager = delen ? await managerVan(tx, g) : null
  if (delen && !manager) fout(422, 'Je team heeft geen manager om mee te delen')
  const uit: { id: string; tekst: string; soort: string; wordt: string[] }[] = []
  for (const v of lijstIn) {
    const tekst = v.tekst.trim()
    const data: Record<string, any> = { ...(v.data ?? {}) }
    const wordt: string[] = []
    if (v.soort === 'belblok') {
      const momenten = belblokMomenten(data, week, w)
      if (!momenten.length) fout(422, `Geen werkdag voor "${tekst}"`)
      const sessieIds: string[] = []
      for (const m of momenten) {
        const start = nlTijdstip(m.datum, m.uur, m.minuut)
        const s = await sessieOp(tx, org, g.id, start.toISOString(), new Date(start.getTime() + m.minuten * 60_000).toISOString(), { handmatig: true, soort: 'voornemen' } as any)
        sessieIds.push(s.id)
        wordt.push(`Belblok ${m.datum} ${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}`)
      }
      data.sessieIds = sessieIds
    } else if (v.soort === 'taak') {
      const datum = typeof data.datum === 'string' && data.datum >= week && data.datum <= plusDagen(week, 4) && isWerkdag(data.datum, w) ? data.datum : eerste
      const due = nlTijdstip(datum, Math.min(17, Math.max(7, Number(data.uur ?? 9))), Number(data.minuut ?? 0))
      const [t] = await rijen(tx, sql`insert into tasks (organisation_id, owner_id, action_type, title, priority, due_date, executor, data) values (${org}, ${g.id}, 'taak', ${String(data.titel ?? tekst).slice(0, 140)}, 'middel', ${due.toISOString()}, 'mens',
        ${JSON.stringify({ waarom: 'Je voornemen uit de weekreview.', herkomst: { bron: 'weekreview', actiesoort: 'taak', uitvoerder: g.id }, voornemen: true })}::jsonb) returning id`)
      data.taakIds = [t!.id]
      wordt.push(`Taak ${datum}`)
    } else {
      const ids: string[] = Array.isArray(data.accountIds) ? data.accountIds.slice(0, 4) : []
      const accounts = ids.length ? await rijen(tx, sql`select id, name from accounts where id = any(string_to_array(${lijst(ids)}, ',')) and owner_id = ${g.id}`) : []
      if (!accounts.length) fout(422, 'Geen accounts voor deze regiodag')
      const datum = typeof data.datum === 'string' && data.datum >= week && data.datum <= plusDagen(week, 4) && isWerkdag(data.datum, w) ? data.datum : plusDagen(week, 3)
      const taakIds: string[] = []
      for (const [i, a] of accounts.entries()) {
        const [t] = await rijen(tx, sql`insert into tasks (organisation_id, owner_id, account_id, action_type, title, priority, due_date, executor, data) values (${org}, ${g.id}, ${a.id}, 'bezoek', ${`Bezoek ${a.name}`}, 'middel', ${nlTijdstip(datum, 9 + i * 2).toISOString()}, 'mens',
          ${JSON.stringify({ waarom: `Regiodag ${data.regioNaam ?? ''} uit je weekreview.`.replace('  ', ' '), herkomst: { bron: 'weekreview', actiesoort: 'bezoek', uitvoerder: g.id }, regiodag: datum, regioId: data.regioId ?? null, voornemen: true })}::jsonb) returning id`)
        taakIds.push(t!.id)
      }
      data.taakIds = taakIds
      data.datum = datum
      wordt.push(`Regiodag ${datum} met ${accounts.length} bezoeken`)
    }
    const [r] = await rijen(tx, sql`insert into voornemens (organisation_id, gebruiker_id, week, tekst, soort, gedeeld, data) values (${org}, ${g.id}, ${week}, ${tekst}, ${v.soort}, ${delen}, ${JSON.stringify(data)}::jsonb) returning id`)
    if (manager) {
      const [n] = await rijen(tx, sql`insert into coaching_notities (organisation_id, gebruiker_id, manager_id, soort, tekst, termijn, data) values (${org}, ${g.id}, ${manager.id}, 'afspraak', ${`Voornemen: ${tekst}`}, ${plusDagen(week, 4)}, ${JSON.stringify({ bron: 'weekreview', voornemenId: r!.id })}::jsonb) returning id`)
      await tx.execute(sql`update voornemens set coaching_notitie_id = ${n!.id} where id = ${r!.id}`)
    }
    uit.push({ id: r!.id, tekst, soort: v.soort, wordt })
  }
  if (manager) {
    await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${manager.id}, 'systeem', ${`${voornaam(g.naam)} deelt ${uit.length === 1 ? 'een voornemen' : `${uit.length} voornemens`} voor volgende week`}, ${uit.map((x) => x.tekst).join(' · ').slice(0, 200)}, ${`/coaching/${g.id}`}, ${nu.toISOString()}, '{}'::jsonb)`)
  }
  await zetMoment(tx, org, g.id, 'weekreview', maandag, { afgerondOp: nu.toISOString(), gedeeld: !!manager })
  await tx.execute(sql`update users set data = data || ${JSON.stringify({ weekreviewDelen: !!delen })}::jsonb where id = ${g.id}`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'weekreview.voornemens', resourceType: 'voornemens', resourceId: week, changes: { voornemens: uit.map((x) => ({ soort: x.soort, tekst: x.tekst })), gedeeld: !!manager } })
  return { week, voornemens: uit, gedeeldMet: manager?.naam?.replace(/^Testgebruiker /, '') ?? null }
}

/** Kies opnieuw: de voornemens voor de week na de review vervallen, met wat ze werden (open taken en geplande belblokken). */
export async function wisVoornemens(tx: Tx, org: string, gebruikerId: string, maandag: string) {
  const week = plusDagen(maandag, 7)
  const v = await rijen(tx, sql`select id, data, coaching_notitie_id from voornemens where gebruiker_id = ${gebruikerId} and week = ${week}`)
  const taakIds = v.flatMap((x) => x.data?.taakIds ?? [])
  const sessieIds = v.flatMap((x) => x.data?.sessieIds ?? [])
  if (taakIds.length) await tx.execute(sql`update tasks set status = 'geannuleerd', updated_at = now() where id = any(string_to_array(${lijst(taakIds)}, ',')) and owner_id = ${gebruikerId} and status in ('open', 'bezig')`)
  if (sessieIds.length) {
    await tx.execute(sql`update tasks set belblok_id = null where belblok_id = any(string_to_array(${lijst(sessieIds)}, ',')) and status in ('open', 'bezig')`)
    await tx.execute(sql`update belblok_sessies set status = 'geannuleerd' where id = any(string_to_array(${lijst(sessieIds)}, ',')) and gebruiker_id = ${gebruikerId} and status = 'gepland'`)
  }
  const notities = v.map((x) => x.coaching_notitie_id).filter(Boolean) as string[]
  await tx.execute(sql`delete from voornemens where gebruiker_id = ${gebruikerId} and week = ${week}`)
  if (notities.length) await tx.execute(sql`delete from coaching_notities where id = any(string_to_array(${lijst(notities)}, ',')) and gebruiker_id = ${gebruikerId}`)
  const [m] = await rijen(tx, sql`select data from dagritme_momenten where gebruiker_id = ${gebruikerId} and soort = 'weekreview' and datum = ${maandag}`)
  if (m) await tx.execute(sql`update dagritme_momenten set data = data - 'afgerondOp' - 'gedeeld', bijgewerkt_op = now() where gebruiker_id = ${gebruikerId} and soort = 'weekreview' and datum = ${maandag}`)
  if (v.length) await schrijfAudit(tx, { organisationId: org, actorId: gebruikerId, action: 'weekreview.voornemens.opnieuw', resourceType: 'voornemens', resourceId: week, changes: { vervallen: v.length } })
  return { vervallen: v.length }
}

/** Verzet de weekreview naar maandagochtend. */
export async function verzetReview(tx: Tx, org: string, gebruikerId: string, maandag: string) {
  await zetMoment(tx, org, gebruikerId, 'weekreview', maandag, { verzet: true })
  return { verzet: true }
}

// ── Weekstart ──────────────────────────────────────────────────────────────

export async function laadWeekstart(tx: Tx, gebruikerId: string, nu = new Date()) {
  const g = await gebruikerVan(tx, gebruikerId)
  const w = await werkdagen(tx)
  const week = weekVan(nu)
  const van = nlTijdstip(week.van, 0).toISOString()
  const tot = nlTijdstip(plusDagen(week.tot, 1), 0).toISOString()
  const vandaagStart = nlTijdstip(nlMoment(nu).datum, 0).toISOString()
  const afs = await rijen(tx, sql`select ap.id, ap.start_at, ap.end_at, ap.vorm, ap.account_id, m.naam as soort, a.name, a.fase_id from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id
    where ap.owner_id = ${g.id} and ap.status in ('gepland', 'afgerond') and ap.start_at >= ${van} and ap.start_at < ${tot} order by ap.start_at`)
  const bb = await rijen(tx, sql`select s.id, s.start_op, s.eind_op, s.status, (select count(*)::int from tasks t where t.belblok_id = s.id) as n from belblok_sessies s
    where s.gebruiker_id = ${g.id} and s.start_op >= ${van} and s.start_op < ${tot} and s.status <> 'geannuleerd' order by s.start_op`)
  const [o] = await rijen(tx, sql`select count(*)::int as totaal, count(*) filter (where due_date < ${vandaagStart})::int as achter, count(*) filter (where due_date >= ${van} and due_date < ${tot})::int as week, count(*) filter (where verschoven >= ${BLIJVER_VANAF})::int as blijvers
    from tasks where owner_id = ${g.id} and status in ('open', 'bezig')`)
  const [p] = await rijen(tx, sql`select count(*)::int as n from activiteiten where door = ${g.id} and op >= ${van} and op < ${vandaagStart} and soort = any(string_to_array(${lijst([...CONTACT_SOORTEN])}, ',')) and coalesce(kanaal, '') <> 'intern'`)
  const aan = await rijen(tx, sql`select s.id, s.title, s.account_id, s.relevance_score, s.created_at, a.name from signals s join accounts a on a.id = s.account_id
    where a.owner_id = ${g.id} and s.status in ('nieuw', 'gelezen') and coalesce(s.relevance_score, 0) >= 60 order by s.relevance_score desc nulls last, s.created_at desc limit 10`)
  const ws = bouwWeekstart({
    gebruiker: { id: g.id, naam: g.naam, werkplek: g.werkplek },
    afspraken: afs.map((a) => ({ id: a.id, start: iso(a.start_at)!, eind: iso(a.end_at)!, titel: a.soort, accountId: a.account_id, accountNaam: a.name ?? null, vorm: a.vorm, eerste: a.fase_id === 'afspraak-gepland' })),
    belblokken: bb.map((b) => ({ id: b.id, start: iso(b.start_op)!, eind: iso(b.eind_op)!, status: b.status, gesprekken: b.n })),
    voornemens: (await voornemensMetStand(tx, g.id, week.van, nu)).map((v) => ({ id: v.id, tekst: v.tekst, soort: v.soort, gedeeld: v.gedeeld, stand: v.stand })),
    open: { totaal: o?.totaal ?? 0, achterstallig: o?.achter ?? 0, dezeWeek: o?.week ?? 0, blijvers: o?.blijvers ?? 0 },
    pogingen: p?.n ?? 0,
    aanleidingen: aan.map((s) => ({ id: s.id, titel: s.title, accountId: s.account_id, accountNaam: s.name ?? null, relevantie: s.relevance_score ?? 0, op: iso(s.created_at)! })),
    werkdagen: w,
  }, nu)
  const vorige = await moment(tx, g.id, 'weekreview', plusDagen(week.van, -7))
  return { ...ws, reviewGedaan: !!vorige?.afgerondOp }
}

// ── Dagstart ───────────────────────────────────────────────────────────────

/** Belpogingen van de hele organisatie in de laatste 90 dagen, met de branche van het account. */
async function belpogingen(tx: Tx, nu: Date): Promise<BereikPoging[]> {
  const r = await rijen(tx, sql`select a.op, a.uitkomst, a.soort, acc.vv_branche_id from activiteiten a left join accounts acc on acc.id = a.account_id
    where a.soort = 'gebeld' and a.op >= ${new Date(nu.getTime() - 90 * 864e5).toISOString()} and coalesce(a.kanaal, '') <> 'intern'`)
  return r.map((x) => ({ op: iso(x.op)!, brancheId: x.vv_branche_id ?? null, gesproken: isGesproken({ soort: x.soort, uitkomst: x.uitkomst }) }))
}

export async function laadDagstart(tx: Tx, gebruikerId: string, nu = new Date(), opties: { dag?: string | null; modus?: string | null; branche?: string | null; org?: string; bewaar?: boolean } = {}) {
  const g = await gebruikerVan(tx, gebruikerId)
  const w = await werkdagen(tx)
  const vandaag = nlMoment(nu).datum
  const dag = opties.dag ?? vandaag
  const van = nlTijdstip(dag, 0).toISOString()
  const tot = nlTijdstip(plusDagen(dag, 1), 0).toISOString()
  const afs = await rijen(tx, sql`select ap.id, ap.start_at, ap.end_at, ap.vorm, ap.account_id, m.naam as soort, a.name, a.fase_id, a.lat, a.lng, c.first_name, c.last_name from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id
    left join accounts a on a.id = ap.account_id left join contacts c on c.id = ap.contact_id
    where ap.owner_id = ${g.id} and ap.status in ('gepland', 'afgerond') and ap.start_at >= ${van} and ap.start_at < ${tot} order by ap.start_at`)
  const modus = planModus(g.werkplek, opties.modus, afs.filter((a) => a.vorm === 'bezoek').length)
  // Reistijd naar elk bezoek: vanaf het vorige bezoek, anders vanaf de thuisbasis (schatting).
  let vorige: Punt | null = g.data?.thuisbasis?.lat != null ? { lat: g.data.thuisbasis.lat, lng: g.data.thuisbasis.lng } : null
  const vast: VastPunt[] = afs.map((a) => {
    const punt: Punt | null = a.lat != null ? { lat: a.lat, lng: a.lng } : null
    let reis: number | null = null
    if (a.vorm === 'bezoek' && punt) { if (vorige) reis = schatReistijd(vorige, punt).minuten; vorige = punt }
    const wie = [a.first_name, a.last_name].filter(Boolean).join(' ')
    return { id: a.id, soort: a.vorm === 'bezoek' ? 'bezoek' : 'afspraak', start: iso(a.start_at)!, eind: iso(a.end_at)!, titel: a.name ? `${a.soort} ${a.name}` : a.soort, sub: [a.fase_id === 'afspraak-gepland' ? 'Eerste afspraak' : null, wie || null, a.vorm === 'online' ? 'Online' : a.vorm === 'telefoon' ? 'Telefonisch' : null].filter(Boolean).join(' · ') || null, accountId: a.account_id, reisMinuten: reis, eerste: a.fase_id === 'afspraak-gepland' }
  })
  const bb = await rijen(tx, sql`select s.id, s.start_op, s.eind_op, (select count(*)::int from tasks t where t.belblok_id = s.id) as n from belblok_sessies s where s.gebruiker_id = ${g.id} and s.start_op >= ${van} and s.start_op < ${tot} and s.status in ('gepland', 'bezig', 'klaar') order by s.start_op`)
  const bel = await rijen(tx, sql`select t.id, a.vv_branche_id from tasks t left join accounts a on a.id = t.account_id where t.owner_id = ${g.id} and t.status in ('open', 'bezig') and t.action_type = 'bellen' and t.belblok_id is null and (t.due_date is null or t.due_date < ${tot})`)
  const [ac] = await rijen(tx, sql`select count(*)::int as n from tasks where owner_id = ${g.id} and status in ('open', 'bezig') and action_type not in ('bellen', 'bezoek') and (due_date is null or due_date < ${tot}) and coalesce(data->>'soort', '') <> 'afspraak'`)
  // Doelgroep: de branche waar de meeste belacties van vandaag in vallen, of de gekozen branche.
  const branches = await rijen(tx, sql`select extern_id as id, naam from vv_branches where actief order by volgorde, naam`)
  const tel = new Map<string, number>()
  for (const t of bel) if (t.vv_branche_id) tel.set(t.vv_branche_id, (tel.get(t.vv_branche_id) ?? 0) + 1)
  const meest = [...tel].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  const doelBranche = opties.branche && branches.some((b) => b.id === opties.branche) ? opties.branche : opties.branche === 'alle' ? null : meest
  const bereik = bereikVoorDoelgroep(await belpogingen(tx, nu), doelBranche ? [doelBranche] : [])
  const doelgroep = bereik.bron === 'doelgroep' ? branches.find((b) => b.id === doelBranche)?.naam ?? null : null
  // Kansen langs de route alleen in de buitendienststand en als er bezoeken zijn.
  let kansen: { id: string; naam: string; start: string | null; sub: string | null; accountId: string }[] = []
  if (modus === 'buiten' && vast.some((v) => v.soort === 'bezoek')) {
    try {
      const b = await bezoekDag(tx, { id: g.id, naam: g.naam, werkplek: g.werkplek, data: g.data, niveau: g.niveau }, dag, { alleenMijn: false, alleenProspects: false, maxOmrij: 20, aantal: 5, ongepland: false }, nu, { bellijst: false, teplannen: false, kansenAlle: false })
      kansen = b.kansen.map((k: any) => ({ id: k.id, naam: k.naam, start: k.momentStart ?? null, sub: `${k.omrij} min omrijden · score ${k.score}`, accountId: k.id }))
    } catch { kansen = [] }
  }
  const werk = { start: 8, eind: 18, ...((await rijen(tx, sql`select value from org_settings where key = 'dagritme'`))[0]?.value ?? {}) } as Record<string, any>
  const plan = planDag({ dag, nu, modus, werkdag: { start: Number(werk.werkdagStart ?? 8), eind: Number(werk.werkdagEind ?? 18) }, vast, kansen, belblokken: bb.map((b) => ({ id: b.id, start: iso(b.start_op)!, eind: iso(b.eind_op)!, gesprekken: b.n })), belTaken: bel.length, acties: ac?.n ?? 0, bereik })
  // De eerste indeling van de dag blijft bewaard; daartegen zie je wat er schoof.
  let snap = await moment(tx, g.id, 'dagstart', dag)
  const kaal = (l: PlanBlok[]) => l.filter((b) => b.soort !== 'reis').map((b) => ({ id: b.id, soort: b.soort, start: b.start, titel: b.titel, voorstel: b.voorstel }))
  if (!snap?.blokken && opties.org && opties.bewaar !== false && dag === vandaag) {
    snap = { blokken: kaal(plan.blokken), op: nu.toISOString() }
    await zetMoment(tx, opties.org, g.id, 'dagstart', dag, snap)
  }
  const schoof = watSchoof(snap?.blokken ?? null, plan.blokken)
  const label = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dag}T12:00:00Z`))
  return {
    dag, vandaag: dag === vandaag, werkdag: isWerkdag(dag, w), modus, werkplek: g.werkplek,
    kicker: `Planning · Dagstart · ${label}`,
    titel: schoof.length ? 'Je dag is opnieuw ingedeeld.' : 'Je dag staat klaar.',
    lede: schoof.length ? `Herpland om ${hhmm(nu.toISOString())} · ${schoof.length === 1 ? '1 wijziging' : `${schoof.length} wijzigingen`}` : `${snap?.op ? `Ingedeeld om ${hhmm(snap.op)}` : 'Voorstel'} · ${plan.samenvatting}`,
    plan, schoof,
    bereik: { uren: bereik.uren, pogingen: bereik.pogingen, genoeg: bereik.genoeg, bron: bereik.bron, doelgroep, brancheId: doelBranche },
    branches: branches.map((b) => ({ id: b.id as string, naam: b.naam as string })),
    belTaken: bel.length,
  }
}

/** Neem de nieuwe indeling over: "wat schoof" begint opnieuw. */
export async function bewaarDagindeling(tx: Tx, org: string, gebruikerId: string, nu = new Date()) {
  const d = await laadDagstart(tx, gebruikerId, nu, { org, bewaar: false })
  const blokken = d.plan.blokken.filter((b) => b.soort !== 'reis').map((b) => ({ id: b.id, soort: b.soort, start: b.start, titel: b.titel, voorstel: b.voorstel }))
  await tx.execute(sql`insert into dagritme_momenten (organisation_id, gebruiker_id, soort, datum, data) values (${org}, ${gebruikerId}, 'dagstart', ${d.dag}, ${JSON.stringify({ blokken, op: nu.toISOString() })}::jsonb)
    on conflict (gebruiker_id, soort, datum) do update set data = excluded.data, bijgewerkt_op = now()`)
  return { ok: true }
}

/** Zet de voorgestelde belblokken van de dag in je agenda en hang de belacties tot die dag eraan. */
export async function zetBelblokken(tx: Tx, org: string, gebruikerId: string, starts: string[], nu = new Date(), modus?: string | null, dag?: string | null) {
  if (dag && dag < nlMoment(nu).datum) fout(422, 'Een dag in het verleden plan je niet meer in')
  const d = await laadDagstart(tx, gebruikerId, nu, { org, modus, dag })
  const kies = d.plan.voorstellen.filter((v) => !starts.length || starts.includes(v.start))
  if (!kies.length) fout(422, 'Er is geen belblok voorgesteld om in te plannen')
  const tot = nlTijdstip(plusDagen(d.dag, 1), 0).toISOString()
  const taken = await rijen(tx, sql`select t.id, t.account_id, t.contact_id, a.name from tasks t left join accounts a on a.id = t.account_id where t.owner_id = ${gebruikerId} and t.status in ('open', 'bezig') and t.action_type = 'bellen' and t.belblok_id is null and (t.due_date is null or t.due_date < ${tot})
    order by case t.priority when 'urgent' then 0 when 'hoog' then 1 when 'middel' then 2 else 3 end, t.due_date nulls last`)
  const per = Math.ceil(taken.length / kies.length)
  const ids: string[] = []
  for (const [i, v] of kies.entries()) {
    const s = await sessieOp(tx, org, gebruikerId, v.start, v.eind, { handmatig: true, soort: 'dagstart' } as any)
    ids.push(s.id)
    const deel = taken.slice(i * per, (i + 1) * per).map((t) => ({ taskId: t.id, accountId: t.account_id, contactId: t.contact_id, accountNaam: t.name, reden: 'Dagstart' }))
    if (deel.length) await hangAanBlok(tx, org, gebruikerId, s.id, v.start, deel as any)
  }
  await schrijfAudit(tx, { organisationId: org, actorId: gebruikerId, action: 'dagstart.belblokken', resourceType: 'belblok_sessies', resourceId: ids.join(','), changes: { starts: kies.map((k) => k.start) } })
  if (d.vandaag) await bewaarDagindeling(tx, org, gebruikerId, nu)
  return { sessieIds: ids, aantal: ids.length }
}

// ── Mail ───────────────────────────────────────────────────────────────────

/** De inhoud van één mail, zoals de verzender en "Stuur een voorbeeld" hem maken. */
export async function maakDagritmeMail(tx: Tx, org: string, gebruikerId: string, soort: DagritmeMail, nu: Date, basis: string) {
  const link = `${basis.replace(/\/$/, '')}${DAGRITME_MAIL_ROUTE[soort]}`
  if (soort === 'weekreview') return weekreviewMail(await laadWeekreview(tx, gebruikerId, nu), link)
  if (soort === 'weekstart') return weekstartMail(await laadWeekstart(tx, gebruikerId, nu), link)
  const d = await laadDagstart(tx, gebruikerId, nu, { org })
  return dagstartMail({ titel: d.titel, plan: d.plan, schoof: d.schoof, doelgroep: d.bereik.doelgroep }, link)
}

/**
 * De verzender (elk kwartier): per gebruiker met een schakelaar aan, op de juiste dag, op of na het
 * tijdstip en buiten de stille uren. Tijdens de rijmodus of een belblok wacht hij een ronde. Eén mail
 * per soort per dag (melding_log). `mag` controleert of de functie voor de gebruiker aanstaat.
 */
export async function verstuurDagritmeMails(tx: Tx, org: string, nu: Date, basis: string, mag: (g: { id: string; rol: string; niveau: string; werkplek: string; teamId: string | null }, soort: DagritmeMail) => boolean) {
  const tel = { verstuurd: 0, wacht: 0, overgeslagen: 0, fout: 0 }
  const w = await werkdagen(tx)
  const gebruikers = await rijen(tx, sql`select u.id, u.email, u.role, u.niveau, u.werkplek, u.team_id, u.data as udata, p.data->'dagritmeMail' as mail from users u join persoonlijke_instellingen p on p.id = u.id
    where u.status = 'actief' and u.role <> 'founder' and p.data ? 'dagritmeMail'`)
  for (const u of gebruikers) {
    const vk = mailVoorkeuren(u.mail)
    for (const soort of DAGRITME_MAILS) {
      if (!vk[soort].aan) continue
      const inst = await instellingVan(tx, u.id)
      const moment = mailAanDeBeurt(soort, vk[soort], nu, inst, w)
      if (!moment) continue
      const datum = nlMoment(nu).datum
      const sleutel = mailSleutel(soort, datum)
      const [al] = await rijen(tx, sql`select 1 from melding_log where gebruiker_id = ${u.id} and sleutel = ${sleutel}`)
      if (al) continue
      if (!u.email || !mag({ id: u.id, rol: u.role, niveau: u.niveau, werkplek: u.werkplek, teamId: u.team_id }, soort)) {
        await tx.execute(sql`insert into melding_log (organisation_id, gebruiker_id, soort, sleutel, status, reden, op) values (${org}, ${u.id}, ${`mail-${soort}`}, ${sleutel}, 'overgeslagen', ${u.email ? 'Functie staat uit' : 'Geen e-mailadres'}, ${nu.toISOString()}) on conflict (gebruiker_id, sleutel) do nothing`)
        tel.overgeslagen++
        continue
      }
      if (houdtVast(u.udata, nu)) { tel.wacht++; continue }
      try {
        const mail = await maakDagritmeMail(tx, org, u.id, soort, nu, basis)
        await stuurMeldingMail(u.email, mail.onderwerp, mail.tekst)
        await tx.execute(sql`insert into melding_log (organisation_id, gebruiker_id, soort, sleutel, status, reden, op) values (${org}, ${u.id}, ${`mail-${soort}`}, ${sleutel}, 'verstuurd', null, ${nu.toISOString()}) on conflict (gebruiker_id, sleutel) do nothing`)
        tel.verstuurd++
      } catch (e: any) {
        console.error(`dagritme-mail ${soort} ${u.id}: ${e?.message}`)
        tel.fout++
      }
    }
  }
  return tel
}

