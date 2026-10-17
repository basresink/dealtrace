// De coachingkaart en Mijn resultaten (P21, F20). Een coachingpunt verschijnt pas bij de accountmanager na
// "Deel"; een privénotitie komt nooit in een respons voor de accountmanager.
import { eq, sql } from 'drizzle-orm'
import { nlMoment, nlTijdstip, plusDagen, volgendWerkmoment } from '../../shared/datum'
import { kiesGesprekken, kpi, teamGemiddelde, tempo, type Periode } from '../../shared/team'
import { schrijfAudit } from './audit'
import { gebruikDb, schema } from './db'
import { laadFunnel } from './funnel'
import { ledenVan, ruw, vereisTeamlid, type Kijker } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const datum = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

/** Vier weken in weken van maandag tot zondag, de laatste tot vandaag. */
export function vierWeken(vandaag: string): Periode[] {
  const d = new Date(`${vandaag}T12:00:00Z`).getUTCDay()
  const maandag = plusDagen(vandaag, -((d + 6) % 7))
  return [3, 2, 1, 0].map((w) => ({ van: plusDagen(maandag, -7 * w), tot: w === 0 ? vandaag : plusDagen(maandag, -7 * w + 6) }))
}

/** Cijfers van één persoon over vier weken met trend, en het team over dezelfde periode. */
export async function cijfers(tx: Tx, gebruiker: { id: string; werkplek?: string | null; team_id?: string | null }, nu = new Date(), metTeam = true) {
  const vandaag = nlMoment(nu).datum
  const weken = vierWeken(vandaag)
  const totaal = { van: weken[0]!.van, tot: vandaag }
  const leden = metTeam && gebruiker.team_id ? await ledenVan(tx, [gebruiker.team_id]) : []
  const ids = [...new Set([gebruiker.id, ...leden.map((l) => l.id)])]
  const r = await ruw(tx, ids, totaal, nu)
  const k = kpi(gebruiker.id, totaal, r.activiteiten)
  const per = (id: string) => r.afsprakenGehouden.filter((a) => a.owner === id).length
  const gepland = k.afspraken
  const gehouden = per(gebruiker.id)
  const over = r.overgedragen.filter((o) => o.door === gebruiker.id).length
  const [winpunt] = await rijen(tx, sql`select count(*) filter (where coalesce((data->>'winpuntUitgevoerd')::boolean, false))::int as ja, count(*)::int as n from appointments where owner_id = ${gebruiker.id} and status = 'afgerond' and start_at >= ${totaal.van}`)
  const [concept] = await rijen(tx, sql`select count(*) filter (where overname = 'ongewijzigd')::int as ongewijzigd, count(*) filter (where overname is not null)::int as n from concepten where gebruiker_id = ${gebruiker.id} and status = 'verstuurd' and op >= ${totaal.van}`)
  return {
    periode: totaal, kpi: k, tempo: tempo(k, gebruiker.werkplek),
    trend: weken.map((w) => ({ van: w.van, ...(({ pogingen, gesprekken, afspraken, beslisser }) => ({ pogingen, gesprekken, afspraken, beslisser }))(kpi(gebruiker.id, w, r.activiteiten)) })),
    conversie: {
      gesprekNaarAfspraak: k.gesprekNaarAfspraak,
      geplandNaarGehouden: { waarde: gepland ? Math.round((gehouden / gepland) * 1000) / 1000 : 0, noemer: gepland },
      gehoudenNaarOvergedragen: { waarde: gehouden ? Math.round((over / gehouden) * 1000) / 1000 : 0, noemer: gehouden },
    },
    discipline: {
      takenOpDag: { waarde: r.takenVandaag.filter((t) => t.owner === gebruiker.id).length ? Math.round((r.afgerondOpDag.filter((t) => t.owner === gebruiker.id).length / r.takenVandaag.filter((t) => t.owner === gebruiker.id).length) * 1000) / 1000 : 0, noemer: r.takenVandaag.filter((t) => t.owner === gebruiker.id).length },
      winpuntUitgevoerd: { waarde: winpunt?.n ? Math.round((winpunt.ja / winpunt.n) * 1000) / 1000 : 0, noemer: winpunt?.n ?? 0 },
      belblokken: r.belblokken.filter((b) => b.gebruiker === gebruiker.id && b.status === 'klaar').length,
    },
    kwaliteit: { conceptOngewijzigd: { waarde: concept?.n ? Math.round((concept.ongewijzigd / concept.n) * 1000) / 1000 : 0, noemer: concept?.n ?? 0 } },
    team: metTeam ? teamGemiddelde(leden.map((l) => ({ kpi: kpi(l.id, totaal, r.activiteiten) }))) : null,
    ruw: r,
  }
}

export const notitieUit = (n: Rij) => ({ id: n.id as string, soort: n.soort as 'afspraak' | 'prive', tekst: n.tekst as string, termijn: datum(n.termijn), status: n.status as string, op: iso(n.op)!, reactie: n.data?.reactie ?? null, sessieId: n.sessie_id ?? null })

/** De coachingkaart voor de manager. */
export async function coachingKaart(tx: Tx, g: Kijker, gebruikerId: string, nu = new Date()) {
  const u = await vereisTeamlid(tx, g, gebruikerId)
  const c = await cijfers(tx, u as any, nu)
  const vandaag = nlMoment(nu).datum
  const funnel = await laadFunnel(tx, { van: c.periode.van, tot: vandaag, gebruikerIds: [u.id] }, { details: false })
  const teamLeden = u.team_id ? (await ledenVan(tx, [u.team_id])).map((l) => l.id as string) : [u.id]
  const funnelTeam = await laadFunnel(tx, { van: c.periode.van, tot: vandaag, gebruikerIds: teamLeden }, { details: false })
  const week = c.ruw.activiteiten.filter((a) => a.door === u.id && a.op.slice(0, 10) >= plusDagen(vandaag, -7) && ['gebeld', 'bezoek', 'afspraak'].includes(a.soort))
  const gesprekken = kiesGesprekken(week).map((x) => ({ soort: x.soort, id: x.item.id, account: x.item.account, accountId: x.item.accountId, uitkomst: x.item.uitkomst, tekst: x.item.tekst, op: x.item.op, bezwaar: x.item.bezwaar }))
  const sessies = await rijen(tx, sql`select * from coaching_sessies where gebruiker_id = ${u.id} order by datum desc, created_at desc limit 12`)
  const notities = await rijen(tx, sql`select * from coaching_notities where gebruiker_id = ${u.id} order by op desc limit 100`)
  const afspraken = notities.filter((n) => n.soort === 'afspraak').map(notitieUit)
  const gehaald = afspraken.filter((a) => a.status !== 'open')
  const [vv] = await rijen(tx, sql`select max(bevestigd_op) as op from vv_versies`)
  return {
    persoon: { id: u.id, naam: u.name, niveau: u.niveau, werkplek: u.werkplek },
    cijfers: { ...c, ruw: undefined },
    funnel: { persoon: funnel.fases.map((f: any) => ({ faseId: f.faseId, label: f.label, aantal: f.aantal })), team: funnelTeam.fases.map((f: any) => ({ faseId: f.faseId, aantal: f.aantal })) },
    gesprekken,
    vandaag, sessie: sessies[0] ? { id: sessies[0].id, datum: datum(sessies[0].datum), punten: sessies[0].data?.punten ?? [], gesprekken: sessies[0].data?.gesprekken ?? [], afgerond: sessies[0].data?.afgerond ?? null } : null,
    afspraken, prive: notities.filter((n) => n.soort === 'prive').map(notitieUit),
    historie: sessies.map((s) => ({ id: s.id, datum: datum(s.datum), afgerond: !!s.data?.afgerond, punten: (s.data?.punten ?? []).length, afspraken: afspraken.filter((a) => a.sessieId === s.id).length })),
    afsprakenGehaald: { waarde: gehaald.length ? Math.round((gehaald.filter((a) => a.status === 'gehaald').length / gehaald.length) * 1000) / 1000 : null, noemer: gehaald.length },
    oefening: vv?.op && (!sessies[0] || iso(vv.op)! > iso(sessies[0].created_at)!) ? 'Vertel ons verhaal in twee minuten' : null,
  }
}

/** Overzicht voor /coaching: teamleden met het laatste gesprek, het team, het tempo en de achterstand van
 * de laatste twee weken (de coachingnorm) en de open afspraken uit eerdere gesprekken. */
export async function coachingOverzicht(tx: Tx, teamIds: string[], teams: { id: string; naam: string }[] = [], nu = new Date()) {
  const leden = await ledenVan(tx, teamIds)
  if (!leden.length) return []
  const ids = leden.map((l) => l.id).join(',')
  const vandaag = nlMoment(nu).datum
  const periode = { van: plusDagen(vandaag, -13), tot: vandaag }
  const r = await ruw(tx, leden.map((l) => l.id as string), periode, nu)
  const laatst = await rijen(tx, sql`select gebruiker_id, max(datum) as datum, count(*)::int as n from coaching_sessies where gebruiker_id = any(string_to_array(${ids}, ',')) group by 1`)
  const open = await rijen(tx, sql`select id, gebruiker_id, tekst, termijn, op from coaching_notities where soort = 'afspraak' and status = 'open' and gebruiker_id = any(string_to_array(${ids}, ',')) order by termijn nulls last, op`)
  return leden.map((l) => {
    const k = kpi(l.id, periode, r.activiteiten)
    const datumGesprek = datum(laatst.find((x) => x.gebruiker_id === l.id)?.datum)
    const afspraken = open.filter((x) => x.gebruiker_id === l.id).map((x) => ({ id: x.id as string, tekst: x.tekst as string, termijn: datum(x.termijn), overTermijn: !!datum(x.termijn) && datum(x.termijn)! < vandaag }))
    return {
      id: l.id, naam: l.naam, niveau: l.niveau, werkplek: l.werkplek,
      team: teams.find((t) => t.id === l.team_id) ?? null,
      laatsteGesprek: datumGesprek,
      dagenSindsGesprek: datumGesprek ? Math.round((Date.parse(`${vandaag}T12:00:00Z`) - Date.parse(`${datumGesprek}T12:00:00Z`)) / 864e5) : null,
      gesprekken: laatst.find((x) => x.gebruiker_id === l.id)?.n ?? 0,
      openAfspraken: afspraken.length, afspraken,
      tempo: tempo(k, l.werkplek), pogingen: k.pogingen, gesprekkenGevoerd: k.gesprekken, afsprakenGemaakt: k.afspraken,
      achterstallig: r.achterstallig.filter((t) => t.owner === l.id).length,
    }
  })
}

/** Mijn resultaten: eigen cijfers; vanaf Gevorderd trend en teamgemiddelde (zonder namen); afspraken en gedeelde punten. Nooit privé. */
export async function mijnResultaten(tx: Tx, g: { id: string }, opties: { vergelijken: boolean }, nu = new Date()) {
  const [u] = await rijen(tx, sql`select id, name, werkplek, team_id, niveau from users where id = ${g.id}`)
  const c = await cijfers(tx, u as any, nu, opties.vergelijken)
  const afspraken = (await rijen(tx, sql`select * from coaching_notities where gebruiker_id = ${g.id} and soort = 'afspraak' order by op desc limit 50`)).map(notitieUit)
  const gedeeld = (await rijen(tx, sql`select datum, data from coaching_sessies where gebruiker_id = ${g.id} order by datum desc limit 6`))
    .flatMap((s) => ((s.data?.punten ?? []) as any[]).filter((p) => p.gedeeld).map((p) => ({ datum: datum(s.datum), tekst: p.tekst, onderbouwing: p.onderbouwing, artikelSleutel: p.artikelSleutel })))
  return {
    kpi: c.kpi, tempo: c.tempo, conversie: c.conversie, discipline: c.discipline, periode: c.periode,
    trend: opties.vergelijken ? c.trend : null, team: opties.vergelijken ? c.team : null,
    afspraken, punten: gedeeld,
  }
}

/** Een afspraak uit een coachingsgesprek wordt een echte taak voor de verkoper: deadline de termijn (9.00 uur),
 * anders het eerste werkmoment; herkomst coaching. Taak, melding (link naar de taak) en auditregel in dezelfde
 * transactie als de afspraak. */
export async function afspraakAlsTaak(tx: Tx, org: string, managerId: string, verkoperId: string, n: { id: string; tekst: string; termijn?: string | null; sessieId?: string | null }, nu = new Date()): Promise<string> {
  const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
  const due = (n.termijn ? nlTijdstip(n.termijn, 9) : volgendWerkmoment(nu, werkdagen)).toISOString()
  const [t] = await tx.insert(schema.tasks).values({
    organisationId: org, ownerId: verkoperId, accountId: null, contactId: null, title: `Coachingafspraak: ${n.tekst}`.slice(0, 200),
    actionType: 'taak', priority: 'middel', dueDate: due, executor: 'mens',
    data: { herkomst: { bron: 'coaching', actiesoort: 'taak', uitvoerder: verkoperId }, coachingManagerId: managerId, beschrijving: n.tekst.slice(0, 1000), coachingNotitieId: n.id, ...(n.sessieId ? { coachingSessieId: n.sessieId } : {}) },
  }).returning({ id: schema.tasks.id })
  await tx.execute(sql`update coaching_notities set data = data || ${JSON.stringify({ taakId: t!.id })}::jsonb where id = ${n.id}`)
  await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${verkoperId}, 'systeem', 'Coachingafspraak gedeeld', ${n.tekst.slice(0, 200)}, ${`/taken?taak=${t!.id}`}, now(), '{}'::jsonb)`)
  await schrijfAudit(tx, { organisationId: org, actorId: managerId, action: 'coaching.afspraak', resourceType: 'tasks', resourceId: t!.id, metadata: { gebruiker: verkoperId, notitie: n.id, termijn: n.termijn ?? null } })
  return t!.id
}

/** Rond een coachingsgesprek af: data.afgerond met moment en wie, auditregel coaching.afronden. Alleen de manager
 * van die persoon of de beheerder (vereisTeamlid). Een tweede keer verandert niets. */
export async function rondSessieAf(tx: Tx, org: string, g: Kijker, sessieId: string, nu = new Date()) {
  const [s] = await rijen(tx, sql`select * from coaching_sessies where id = ${sessieId}`)
  if (!s) throw Object.assign(new Error('Sessie onbekend'), { statusCode: 404, statusMessage: 'Sessie onbekend' })
  await vereisTeamlid(tx, g, s.gebruiker_id)
  if (s.data?.afgerond) return s.data.afgerond as { op: string; door: string }
  const afgerond = { op: nu.toISOString(), door: g.id }
  await tx.execute(sql`update coaching_sessies set data = data || ${JSON.stringify({ afgerond })}::jsonb, updated_at = now() where id = ${sessieId}`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'coaching.afronden', resourceType: 'coaching_sessies', resourceId: sessieId, metadata: { gebruiker: s.gebruiker_id, punten: (s.data?.punten ?? []).length } })
  return afgerond
}
