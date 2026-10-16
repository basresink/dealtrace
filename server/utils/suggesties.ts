// Suggesties naar SalesDNA (P23, F25 kader 2). De wekelijkse bundel komt uit de cijfers (gesprekken,
// verslagen, terugkomregels), gaat door het namenfilter en staat op Concept tot de salesmanager vrijgeeft.
// Hooguit 10 per sublaag per week; de rest schuift door. Zonder SalesDNA-koppeling wordt een vrijgegeven
// suggestie een taak voor de beheerder in de eigen inrichting, zonder verzenden.
import { sql } from 'drizzle-orm'
import { SUBLAAG, filterNamen, type Onderdeel } from '../../shared/verkoopverhaal'
import { MAX_PER_SUBLAAG, SUGGESTIE_SUBLAGEN, anonimiseer, bevatNaam, bundelSuggesties, isoWeek, kandidatenBezwaar, kandidatenBrancheBelofte, kandidatenConcurrent, kandidatenTerugkomregel, kandidatenWinpunt, volgendeWeek, type Kandidaat } from '../../shared/suggesties'
import { schrijfAudit } from './audit'
import { salesdnaBron } from './bronnen/salesdna'
import type { gebruikDb } from './db'
import { ontsleutel } from './geheimen'
import { verwerkSuggestieStatus } from './salesdna'
import { leesStand } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
type Kijker = { id: string; rol: string }
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }
const NIET = ['geen_reactie', 'voicemail', 'verzonden', 'niet_bereikt', 'verkeerd_nummer', 'bezet']

export function kwartaalVan(d: Date): { code: string; van: string } {
  const q = Math.floor(d.getUTCMonth() / 3)
  return { code: `${d.getUTCFullYear()}-K${q + 1}`, van: new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1)).toISOString() }
}

/** Namen van contacten en prospects: geen van deze mag in een suggestie (11.2, C.9 punt 9). */
export async function verbodenNamen(tx: Tx) {
  const c = await rijen(tx, sql`select first_name, last_name from contacts`)
  const a = await rijen(tx, sql`select name from accounts`)
  return {
    personen: c.map((x) => ({ naam: `${x.first_name ?? ''} ${x.last_name ?? ''}`.trim() })).filter((x) => x.naam),
    bedrijven: a.map((x) => String(x.name ?? '').trim()).filter(Boolean),
  }
}
export function bevatVerbodenNaam(tekst: string, n: Awaited<ReturnType<typeof verbodenNamen>>): boolean {
  const laag = tekst.toLowerCase()
  return bevatNaam(tekst, n.personen) || n.bedrijven.some((b) => b.length >= 4 && laag.includes(b.toLowerCase()))
}
export const schoonVanNamen = (tekst: string, n: Awaited<ReturnType<typeof verbodenNamen>>) => schoon(tekst, n)
const schoon = (tekst: string, n: Awaited<ReturnType<typeof verbodenNamen>>) => {
  let t = filterNamen(tekst, n.personen.map((p) => ({ naam: p.naam, rol: 'de contactpersoon' })))
  for (const b of n.bedrijven) if (b.length >= 4) t = t.split(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join('een prospect')
  return t
}

/** Alle kandidaten uit de cijfers van dit kwartaal en de verslagen van 90 dagen. */
export async function verzamelKandidaten(tx: Tx, nu = new Date()): Promise<Kandidaat[]> {
  const stand = await leesStand(tx)
  const kw = kwartaalVan(nu)
  const verslagen = await rijen(tx, sql`select start_at, data->'notulist'->'concurrenten' as c from appointments where data ? 'notulist' and start_at > ${new Date(nu.getTime() - 90 * 864e5).toISOString()}`)
  const gesprekken = await rijen(tx, sql`select a.uitkomst, acc.vv_branche_id as branche, a.data->'script'->'bezwaren' as bezwaren, a.data->'vv'->>'winpuntId' as winpunt
    from activiteiten a left join accounts acc on acc.id = a.account_id
    where a.soort in ('gebeld', 'bezoek') and a.op >= ${kw.van} and a.op <= ${nu.toISOString()} and coalesce(a.uitkomst, '') <> '' and a.uitkomst not in ${sql.raw(`(${NIET.map((x) => `'${x}'`).join(', ')})`)}`)
  const bezwaar = new Map<string, { bezwaar: string; gesprekken: number; afspraken: number; argumentRef: string | null }>()
  const basis = { gesprekken: 0, afspraken: 0 }
  const perBranche = new Map<string, number>()
  const perWinpunt = new Map<string, { gesprekken: number; afspraken: number }>()
  for (const g of gesprekken) {
    const afspraak = g.uitkomst === 'afspraak' ? 1 : 0
    const bz = (Array.isArray(g.bezwaren) ? g.bezwaren : []) as { bezwaar: string; argumentRef?: string | null }[]
    if (!bz.length) { basis.gesprekken++; basis.afspraken += afspraak }
    for (const z of bz) {
      const k = String(z.bezwaar ?? '').trim()
      if (!k) continue
      const b = bezwaar.get(k) ?? { bezwaar: k, gesprekken: 0, afspraken: 0, argumentRef: z.argumentRef ?? null }
      b.gesprekken++; b.afspraken += afspraak
      bezwaar.set(k, b)
    }
    if (g.branche) perBranche.set(g.branche, (perBranche.get(g.branche) ?? 0) + 1)
    if (g.winpunt) { const w = perWinpunt.get(g.winpunt) ?? { gesprekken: 0, afspraken: 0 }; w.gesprekken++; w.afspraken += afspraak; perWinpunt.set(g.winpunt, w) }
  }
  const terug = await rijen(tx, sql`select data->'herkomst'->>'regelId' as regel, count(*)::int as n, count(*) filter (where uitkomst = 'afspraak')::int as afspraken
    from tasks where data->'herkomst'->>'bron' = 'terugkomregel' and data->'herkomst'->>'regelId' is not null and status = 'klaar' and updated_at >= ${kw.van} group by 1`)
  return [
    ...kandidatenConcurrent(verslagen.map((v) => ({ op: new Date(v.start_at).toISOString(), concurrenten: Array.isArray(v.c) ? v.c.map(String) : [] })), stand.concurrenten ?? [], nu),
    ...kandidatenBezwaar([...bezwaar.values()], basis),
    ...kandidatenBrancheBelofte((stand.branches ?? []).map((b) => ({ brancheId: b.id, naam: b.naam, gesprekken: perBranche.get(b.id) ?? 0, kwartaal: kw.code })), (stand.teksten ?? []).map((t) => ({ sublaag: t.sublaag, brancheId: t.brancheId }))),
    ...kandidatenTerugkomregel(terug.map((t) => ({ regelId: t.regel, reden: stand.terugkomregels.find((r) => r.id === t.regel)?.reden ?? t.regel, terug: t.n, afspraken: t.afspraken }))),
    ...kandidatenWinpunt([...perWinpunt].map(([id, w]) => ({ winpuntId: id, titel: (stand.winpunten ?? []).find((x) => x.id === id)?.titel ?? id, ...w }))),
  ]
}

/**
 * De wekelijkse bundel (job): nieuwe kandidaten op Concept in deze week, hooguit 10 per sublaag; de rest
 * in de volgende week. Elke kandidaat één keer per kwartaal (sleutel). De salesmanagers krijgen een melding.
 */
export async function maakBundel(tx: Tx, org: string, nu = new Date(), kandidaten?: Kandidaat[]): Promise<{ week: string; nieuw: number; doorgeschoven: number }> {
  const week = isoWeek(nu)
  const kw = kwartaalVan(nu).code
  const lijst = kandidaten ?? await verzamelKandidaten(tx, nu)
  const bestaand = new Set((await rijen(tx, sql`select sleutel from salesdna_suggesties`)).map((r) => r.sleutel))
  const nieuw = lijst.map((k) => ({ ...k, sleutel: `${kw}:${k.sleutel}` })).filter((k) => !bestaand.has(k.sleutel))
  if (!nieuw.length) return { week, nieuw: 0, doorgeschoven: 0 }
  const gebruikt = Object.fromEntries((await rijen(tx, sql`select onderwerp_id, count(*)::int as n from salesdna_suggesties where week = ${week} group by 1`)).map((r) => [r.onderwerp_id, r.n]))
  const { bundel, over } = bundelSuggesties(nieuw, MAX_PER_SUBLAAG, gebruikt)
  const namen = await verbodenNamen(tx)
  const zet = async (k: (typeof nieuw)[number], w: string) => {
    const bewijs = { aantallen: k.bewijs.aantallen, citaten: anonimiseer(k.bewijs.citaten, namen.personen.map((p) => ({ naam: p.naam }))).map((c) => schoon(c, namen)) }
    await tx.execute(sql`insert into salesdna_suggesties (organisation_id, week, onderwerp_id, veld, regel_extern_id, soort, tekst, bewijs, kracht, sleutel, op)
      values (${org}, ${w}, ${k.onderwerpId}, ${k.veld}, ${k.regelExternId}, ${k.soort}, ${schoon(k.tekst, namen)}, ${JSON.stringify(bewijs)}::jsonb, ${k.kracht}, ${k.sleutel}, ${nu.toISOString()}) on conflict (organisation_id, sleutel) do nothing`)
  }
  for (const k of bundel) await zet(k, week)
  for (const k of over) await zet(k, volgendeWeek(week))
  if (bundel.length) {
    for (const m of await rijen(tx, sql`select id from users where role = 'salesmanager' and status = 'actief'`)) {
      await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${m.id}, 'systeem', 'Concept klaar ter goedkeuring', ${`${bundel.length} ${bundel.length === 1 ? 'suggestie' : 'suggesties'} naar SalesDNA wachten op je besluit.`}, '/team?suggesties=1', ${nu.toISOString()}, '{}'::jsonb)`)
    }
  }
  return { week, nieuw: bundel.length, doorgeschoven: over.length }
}

async function zichtbaar(tx: Tx, k: Kijker): Promise<ReturnType<typeof sql>> {
  if (k.rol === 'beheerder') return sql`true`
  const teams = (await rijen(tx, sql`select id from teams where ${k.id} = any(manager_ids)`)).map((t) => t.id)
  return teams.length ? sql`(team_id is null or team_id in ${sql.raw(`(${teams.map((t) => `'${String(t).replace(/'/g, "''")}'`).join(', ')})`)})` : sql`team_id is null`
}
const uit = (r: Rij) => ({ id: r.id as string, week: r.week, onderwerpId: r.onderwerp_id, veld: r.veld, regelExternId: r.regel_extern_id, soort: r.soort, tekst: r.tekst, bewijs: r.bewijs, status: r.status, bron: r.bron, fout: r.fout, verstuurdOp: r.verstuurd_op ? new Date(r.verstuurd_op).toISOString() : null })

/** De suggesties van een week per sublaag, plus de open voorstellen van Experts uit het team. */
export async function suggestiesVoor(tx: Tx, k: Kijker, week: string | null, nu = new Date()) {
  if (!['salesmanager', 'beheerder'].includes(k.rol)) fout(403, 'Alleen voor de salesmanager en de beheerder')
  const w = week && /^\d{4}-W\d{2}$/.test(week) ? week : isoWeek(nu)
  const lijst = await rijen(tx, sql`select * from salesdna_suggesties where week = ${w} and ${await zichtbaar(tx, k)} order by kracht desc, op`)
  const [kop] = await rijen(tx, sql`select status, instellingen->>'endpoint' as endpoint from koppelingen where soort = 'salesdna'`)
  const leden = k.rol === 'beheerder' ? null : (await rijen(tx, sql`select u.id from users u join teams t on t.id = u.team_id where ${k.id} = any(t.manager_ids)`)).map((u) => u.id)
  const voorstellen = await rijen(tx, sql`select v.id, v.onderdeel, v.soort, v.tekst, v.op, v.door as door_id, u.name as door from vv_voorstellen v left join users u on u.id = v.door where v.status = 'open' order by v.op desc limit 30`)
  const groepen = SUGGESTIE_SUBLAGEN.map((s) => ({ ...s, suggesties: lijst.filter((r) => r.onderwerp_id === s.onderwerpId).map(uit) }))
  const overig = lijst.filter((r) => !SUGGESTIE_SUBLAGEN.some((s) => s.onderwerpId === r.onderwerp_id))
  if (overig.length) groepen.push({ onderwerpId: 'overig', label: 'Overig', suggesties: overig.map(uit) } as any)
  return {
    week: w, gekoppeld: kop?.status === 'actief', groepen: groepen.filter((g) => g.suggesties.length),
    open: lijst.filter((r) => r.status === 'concept').length,
    voorstellen: voorstellen.filter((v) => !leden || leden.includes(v.door_id)).map((v) => ({ id: v.id, onderdeel: v.onderdeel, soort: v.soort, tekst: v.tekst, door: String(v.door ?? '').replace(/^Testgebruiker /, ''), op: new Date(v.op).toISOString() })),
  }
}

/** Een voorstel van een Expert (vv_voorstellen) gaat via de salesmanager de bundel in, als Concept. */
export async function voorstelNaarBundel(tx: Tx, org: string, k: Kijker, voorstelId: string, nu = new Date()) {
  if (!['salesmanager', 'beheerder'].includes(k.rol)) fout(403, 'Alleen voor de salesmanager en de beheerder')
  const [v] = await rijen(tx, sql`select v.*, u.team_id from vv_voorstellen v left join users u on u.id = v.door where v.id = ${voorstelId} and v.status = 'open'`)
  if (!v) fout(404, 'Voorstel niet gevonden')
  const onderwerp = SUBLAAG[v!.onderdeel as Onderdeel]
  if (!onderwerp) fout(422, 'Dit onderdeel kent geen kader 2 in SalesDNA')
  const namen = await verbodenNamen(tx)
  await tx.execute(sql`insert into salesdna_suggesties (organisation_id, week, onderwerp_id, veld, regel_extern_id, soort, tekst, bewijs, bron, team_id, door, sleutel, op)
    values (${org}, ${isoWeek(nu)}, ${onderwerp}, ${v!.soort}, ${v!.ref}, ${`voorstel: ${v!.soort}`}, ${schoon(v!.tekst, namen)}, ${JSON.stringify({ aantallen: [], citaten: [] })}::jsonb, 'expert', ${v!.team_id}, ${v!.door}, ${`voorstel:${v!.id}`}, ${nu.toISOString()}) on conflict (organisation_id, sleutel) do nothing`)
  await tx.execute(sql`update vv_voorstellen set status = 'overgenomen' where id = ${voorstelId}`)
  await schrijfAudit(tx, { organisationId: org, actorId: k.id, action: 'salesdna.suggestie.uitVoorstel', resourceType: 'vv_voorstellen', resourceId: voorstelId, changes: {} })
  return { ok: true }
}

/** Geef vrij of wijs af, eventueel met aangepaste tekst. Een tekst met een naam geeft 422. Vrijgeven verstuurt direct. */
export async function besluitSuggestie(tx: Tx, org: string, k: Kijker, id: string, b: { tekst?: string | null; besluit: 'vrij' | 'af' }, nu = new Date(), opties: { zonderVersturen?: boolean } = {}) {
  if (k.rol !== 'salesmanager' && k.rol !== 'beheerder') fout(403, 'Alleen de salesmanager geeft suggesties vrij')
  const [s] = await rijen(tx, sql`select * from salesdna_suggesties where id = ${id} and ${await zichtbaar(tx, k)}`)
  if (!s) fout(404, 'Suggestie niet gevonden')
  if (!['concept', 'vrijgegeven', 'mislukt'].includes(s!.status)) fout(409, 'Deze suggestie is al verstuurd of afgewezen')
  let tekst = s!.tekst as string
  if (typeof b.tekst === 'string' && b.tekst.trim() && b.tekst.trim() !== tekst) {
    tekst = b.tekst.trim().slice(0, 1000)
    if (bevatVerbodenNaam(tekst, await verbodenNamen(tx))) fout(422, 'De tekst noemt een persoon of prospect. Haal de naam weg; suggesties gaan zonder namen naar SalesDNA.')
  }
  if (b.besluit === 'af') {
    await tx.execute(sql`update salesdna_suggesties set status = 'afgewezen', tekst = ${tekst} where id = ${id}`)
  } else {
    await tx.execute(sql`update salesdna_suggesties set status = 'vrijgegeven', tekst = ${tekst}, vrijgegeven_door = ${k.id}, vrijgegeven_op = ${nu.toISOString()}, fout = null where id = ${id}`)
  }
  await schrijfAudit(tx, { organisationId: org, actorId: k.id, action: `salesdna.suggestie.${b.besluit === 'af' ? 'afgewezen' : 'vrijgegeven'}`, resourceType: 'salesdna_suggesties', resourceId: id, changes: { tekstAangepast: tekst !== s!.tekst } })
  const verzonden = b.besluit === 'vrij' && !opties.zonderVersturen ? await verstuur(tx, org, k, [id], nu) : null
  return { ...uit((await rijen(tx, sql`select * from salesdna_suggesties where id = ${id}`))[0]!), verzonden }
}

/**
 * Versturen naar kader 2 (F25 Uitgaand): alleen vrijgegeven suggesties, hooguit 10 per sublaag per week
 * (429 daarboven). Zonder SalesDNA-koppeling: een taak voor de beheerder, niets verzonden.
 */
export async function verstuur(tx: Tx, org: string, k: Kijker, ids: string[], nu = new Date()) {
  if (k.rol !== 'salesmanager' && k.rol !== 'beheerder') fout(403, 'Alleen de salesmanager verstuurt suggesties')
  const lijst = ids.length ? await rijen(tx, sql`select * from salesdna_suggesties where status = 'vrijgegeven' and id in ${sql.raw(`(${ids.map((i) => `'${String(i).replace(/'/g, "''")}'`).join(', ')})`)}`) : []
  if (!lijst.length) return { verstuurd: 0, overgenomen: 0, eigenInrichting: 0, mislukt: 0 }
  const [kop] = await rijen(tx, sql`select * from koppelingen where soort = 'salesdna'`)
  if (!kop || kop.status !== 'actief') {
    // Zonder koppeling: voorstel voor de eigen inrichting (taak voor de beheerder met link).
    for (const b of await rijen(tx, sql`select id from users where role = 'beheerder' and status = 'actief' limit 1`)) {
      for (const s of lijst) {
        await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, action_type, title, status, priority, due_date, executor, onderwerp, data) values (${crypto.randomUUID()}, ${org}, ${b.id}, 'taak', ${`Verkoopverhaal aanvullen: ${SUGGESTIE_SUBLAGEN.find((x) => x.onderwerpId === s.onderwerp_id)?.label ?? s.onderwerp_id}`}, 'open', 'middel', ${nu.toISOString()}, 'mens', ${`suggestie:${s.id}`},
          ${JSON.stringify({ waarom: s.tekst, link: '/instellingen/verkoopverhaal', herkomst: { bron: 'suggestie', suggestieId: s.id } })}::jsonb) on conflict do nothing`)
      }
    }
    return { verstuurd: 0, overgenomen: 0, eigenInrichting: lijst.length, mislukt: 0 }
  }
  const per = new Map<string, Rij[]>()
  for (const s of lijst) per.set(`${s.week}|${s.onderwerp_id}`, [...(per.get(`${s.week}|${s.onderwerp_id}`) ?? []), s])
  for (const [sleutel, groep] of per) {
    const [week, onderwerp] = sleutel.split('|')
    const [r] = await rijen(tx, sql`select count(*)::int as n from salesdna_suggesties where week = ${week} and onderwerp_id = ${onderwerp} and status in ('verstuurd', 'overgenomen', 'afgewezen_salesdna')`)
    if (r!.n + groep.length > MAX_PER_SUBLAAG) fout(429, `Deze week gaan er al ${r!.n} suggesties naar ${SUGGESTIE_SUBLAGEN.find((x) => x.onderwerpId === onderwerp)?.label ?? onderwerp}. Hooguit ${MAX_PER_SUBLAAG} per sublaag per week.`)
  }
  const namen = await verbodenNamen(tx)
  const bron = salesdnaBron(String(kop.instellingen?.endpoint ?? ''), ontsleutel(kop.geheimen)?.geheim ?? '')
  const eventId = crypto.randomUUID()
  const bundel = { eventId, tijd: nu.toISOString(), week: lijst[0]!.week, suggesties: lijst.map((s) => ({ id: s.id, onderwerpId: s.onderwerp_id, kader: 2 as const, veld: s.veld, regelExternId: s.regel_extern_id, soort: s.soort, tekst: schoon(s.tekst, namen), bewijs: s.bewijs })) }
  const r = await bron.stuurSuggesties(bundel)
  await tx.execute(sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start, eind, geschreven, fouten) values (${org}, ${kop.id}, 'salesdna', 'suggesties', ${nu.toISOString()}, now(), ${r.ok ? r.ontvangen.length : 0}, ${JSON.stringify(r.ok ? [] : [r.reden])}::jsonb)`)
  if (!r.ok) {
    for (const s of lijst) await tx.execute(sql`update salesdna_suggesties set status = 'mislukt', fout = ${r.reden} where id = ${s.id}`)
    return { verstuurd: 0, overgenomen: 0, eigenInrichting: 0, mislukt: lijst.length, melding: r.reden }
  }
  for (const s of lijst) await tx.execute(sql`update salesdna_suggesties set status = 'verstuurd', verstuurd_op = ${nu.toISOString()}, fout = null where id = ${s.id}`)
  // De mock antwoordt meteen met suggestie.status; de echte SalesDNA stuurt hem later via de webhook (P29).
  for (const st of r.statussen) await verwerkSuggestieStatus(tx, { suggestieId: st.suggestieId, status: st.status, tijd: nu.toISOString() })
  return { verstuurd: lijst.length, overgenomen: r.statussen.filter((x) => x.status === 'overgenomen').length, eigenInrichting: 0, mislukt: 0 }
}

/** "Mag dit een bewijs worden?" na deal.gewonnen: Ja maakt een Concept voor de bundel (zonder namen), Nee sluit de vraag. */
export async function beantwoordBewijs(tx: Tx, org: string, g: { id: string; teamId?: string | null }, accountId: string, ja: boolean, nu = new Date()) {
  const [a] = await rijen(tx, sql`select id, vv_branche_id, data from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  if (a!.data?.extern?.dealdrive?.bewijsVraag !== 'open') fout(409, 'Deze vraag is al beantwoord')
  await tx.execute(sql`update accounts set data = jsonb_set(data, '{extern,dealdrive,bewijsVraag}', ${JSON.stringify(ja ? 'ja' : 'nee')}::jsonb) where id = ${accountId}`)
  if (!ja) return { ok: true, suggestie: null }
  const stand = await leesStand(tx)
  const branche = (stand.branches ?? []).find((b) => b.id === a!.vv_branche_id)?.naam ?? null
  const [ov] = await rijen(tx, sql`select pakket->'verkoopverhaal'->>'winpuntIngezet' as w from overdrachten where account_id = ${accountId} and naar = 'dealdrive' order by op desc limit 1`)
  const tekst = `Gewonnen na overdracht${branche ? ` in ${branche}` : ''}${ov?.w ? `, met winpunt "${ov.w}" ingezet` : ''}. Mogelijk bewijs voor kader 2.`
  const [u] = await rijen(tx, sql`select team_id from users where id = ${g.id}`)
  const [s] = await rijen(tx, sql`insert into salesdna_suggesties (organisation_id, week, onderwerp_id, veld, regel_extern_id, soort, tekst, bewijs, bron, team_id, door, sleutel, op)
    values (${org}, ${isoWeek(nu)}, 'L0.4', 'bewijs', ${a!.vv_branche_id ?? null}, 'nieuw bewijs', ${tekst}, ${JSON.stringify({ aantallen: [{ label: 'gewonnen deals na overdracht', waarde: 1 }], citaten: [] })}::jsonb, 'gewonnen', ${u?.team_id ?? null}, ${g.id}, ${`bewijs:${accountId}`}, ${nu.toISOString()})
    on conflict (organisation_id, sleutel) do nothing returning id`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'overdracht.bewijsVoorstel', resourceType: 'accounts', resourceId: accountId, changes: { ja } })
  return { ok: true, suggestie: s?.id ?? null }
}
