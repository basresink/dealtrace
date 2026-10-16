// Signaalradar op de server (F5). Laadt de inzichten met bron van de laatste zeven perioden binnen de
// gekozen reikwijdte (mijn regio, mijn team of mijn accounts, of de hele organisatie), zet er de branche
// uit het verkoopverhaal en de signaalsoort bij en telt met de pure kern uit shared/signaalradar.ts.
// Een golf wordt een campagneconcept via de bestaande campagnelogica, of gaat in het volgende belblok.
import { sql } from 'drizzle-orm'
import {
  capaciteitTekst, celSleutel, golfOordeel, legeCel, plekkenInBlokken, RADAR, SIGNAALSOORTEN, SOORT_INFO, signaalsoortVan, telbaar, telCellen, winpuntVoorGolf,
  type Cel, type RadarSignaal, type Signaalsoort,
} from '../../shared/signaalradar'
import { brancheUitSbi } from '../../shared/leadGenerator'
import { schatDuur, verdeelOverBlok, volgendVastBlok } from '../../shared/belblokken'
import type { Regio } from '../../shared/gebieden'
import type { gebruikDb } from './db'
import { leesStand } from './vvProjectie'
import { blokkenVan, hangAanBlok, laadBelKandidaten, sessieOp, type Kandidaat } from './bellen'
import { maak, soorten, voorbereid } from './campagnes'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
/** Postgres geeft '2026-10-15 15:53:32.883+00'; altijd als ISO verder. */
const isoVan = (v: unknown) => (v instanceof Date ? v : new Date(String(v).replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'))).toISOString()
const fout = (s: number, m: string): never => { throw createError({ statusCode: s, statusMessage: m }) }

export type RadarReikwijdte = 'mij' | 'org'
export interface RadarGebruiker { id: string; rol: string; werkplek?: string | null; data?: any }
const MANAGER = ['salesmanager', 'beheerder']

/** Wat "mij" betekent: de regio's waar je eigenaar van bent, anders je team (manager), anders je eigen accounts. */
async function reikwijdte(tx: Tx, g: RadarGebruiker, r: RadarReikwijdte): Promise<{ label: string; mijLabel: string; filter: ReturnType<typeof sql> }> {
  const [inst] = await rijen(tx, sql`select value from org_settings where key = 'gebieden'`)
  const regios = ((inst?.value ?? []) as Regio[]).filter((x) => [...(x.eigenaren?.binnendienst ?? []), ...(x.eigenaren?.buitendienst ?? [])].includes(g.id))
  let mijLabel: string
  let mij: ReturnType<typeof sql>
  if (regios.length) {
    mijLabel = 'Mijn regio'
    mij = sql`a.gebied_id = any(string_to_array(${regios.map((x) => x.id).join(',')}, ','))`
  } else if (MANAGER.includes(g.rol)) {
    const leden = (await rijen(tx, sql`select u.id from users u join teams t on t.id = u.team_id where ${g.id} = any(t.manager_ids)`)).map((x) => x.id as string)
    mijLabel = 'Mijn team'
    mij = sql`a.owner_id = any(string_to_array(${[g.id, ...leden].join(',')}, ','))`
  } else {
    mijLabel = 'Mijn accounts'
    mij = sql`a.owner_id = ${g.id}`
  }
  return r === 'org' ? { label: 'Hele organisatie', mijLabel, filter: sql`true` } : { label: mijLabel, mijLabel, filter: mij }
}

interface Geladen { signalen: (RadarSignaal & { titel: string; bronNaam: string | null; url: string | null })[]; accounts: Map<string, { naam: string; eigenaarId: string | null; eigenaar: string | null }> }

/** De telbare inzichten van de laatste zeven perioden met branche en soort. */
async function laad(tx: Tx, filter: ReturnType<typeof sql>, mapping: { brancheId: string; sbiCodes: string[]; trefwoorden: string[] }[], branches: Set<string>, nu: Date): Promise<Geladen> {
  const vanaf = new Date(nu.getTime() - (RADAR.perioden + 1) * RADAR.periodeDagen * 864e5).toISOString()
  const rs = await rijen(tx, sql`select s.id, s.account_id, s.type, s.title, s.bron, s.agent, s.status, s.signaalsoort, s.data->>'waarom' as waarom, s.data->'bron'->>'naam' as bron_naam, s.data->'bron'->>'url' as bron_url, s.created_at,
      a.name, a.owner_id, u.name as eigenaar, a.vv_branche_id, a.data->'sbi' as sbi
    from signals s join accounts a on a.id = s.account_id left join users u on u.id = a.owner_id
    where s.created_at >= ${vanaf} and ${filter}`)
  const accounts: Geladen['accounts'] = new Map()
  const signalen: Geladen['signalen'] = []
  for (const r of rs) {
    if (!telbaar({ bron: r.bron, agent: r.agent, status: r.status })) continue
    const sbi = Array.isArray(r.sbi) ? r.sbi.map(String) : []
    const br = r.vv_branche_id ?? brancheUitSbi(sbi, mapping, r.name)
    accounts.set(r.account_id, { naam: r.name, eigenaarId: r.owner_id ?? null, eigenaar: r.eigenaar ?? null })
    signalen.push({
      id: r.id, accountId: r.account_id, brancheId: br && branches.has(br) ? br : null, soort: signaalsoortVan({ signaalsoort: r.signaalsoort, type: r.type, title: r.title, waarom: r.waarom }),
      createdAt: isoVan(r.created_at), titel: r.title, bronNaam: r.bron_naam ?? null, url: r.bron_url ?? null,
    })
  }
  return { signalen, accounts }
}

const celUit = (c: Cel) => ({ brancheId: c.brancheId, soort: c.soort, aantal: c.aantal, signalen: c.signalen, normaal: Math.round(c.normaal * 10) / 10, factor: c.oordeel.factor === null ? null : Math.round(c.oordeel.factor * 10) / 10, niveau: c.oordeel.niveau, golf: c.oordeel.golf })

/** Het raster: rijen (branches), kolommen (signaalsoorten) en per cel aantal, normaal en oordeel. */
export async function radarRaster(tx: Tx, g: RadarGebruiker, r: RadarReikwijdte, nu = new Date()) {
  const stand = await leesStand(tx)
  const branches = (stand.branches ?? []).map((b) => ({ id: b.id, naam: b.naam }))
  const rw = await reikwijdte(tx, g, r)
  const { signalen } = await laad(tx, rw.filter, stand.brancheMapping ?? [], new Set(branches.map((b) => b.id)), nu)
  const cellen = telCellen(signalen, nu)
  const rijenUit: { id: string | null; naam: string }[] = [...branches]
  if ([...cellen.values()].some((c) => c.brancheId === null && c.aantal > 0)) rijenUit.push({ id: null, naam: 'Zonder branche' })
  const alle = rijenUit.flatMap((b) => SIGNAALSOORTEN.map((s) => cellen.get(celSleutel(b.id, s)) ?? legeCel(b.id, s)))
  const golven = alle.filter((c) => c.oordeel.golf).sort((a, b) => (b.oordeel.factor ?? 99) - (a.oordeel.factor ?? 99) || b.aantal - a.aantal)
  const recent = signalen.filter((s) => (nu.getTime() - Date.parse(s.createdAt)) / 864e5 < RADAR.periodeDagen)
  return {
    reikwijdte: r, label: rw.label, mijLabel: rw.mijLabel,
    rijen: rijenUit, kolommen: SIGNAALSOORTEN.map((s) => ({ sleutel: s, label: SOORT_INFO[s].label, kort: SOORT_INFO[s].kort })),
    cellen: alle.map(celUit), golven: golven.map((c) => ({ ...celUit(c), titel: celTitel(c, rijenUit) })),
    signalen: recent.length, accounts: new Set(recent.map((s) => s.accountId)).size,
    leeg: !signalen.length, zonderBranches: !branches.length,
  }
}

const brancheNaam = (id: string | null, rijenUit: { id: string | null; naam: string }[]) => rijenUit.find((b) => b.id === id)?.naam ?? 'Zonder branche'
const celTitel = (c: Pick<Cel, 'aantal' | 'soort' | 'brancheId'>, rijenUit: { id: string | null; naam: string }[]) => `${c.aantal} ${c.aantal === 1 ? 'account' : 'accounts'} in ${brancheNaam(c.brancheId, rijenUit)} ${SOORT_INFO[c.soort].zin}.`

/** Plekken en bezette plekken in de komende twee weken voor de gebruiker. */
async function capaciteit(tx: Tx, g: RadarGebruiker, nu: Date) {
  const [u] = await rijen(tx, sql`select werkplek, data from users where id = ${g.id}`)
  const [wd] = await rijen(tx, sql`select value from org_settings where key = 'werkdagen'`)
  const { blokken } = blokkenVan(u ?? {})
  const { plekken } = plekkenInBlokken(blokken, nu, 14, (wd?.value ?? {}) as any)
  const tot = new Date(nu.getTime() + 14 * 864e5).toISOString()
  const [b] = await rijen(tx, sql`select count(*)::int as n from tasks t join belblok_sessies s on s.id = t.belblok_id
    where s.gebruiker_id = ${g.id} and s.status = 'gepland' and s.start_op >= ${nu.toISOString()} and s.start_op < ${tot} and t.status in ('open', 'bezig')`)
  return { plekken, bezet: Number(b?.n ?? 0), blokken, werkdagen: (wd?.value ?? {}) as any }
}

export function leesRadarCel(q: Record<string, any>): { reikwijdte: RadarReikwijdte; brancheId: string | null; soort: Signaalsoort } {
  const soort = String(q.soort ?? '')
  if (!(SIGNAALSOORTEN as readonly string[]).includes(soort)) fout(422, 'Kies een signaalsoort')
  const branche = String(q.branche ?? '')
  return { reikwijdte: q.reikwijdte === 'org' ? 'org' : 'mij', brancheId: branche && branche !== 'zonder' ? branche : null, soort: soort as Signaalsoort }
}

/** Een cel met de accounts, het oordeel, het winpunt en de capaciteit. */
export async function radarCel(tx: Tx, g: RadarGebruiker, p: { reikwijdte: RadarReikwijdte; brancheId: string | null; soort: Signaalsoort }, rechten: { belronde: boolean; belblok: boolean }, nu = new Date()) {
  const stand = await leesStand(tx)
  const branches = (stand.branches ?? []).map((b) => ({ id: b.id as string | null, naam: b.naam }))
  if (p.brancheId && !branches.some((b) => b.id === p.brancheId)) fout(404, 'Deze branche staat niet in het verkoopverhaal')
  const rw = await reikwijdte(tx, g, p.reikwijdte)
  const { signalen, accounts } = await laad(tx, rw.filter, stand.brancheMapping ?? [], new Set(branches.map((b) => b.id!)), nu)
  const c = telCellen(signalen, nu).get(celSleutel(p.brancheId, p.soort)) ?? legeCel(p.brancheId, p.soort)
  const recent = signalen.filter((s) => s.brancheId === p.brancheId && s.soort === p.soort && (nu.getTime() - Date.parse(s.createdAt)) / 864e5 < RADAR.periodeDagen)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const lijst = c.accountIds.map((id) => {
    const a = accounts.get(id)!
    const s = recent.find((x) => x.accountId === id)!
    return { id, naam: a.naam, eigenaar: a.eigenaar, eigen: a.eigenaarId === g.id, signaal: { titel: s.titel, op: s.createdAt, bron: s.bronNaam, url: s.url }, signalen: recent.filter((x) => x.accountId === id).length }
  }).sort((a, b) => Number(b.eigen) - Number(a.eigen) || b.signaal.op.localeCompare(a.signaal.op))
  const wb = (await rijen(tx, sql`select winpunt_id, branche_id from vv_winpunt_branche`)).map((r) => ({ winpuntId: r.winpunt_id as string, brancheId: r.branche_id as string }))
  const wp = winpuntVoorGolf(p.soort, p.brancheId, stand.winpunten ?? [], wb)
  const eigen = lijst.filter((a) => a.eigen).length
  const cap = await capaciteit(tx, g, nu)
  const capTekst = capaciteitTekst({ eigen, collegas: lijst.length - eigen, plekken: cap.plekken, bezet: cap.bezet })
  const mag = MANAGER.includes(g.rol)
  const inRonde = mag ? lijst.length : eigen
  const oordeel = golfOordeel(c.aantal, c.normaal)
  const rijenUit = [...branches, { id: null, naam: 'Zonder branche' }]
  return {
    reikwijdte: p.reikwijdte, label: rw.label, brancheId: p.brancheId, brancheNaam: brancheNaam(p.brancheId, rijenUit), soort: p.soort, soortLabel: SOORT_INFO[p.soort].label,
    titel: celTitel(c, rijenUit), haak: SOORT_INFO[p.soort].haak, aantal: c.aantal, signalen: c.signalen, normaal: Math.round(c.normaal * 10) / 10, perPeriode: c.perPeriode,
    golf: oordeel.golf, factor: oordeel.factor === null ? null : Math.round(oordeel.factor * 10) / 10, niveau: oordeel.niveau, reden: oordeel.reden,
    accounts: lijst,
    winpunt: wp.winpunt ? { id: wp.winpunt.id, titel: wp.winpunt.titel, omschrijving: wp.winpunt.omschrijving, reden: wp.reden } : null,
    capaciteit: { ...capTekst, eigen, collegas: lijst.length - eigen, plekken: cap.plekken, bezet: cap.bezet },
    acties: {
      belronde: !rechten.belronde ? { ok: false, reden: 'Campagnes maken staat voor jou nog niet aan.' }
        : !oordeel.golf ? { ok: false, reden: 'Alleen bij een golf.' }
          : !p.brancheId ? { ok: false, reden: 'Geef deze accounts eerst een branche; een belronde hoort bij een branche.' }
            : !inRonde ? { ok: false, reden: 'Geen van deze accounts staat op jouw naam. Vraag je salesmanager om de belronde.' }
              : { ok: true, reden: `${inRonde} ${inRonde === 1 ? 'account' : 'accounts'} als campagneconcept${wp.winpunt ? ` met het winpunt ${wp.winpunt.titel}` : ''}.` },
      belblok: !rechten.belblok ? { ok: false, reden: 'Belblokken staan voor jou nog niet aan.' }
        : !oordeel.golf ? { ok: false, reden: 'Alleen bij een golf.' }
          : !eigen ? { ok: false, reden: 'Geen van deze accounts staat op jouw naam.' }
            : !cap.plekken ? { ok: false, reden: 'Je hebt geen vast belblok voor koude acquisitie.' }
              : { ok: true, reden: `${eigen} ${eigen === 1 ? 'account' : 'accounts'} in je volgende belblok.` },
    },
  }
}

/** Start belronde: een campagneconcept (koude belcampagne) met de accounts uit de golf en het winpunt. */
export async function radarBelronde(tx: Tx, org: string, g: RadarGebruiker & { naam?: string }, p: { reikwijdte: RadarReikwijdte; brancheId: string | null; soort: Signaalsoort }, nu = new Date()) {
  const c = await radarCel(tx, g, p, { belronde: true, belblok: true }, nu)
  if (!c.acties.belronde.ok) fout(409, c.acties.belronde.reden)
  const ids = c.accounts.filter((a) => MANAGER.includes(g.rol) || a.eigen).map((a) => a.id)
  const alleSoorten = (await soorten(tx)).filter((s) => s.actief)
  const soort = alleSoorten.find((s) => s.sleutel === 'koude-belcampagne') ?? alleSoorten.find((s) => s.startsoort && s.kanalen.includes('bellen'))
  if (!soort) fout(409, 'Er is geen campagnesoort om te bellen. Vraag je beheerder.')
  const inv = { naam: `Belronde ${c.soortLabel.toLowerCase()} · ${c.brancheNaam}`, bron: { soort: 'vrij' as const, accountIds: ids }, brancheId: p.brancheId, soort: soort!.sleutel, winpuntId: c.winpunt?.id ?? null, eigenaarId: g.id }
  const v = await voorbereid(tx, g, inv, nu)
  if (!v.mee.length) fout(409, `Geen van deze accounts kan mee: ${v.overgeslagen.slice(0, 3).map((o) => `${o.naam} (${o.reden})`).join(', ')}`)
  const r = await maak(tx, org, g, inv, nu)
  return { id: r.id, accounts: r.accounts, overgeslagen: v.overgeslagen.length, winpunt: c.winpunt?.titel ?? null, toast: `Campagneconcept gemaakt met ${r.accounts} ${r.accounts === 1 ? 'account' : 'accounts'}${v.overgeslagen.length ? `; ${v.overgeslagen.length} overgeslagen` : ''}.` }
}

/** Zet in belblok: je eigen accounts uit de golf in je volgende vaste belblok; wat niet past, in het blok daarna. */
export async function radarInBelblok(tx: Tx, org: string, g: RadarGebruiker, p: { reikwijdte: RadarReikwijdte; brancheId: string | null; soort: Signaalsoort }, nu = new Date()) {
  const c = await radarCel(tx, g, p, { belronde: true, belblok: true }, nu)
  if (!c.acties.belblok.ok) fout(409, c.acties.belblok.reden)
  const cap = await capaciteit(tx, g, nu)
  const koud = cap.blokken.filter((b) => b.soort !== 'opvolging')
  const eerste = volgendVastBlok(koud, nu, cap.werkdagen)
  if (!eerste) fout(409, 'Je hebt de komende twee weken geen vast belblok voor koude acquisitie.')
  const bestaand = new Map((await laadBelKandidaten(tx, g.id)).map((k) => [k.accountId, k]))
  const eigen = c.accounts.filter((a) => a.eigen)
  const contacten = new Map((await rijen(tx, sql`select distinct on (account_id) account_id, id from contacts where account_id = any(string_to_array(${eigen.map((a) => a.id).join(',')}, ',')) and status <> 'vertrokken' order by account_id, (rol = 'beslisser') desc, created_at`)).map((r) => [r.account_id as string, r.id as string]))
  const reden = `Signaalradar: ${c.soortLabel.toLowerCase()} in ${c.brancheNaam}`
  let alIngepland = 0
  const kandidaten: (Kandidaat & { duur: number })[] = []
  for (const a of eigen) {
    const k = bestaand.get(a.id)
    if (k?.belblokId) { alIngepland++; continue }
    const basis: Kandidaat = k ?? { accountId: a.id, accountNaam: a.naam, contactId: contacten.get(a.id) ?? null, taskId: null, score: 50, herkomst: 'koud', reden, aanleidingen: a.signalen }
    kandidaten.push({ ...basis, duur: schatDuur(basis) })
  }
  if (!kandidaten.length) return { inBlok: 0, geschoven: 0, alIngepland, toast: `Deze accounts staan al in een belblok.` }
  const e = eerste!
  const eind = new Date(e.start.getTime() + e.blok.minuten * 60_000)
  const tweede = volgendVastBlok(koud, eind, cap.werkdagen)
  const v = verdeelOverBlok(kandidaten, e.blok.minuten, tweede ? { label: tweede.label, start: tweede.start.toISOString() } : null)
  const s = await sessieOp(tx, org, g.id, e.start.toISOString(), eind.toISOString(), { plek: e.blok.plek, soort: e.blok.soort, verhouding: e.blok.verhouding, scriptId: e.blok.scriptId ?? null, gesprekken: [] }, e.blok.id)
  if (s.status !== 'gepland') fout(409, 'Je volgende belblok loopt al. Probeer het na het blok opnieuw.')
  await hangAanBlok(tx, org, g.id, s.id, e.start.toISOString(), v.inBlok)
  if (tweede && v.geschoven.length) {
    const s2 = await sessieOp(tx, org, g.id, tweede.start.toISOString(), new Date(tweede.start.getTime() + tweede.blok.minuten * 60_000).toISOString(), { plek: tweede.blok.plek, soort: tweede.blok.soort, verhouding: tweede.blok.verhouding, scriptId: tweede.blok.scriptId ?? null, gesprekken: [] }, tweede.blok.id)
    if (s2.status === 'gepland') await hangAanBlok(tx, org, g.id, s2.id, tweede.start.toISOString(), v.geschoven)
  }
  const n = v.inBlok.length
  const toast = `${n} ${n === 1 ? 'account' : 'accounts'} in je belblok van ${e.label}${v.geschoven.length && tweede ? `, ${v.geschoven.length} naar ${tweede.label}` : v.inLijst.length ? `, ${v.inLijst.length} pasten niet` : ''}${alIngepland ? `; ${alIngepland} stonden al in een belblok` : ''}.`
  return { sessieId: s.id, inBlok: n, geschoven: tweede ? v.geschoven.length : 0, alIngepland, toast }
}
