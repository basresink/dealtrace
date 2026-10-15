// Agenda op de server (P13, F09, 12, gat 37). De koppeling met Microsoft 365 en Google per gebruiker
// (OAuth, tokens versleuteld met een eigen geheim) met één interface voor echt en mock; "agenda
// bezet" telt mee in vrije momenten, belblokadviezen en de vuller. Plannen, afronden en de status
// van een afspraak lopen hier; de fase verandert alleen via het meldpunt (meldGebeurtenis).
import { sql } from 'drizzle-orm'
import { analyseerVerslag } from './agents/notulist'
import { conflicten, isEersteAfspraak, meetingUitkomst, MEETINGSOORTEN_START, type Meetingsoort, type Vorm } from '../../shared/agenda'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { schrijfAudit } from './audit'
import { gebruikDb } from './db'
import { ontsleutel, versleutel } from './geheimen'
import { meldGebeurtenis, pauzeer, ReisFout, zetNee } from './reis'
import { rondAf } from './taken'
import { kansenRond } from './bezoeken'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (status: number, bericht: string): never => { throw Object.assign(new Error(bericht), { statusCode: status, statusMessage: bericht }) }

// ── Providers (Microsoft 365, Google) ────────────────────────────────────────

export type Provider = 'microsoft' | 'google'
export interface CalendarProvider {
  leesBezet(k: Rij, van: Date, tot: Date): Promise<{ start: string; eind: string; titel?: string }[]>
  schrijfAfspraak(k: Rij, a: { id: string; start: string; eind: string; titel: string; meetinglink?: boolean }): Promise<{ externId: string; meetinglink: string | null }>
  verwijderAfspraak(k: Rij, externId: string): Promise<void>
}
/** De mock (13.5): elke werkdag 12:00 tot 12:30 lunch en dinsdag 14:00 tot 15:00 extern overleg; geschreven afspraken in data.events. */
const mockAgenda = (provider: Provider): CalendarProvider => ({
  async leesBezet(k, van, tot) {
    const uit: { start: string; eind: string; titel?: string }[] = []
    for (let d = nlMoment(van).datum; d <= nlMoment(tot).datum; d = plusDagen(d, 1)) {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
      if (wd === 0 || wd === 6) continue
      uit.push({ start: nlTijdstip(d, 12).toISOString(), eind: nlTijdstip(d, 12, 30).toISOString(), titel: 'Lunch' })
      if (wd === 2) uit.push({ start: nlTijdstip(d, 14).toISOString(), eind: nlTijdstip(d, 15).toISOString(), titel: 'Extern overleg' })
    }
    return [...uit, ...((k.data?.events ?? []) as any[])].filter((b) => Date.parse(b.eind) > van.getTime() && Date.parse(b.start) < tot.getTime())
  },
  async schrijfAfspraak(_k, a) {
    return { externId: `${provider}-${a.id}`, meetinglink: a.meetinglink ? (provider === 'microsoft' ? `https://teams.voorbeeld.test/meet/${a.id.slice(0, 8)}` : `https://meet.voorbeeld.test/${a.id.slice(0, 8)}`) : null }
  },
  async verwijderAfspraak() {},
})
export function provider(p: Provider): CalendarProvider { return mockAgenda(p) }

/** De beheerder zet de agendakoppeling aan voor de organisatie (instelling agendaKoppeling). */
export async function koppelingAan(tx: Tx): Promise<boolean> {
  const [r] = await rijen(tx, sql`select value from org_settings where key = 'agendaKoppeling'`)
  return !!(r?.value as any)?.aan
}

export async function koppelingenVan(tx: Tx, gebruikerId: string) {
  return rijen(tx, sql`select * from agenda_koppelingen where gebruiker_id = ${gebruikerId} and status = 'actief'`)
}

/** Agenda bezet uit de gekoppelde agenda's van één gebruiker (gat 37). */
export async function bezetExtern(tx: Tx, gebruikerId: string, van: Date, tot: Date) {
  const uit: { start: string; eind: string; titel?: string }[] = []
  for (const k of await koppelingenVan(tx, gebruikerId)) {
    try { uit.push(...await provider(k.provider).leesBezet(k, van, tot)) } catch { /* fout staat in de koppeling */ }
  }
  return uit
}

/** Alles wat een moment bezet maakt: gekoppelde agenda, eigen geplande afspraken en belblokken. */
export async function bezetVoor(tx: Tx, gebruikerId: string, van: Date, tot: Date) {
  const afs = await rijen(tx, sql`select start_at, end_at from appointments where owner_id = ${gebruikerId} and status = 'gepland' and end_at > ${van.toISOString()} and start_at < ${tot.toISOString()}`)
  const blokken = await rijen(tx, sql`select start_op, eind_op from belblok_sessies where gebruiker_id = ${gebruikerId} and status in ('gepland', 'bezig') and eind_op > ${van.toISOString()} and start_op < ${tot.toISOString()}`)
  return [
    ...await bezetExtern(tx, gebruikerId, van, tot),
    ...afs.map((a) => ({ start: new Date(a.start_at).toISOString(), eind: new Date(a.end_at).toISOString(), titel: 'Afspraak' })),
    ...blokken.map((b) => ({ start: new Date(b.start_op).toISOString(), eind: new Date(b.eind_op).toISOString(), titel: 'Belblok' })),
  ]
}

export async function koppel(tx: Tx, org: string, gebruikerId: string, p: Provider, code: string) {
  const tokens = versleutel({ access: `mock-${p}-${code}`, refresh: `mock-refresh-${code}` }, 'agenda')
  await tx.execute(sql`insert into agenda_koppelingen (organisation_id, gebruiker_id, provider, tokens, status, laatste_sync) values (${org}, ${gebruikerId}, ${p}, ${tokens}, 'actief', now())
    on conflict (gebruiker_id, provider) do update set tokens = excluded.tokens, status = 'actief', laatste_sync = now()`)
  await tx.insert((await import('./db')).schema.koppelingRuns).values({ organisationId: org, soort: p === 'microsoft' ? 'agenda-microsoft' : 'agenda-google', handeling: 'koppelen', eind: new Date().toISOString(), gelezen: 0, fouten: [] })
}
export async function ontkoppel(tx: Tx, gebruikerId: string, p: Provider) {
  await tx.execute(sql`update agenda_koppelingen set status = 'uit', tokens = null where gebruiker_id = ${gebruikerId} and provider = ${p}`)
}
/** Alleen voor tests: de tokens zijn met het agendageheim versleuteld, niet met dat van de koppelingen. */
export const leesTokens = (k: Rij) => ontsleutel(k.tokens, 'agenda')

/** De oude interface uit P10 (belblokken): gekoppeld, bezet en een blok als bezet zetten. */
export function agenda(tx?: Tx) {
  return {
    async gekoppeld(gebruikerId: string) { return tx ? (await koppelingenVan(tx, gebruikerId)).length > 0 : false },
    async bezet(gebruikerId: string, van: Date, tot: Date) { return tx ? bezetExtern(tx, gebruikerId, van, tot) : [] },
    async zetBezet(gebruikerId: string, blok: { start: string; eind: string; titel: string }) {
      if (!tx) return { ok: false, reden: 'Werkt zodra je agenda gekoppeld is' }
      const ks = await koppelingenVan(tx, gebruikerId)
      if (!ks.length) return { ok: false, reden: 'Werkt zodra je agenda gekoppeld is' }
      for (const k of ks) {
        await provider(k.provider).schrijfAfspraak(k, { id: crypto.randomUUID(), ...blok })
        await tx.execute(sql`update agenda_koppelingen set data = jsonb_set(data, '{events}', coalesce(data->'events', '[]'::jsonb) || ${JSON.stringify([{ ...blok }])}::jsonb), laatste_sync = now() where id = ${k.id}`)
      }
      return { ok: true }
    },
  }
}

// ── Meetingsoorten ───────────────────────────────────────────────────────────

/** De startset in een organisatie (idempotent op slug); seed en "Startset aanvullen" gebruiken hetzelfde. */
export async function zaaiMeetingsoorten(tx: Tx, org: string) {
  for (const m of MEETINGSOORTEN_START) {
    await tx.execute(sql`insert into meetingsoorten (organisation_id, slug, naam, type, duur_min, vorm, data) values (${org}, ${m.slug}, ${m.naam}, ${m.type}, ${m.duurMin}, ${m.vorm}, ${JSON.stringify(m.data)}::jsonb)
      on conflict (organisation_id, slug) do nothing`)
  }
}
export async function meetingsoorten(tx: Tx): Promise<(Meetingsoort & { id: string; actief: boolean })[]> {
  return (await rijen(tx, sql`select * from meetingsoorten order by type, duur_min desc, naam`)).map((m) => ({ id: m.id, slug: m.slug, naam: m.naam, type: m.type, duurMin: m.duur_min, vorm: m.vorm, data: m.data, actief: m.actief }))
}

// ── Plannen ──────────────────────────────────────────────────────────────────

export interface PlanInvoer { id?: string; accountId?: string | null; contactId?: string | null; meetingsoortId: string; vorm?: Vorm; start: string; duurMin?: number; voorWie?: string | null; locatie?: string | null; herinneringMin?: number | null; aanleiding?: string | null; beschrijving?: string | null; taskId?: string | null; collegaUitnodigen?: string[] }
export interface Planner { id: string; naam: string; rol: string; mag: { voorCollega: boolean } }

export async function planAfspraak(tx: Tx, org: string, door: Planner, p: PlanInvoer, nu = new Date()) {
  const [soort] = await rijen(tx, sql`select * from meetingsoorten where id = ${p.meetingsoortId} and actief`)
  if (!soort) fout(422, 'Kies een meetingsoort')
  // Intern overleg kan zonder klant; een klantafspraak niet.
  const [a] = p.accountId ? await rijen(tx, sql`select id, name, owner_id, city, data from accounts where id = ${p.accountId}`) : []
  if (!a && soort!.type === 'klant') fout(422, 'Kies een klant')
  const owner = p.voorWie && p.voorWie !== door.id ? p.voorWie : door.id
  if (owner !== door.id) {
    if (!door.mag.voorCollega) fout(403, 'Plannen voor een collega staat voor jou nog niet aan')
    const [c] = await rijen(tx, sql`select id from users where id = ${owner} and status = 'actief'`)
    if (!c) fout(422, 'Collega niet gevonden')
  }
  const start = new Date(p.start)
  if (Number.isNaN(start.getTime())) fout(422, 'Kies een datum en starttijd')
  const duur = Math.max(5, Math.min(480, Number(p.duurMin) || soort!.duur_min))
  const eind = new Date(start.getTime() + duur * 60_000)
  const vorm: Vorm = (['bezoek', 'online', 'telefoon'] as const).includes(p.vorm as Vorm) ? p.vorm as Vorm : soort!.vorm
  const locatie = p.locatie ?? (vorm === 'bezoek' && a ? [a.data?.adres, a.city].filter(Boolean).join(', ') || null : null)
  const id = p.id && /^[0-9a-f-]{36}$/i.test(p.id) ? p.id : crypto.randomUUID()
  if (p.id) {
    const [al] = await rijen(tx, sql`select id from appointments where id = ${id}`)
    if (al) return { id, eerste: false, tekst: 'Deze afspraak stond al in de agenda.' }
  }
  const data: Record<string, unknown> = { agenda: soort!.data.agenda ?? [], herinnering: p.herinneringMin ?? soort!.data.herinneringMin ?? 15, locatie, aanleiding: p.aanleiding ?? null, beschrijving: p.beschrijving ?? null, uitgenodigd: p.collegaUitnodigen ?? [], briefing: owner !== door.id ? `Gepland door ${door.naam}${p.aanleiding ? `: ${p.aanleiding}` : ''}` : null }
  // Schrijven naar de gekoppelde agenda van de eigenaar, met meetinglink bij online.
  for (const k of await koppelingenVan(tx, owner)) {
    const r = await provider(k.provider).schrijfAfspraak(k, { id, start: start.toISOString(), eind: eind.toISOString(), titel: a ? `${soort!.naam} · ${a.name}` : soort!.naam, meetinglink: vorm === 'online' })
    data.externalIds = { ...(data.externalIds as object ?? {}), [k.provider]: r.externId }
    if (r.meetinglink && !data.meetinglink) data.meetinglink = r.meetinglink
  }
  await tx.execute(sql`insert into appointments (id, organisation_id, owner_id, gepland_door, account_id, contact_id, meetingsoort_id, vorm, status, start_at, end_at, task_id, data)
    values (${id}, ${org}, ${owner}, ${door.id}, ${a?.id ?? null}, ${p.contactId ?? null}, ${soort!.id}, ${vorm}, 'gepland', ${start.toISOString()}, ${eind.toISOString()}, ${p.taskId ?? null}, ${JSON.stringify(data)}::jsonb)`)
  // Gat 32: de taak waaruit je plande, is gekoppeld en sluit bij afronden.
  if (p.taskId) await tx.execute(sql`update tasks set data = data || ${JSON.stringify({ afspraakId: id })}::jsonb, updated_at = now() where id = ${p.taskId}`)
  // Gat 3: alleen de eerste niet-geannuleerde klantafspraak meldt eerste-afspraak-gepland.
  let eerste = false
  // Alleen soorten die als eerste afspraak gelden (kennismaking, inventarisatie, demo) tellen mee.
  if (a && soort!.type === 'klant' && soort!.data.eersteAfspraak) {
    const alle = await rijen(tx, sql`select ap.id, ap.account_id, ap.status, ap.start_at, case when m.type = 'klant' and coalesce((m.data->>'eersteAfspraak')::boolean, false) then 'klant' else 'intern' end as type from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.account_id = ${a!.id}`)
    eerste = isEersteAfspraak(alle.map((x) => ({ id: x.id, accountId: x.account_id, status: x.status, start: new Date(x.start_at).toISOString(), meetingsoortType: x.type })), a!.id, id)
    if (eerste) {
      try { await meldGebeurtenis(tx, { accountId: a!.id, gebeurtenis: 'eerste-afspraak-gepland', door: door.id, nu, zonderMotor: true }) } catch (e) { if (!(e instanceof ReisFout)) throw e }
    }
  }
  if (owner !== door.id) {
    await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${owner}, 'systeem', 'Afspraak gemaakt door een collega voor jou',
      ${`${door.naam.replace(/^Testgebruiker /, '')} plande ${soort!.naam.toLowerCase()}${a ? ` met ${a.name}` : ''} op ${new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(start)}.`}, ${`/agenda?afspraak=${id}`}, now(), '{}'::jsonb)`)
  }
  await schrijfAudit(tx, { organisationId: org, actorId: door.id, action: 'afspraak.plannen', resourceType: 'appointments', resourceId: id, changes: { owner, soort: soort!.slug, eerste } })
  return { id, eerste, tekst: `Afspraak gepland${a ? ` met ${a.name}` : ''}, ${new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(start)}.` }
}

// ── Afronden en status ───────────────────────────────────────────────────────

export interface AfrondInvoer { uitkomst: string; verslag?: string | null; agendapunten?: { punt: string; besproken: boolean }[]; laterOp?: string | null; reden?: string | null; toelichting?: string | null; verlorenAan?: string | null; vervolgstap?: string | null; sleutel?: string | null }

/** "Rond af": één handeling zet afspraak, verslag, reis, status, stuurvelden en de volgende stap. Idempotent op afspraak en uitkomst. */
export async function rondAfAfspraak(tx: Tx, org: string, afspraakId: string, door: string, inv: AfrondInvoer, nu = new Date()) {
  const [ap] = await rijen(tx, sql`select ap.*, m.type, m.naam as soort_naam, m.data as soort_data, a.name as account_naam from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id where ap.id = ${afspraakId}`)
  if (!ap) fout(404, 'Afspraak niet gevonden')
  if (ap!.status === 'afgerond') {
    if (ap!.uitkomst_code === inv.uitkomst) return { alAfgerond: true, uitkomst: ap!.uitkomst_code, overdragen: !!ap!.data?.overdragen, tekst: 'Deze afspraak was al afgerond.' }
    fout(409, 'Deze afspraak is al afgerond met een andere uitkomst')
  }
  const alle = ap!.account_id ? await rijen(tx, sql`select ap.id, ap.account_id, ap.status, ap.start_at, case when m.type = 'klant' and coalesce((m.data->>'eersteAfspraak')::boolean, false) then 'klant' else 'intern' end as type from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.account_id = ${ap!.account_id}`) : []
  const eerste = !!ap!.account_id && ap!.type === 'klant' && !!ap!.soort_data?.eersteAfspraak && isEersteAfspraak(alle.map((x) => ({ id: x.id, accountId: x.account_id, status: x.status, start: new Date(x.start_at).toISOString(), meetingsoortType: x.type })), ap!.account_id, ap!.id)
  const m = meetingUitkomst({ accountNaam: ap!.account_naam, start: new Date(ap!.start_at).toISOString(), eerste }, { type: ap!.type, data: ap!.soort_data, naam: ap!.soort_naam }, inv.uitkomst, { ...inv, nu })
  if (m.fout) fout(400, m.fout)
  const data = { ...(ap!.data ?? {}), verslag: { tekst: inv.verslag ?? '', bron: 'getypt', perAgendapunt: inv.agendapunten ?? [] }, overdragen: m.overdragen, vervolgstap: inv.vervolgstap?.trim() || null, afronding: { sleutel: inv.sleutel ?? null, door, op: nu.toISOString() } }
  await tx.execute(sql`update appointments set status = 'afgerond', uitkomst_code = ${inv.uitkomst}, uitkomst_op = ${nu.toISOString()}, data = ${JSON.stringify(data)}::jsonb, updated_at = now(), versie = versie + 1 where id = ${ap!.id}`)
  // Gat 32: de gekoppelde taak sluit.
  if (ap!.task_id) {
    const [t] = await rijen(tx, sql`select status, action_type from tasks where id = ${ap!.task_id}`)
    if (t && t.status !== 'klaar') await rondAf(tx, ap!.task_id, { uitkomst: ['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht'].includes(t.action_type) ? 'afspraak' : 'gedaan', sleutel: `afspraak:${ap!.id}` }, door, nu).catch(() => null)
  }
  if (ap!.account_id && m.klantcontact) {
    await tx.execute(sql`insert into activiteiten (organisation_id, account_id, contact_id, soort, kanaal, uitkomst, door, op, data) values (${org}, ${ap!.account_id}, ${ap!.contact_id}, 'afspraak', ${ap!.vorm}, ${inv.uitkomst}, ${door}, ${nu.toISOString()}, ${JSON.stringify({ afspraakId: ap!.id, tekst: inv.verslag ?? null, soort: ap!.soort_naam })}::jsonb)`)
    await tx.execute(sql`update accounts set laatste_contact_op = ${nu.toISOString()} where id = ${ap!.account_id}`)
  }
  if (ap!.account_id) {
    // De eerste afspraak is gehouden (ook bij geen vervolg); daarna loopt nee via zetNee, dat
    // vanuit Afspraak gehouden de gebeurtenis geen-vervolg meldt en de terugkomregel zet.
    if (m.gebeurtenis === 'eerste-afspraak-gehouden' || (eerste && m.nee)) await meldGebeurtenis(tx, { accountId: ap!.account_id, gebeurtenis: 'eerste-afspraak-gehouden', door, nu, zonderMotor: true }).catch((e) => { if (!(e instanceof ReisFout)) throw e })
    if (m.nee) {
      await zetNee(tx, ap!.account_id, { reden: m.nee.reden, toelichting: m.nee.toelichting ?? undefined, verlorenAan: m.nee.verlorenAan ?? null }, door, nu).catch((e) => { if (!(e instanceof ReisFout)) throw e })
    }
    if (m.wachtendTot) await pauzeer(tx, ap!.account_id, m.wachtendTot, 'Later opnieuw na afspraak', door, nu).catch((e) => { if (!(e instanceof ReisFout)) throw e })
    for (const t of m.taken) {
      await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${org}, ${ap!.owner_id}, ${ap!.account_id}, ${t.actiesoort}, ${t.titel}, 'open', 'middel', ${nlTijdstip(t.dueDatum, 9).toISOString()}, 'mens', ${JSON.stringify({ herkomst: { bron: 'afspraak' }, afspraakId: ap!.id, verslag: inv.verslag ?? null })}::jsonb)`)
    }
  }
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'afspraak.afronden', resourceType: 'appointments', resourceId: ap!.id, changes: { uitkomst: inv.uitkomst, eerste } })
  // P19: de Notulist leest het verslag. In een savepoint: een fout in de analyse breekt het afronden nooit.
  if (ap!.account_id && (inv.verslag ?? '').trim().length >= 20) {
    await tx.transaction((sp) => analyseerVerslag(sp as unknown as Tx, org, ap!.id, nu)).catch((e) => console.error('notulist', (e as Error).message))
  }
  const label = (ap!.soort_data?.uitkomsten ?? []).find((u: any) => u.code === inv.uitkomst)?.label ?? inv.uitkomst
  return { alAfgerond: false, uitkomst: inv.uitkomst, eerste, overdragen: m.overdragen, planAfspraak: m.planAfspraak, tekst: m.overdragen ? `${label}. Overdragen? Er staat een overdrachtstaak klaar.` : `Afgerond: ${label}.` }
}

/** Niet verschenen of geannuleerd: een eerste afspraak meldt afspraak-niet-verschenen; een inzicht "Gat in je agenda". */
export async function zetAfspraakStatus(tx: Tx, org: string, afspraakId: string, door: string, status: 'niet_verschenen' | 'geannuleerd', nu = new Date()) {
  const [ap] = await rijen(tx, sql`select ap.*, m.type, m.data as soort_data, a.name as account_naam from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id where ap.id = ${afspraakId}`)
  if (!ap) fout(404, 'Afspraak niet gevonden')
  if (ap!.status !== 'gepland') fout(409, 'Alleen een geplande afspraak kan dit krijgen')
  const alle = ap!.account_id ? await rijen(tx, sql`select ap.id, ap.account_id, ap.status, ap.start_at, case when m.type = 'klant' and coalesce((m.data->>'eersteAfspraak')::boolean, false) then 'klant' else 'intern' end as type from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.account_id = ${ap!.account_id}`) : []
  const eerste = !!ap!.account_id && ap!.type === 'klant' && !!ap!.soort_data?.eersteAfspraak && isEersteAfspraak(alle.map((x) => ({ id: x.id, accountId: x.account_id, status: x.status, start: new Date(x.start_at).toISOString(), meetingsoortType: x.type })), ap!.account_id, ap!.id)
  await tx.execute(sql`update appointments set status = ${status}, updated_at = now(), versie = versie + 1 where id = ${ap!.id}`)
  if (eerste && ap!.account_id) await meldGebeurtenis(tx, { accountId: ap!.account_id, gebeurtenis: 'afspraak-niet-verschenen', door, nu, zonderMotor: true }).catch((e) => { if (!(e instanceof ReisFout)) throw e })
  // Het inzicht "Gat in je agenda" met de top drie kansen rond die plek (P14) en "Plan vervangend bezoek".
  const kansen = await kansenRond(tx, ap!.owner_id, ap!.account_id, new Date(ap!.start_at), new Date(ap!.end_at), nu).catch(() => [])
  const waarom = kansen.length ? `Er is tijd vrijgekomen. In de buurt: ${kansen.map((k) => `${k.naam} (${k.omrij} min)`).join(', ')}.` : 'Er is tijd vrijgekomen. Er staan nu geen kansen in de buurt.'
  await tx.execute(sql`insert into signals (organisation_id, account_id, owner_id, type, title, relevance_score, status, bron, data) values (${org}, ${ap!.account_id}, ${ap!.owner_id}, 'gat-in-agenda', ${`Gat in je agenda: ${ap!.account_naam ?? 'afspraak'} ${status === 'geannuleerd' ? 'geannuleerd' : 'niet verschenen'}`}, 70, 'nieuw', 'intern', ${JSON.stringify({ waarom, afspraakId: ap!.id, kansen })}::jsonb)`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: `afspraak.${status}`, resourceType: 'appointments', resourceId: ap!.id, changes: { eerste } })
  return { status, eerste }
}

// ── Lezen ────────────────────────────────────────────────────────────────────

export async function agendaVoor(tx: Tx, gebruikers: string[], van: Date, tot: Date) {
  if (!gebruikers.length) return { afspraken: [], belblokken: [], bezet: [], conflicten: [] as string[] }
  const lijst = gebruikers.join(',')
  const afs = await rijen(tx, sql`select ap.*, m.naam as soort_naam, m.slug, m.type, m.data->>'kleur' as kleur, a.name as account_naam, u.name as owner_naam, g.name as gepland_door_naam
    from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id join users u on u.id = ap.owner_id left join users g on g.id = ap.gepland_door
    where ap.owner_id = any(string_to_array(${lijst}, ',')) and ap.end_at > ${van.toISOString()} and ap.start_at < ${tot.toISOString()} and ap.status <> 'geannuleerd' order by ap.start_at`)
  const blokken = await rijen(tx, sql`select id, gebruiker_id, start_op, eind_op, status from belblok_sessies where gebruiker_id = any(string_to_array(${lijst}, ',')) and eind_op > ${van.toISOString()} and start_op < ${tot.toISOString()} and status in ('gepland', 'bezig')`)
  const uitAfs = afs.map((x) => ({
    id: x.id, ownerId: x.owner_id, ownerNaam: x.owner_naam, geplandDoor: x.gepland_door !== x.owner_id ? x.gepland_door_naam : null, accountId: x.account_id, accountNaam: x.account_naam,
    soort: { naam: x.soort_naam, slug: x.slug, type: x.type, kleur: x.kleur }, vorm: x.vorm, status: x.status, start: new Date(x.start_at).toISOString(), eind: new Date(x.end_at).toISOString(), uitkomst: x.uitkomst_code, locatie: x.data?.locatie ?? null, meetinglink: x.data?.meetinglink ?? null,
  }))
  const bezet = gebruikers.length === 1 ? await bezetExtern(tx, gebruikers[0]!, van, tot) : []
  return {
    afspraken: uitAfs,
    belblokken: blokken.map((b) => ({ id: b.id, gebruikerId: b.gebruiker_id, start: new Date(b.start_op).toISOString(), eind: new Date(b.eind_op).toISOString(), status: b.status })),
    bezet, conflicten: [...conflicten(uitAfs.map((a) => ({ id: a.id, ownerId: a.ownerId, start: a.start, eind: a.eind, status: a.status })))],
  }
}
