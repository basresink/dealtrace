// Filters en tellers voor de prospect- en klantlijst (F03). Tellers rekenen mee
// met alle andere actieve filters; binnen een groep is het "of".
import { normaliseerNaam } from './ontdubbelen'
import { leesActiefFilter, pastBijActief, type ActiefFilter } from './deactiveren'

export interface AccountRij {
  id: string
  name: string
  city?: string | null
  klasse: string | null
  ownerId: string | null
  ownerTeamId?: string | null
  nbStatus: string
  score: number
  aanleiding?: { tekst: string; heet?: boolean; op: string } | null
  laatsteContactOp: string | null
  faseSinds?: string | null
  faseId?: string | null
  reisId?: string | null
  contacten: { rol: string; status: string; telefoon?: string | null; mobiel?: string | null; email?: string | null }[]
  cf: Record<string, unknown>
  telefoon?: string | null
  email?: string | null
  /** 0064: gedeactiveerd; standaard niet in de lijst. */
  gedeactiveerd?: boolean
}

export interface Filters {
  q?: string
  /** Status actief, gedeactiveerd of alle (0064); zonder waarde alleen actieve accounts. */
  actief?: ActiefFilter
  eigenaar?: 'mij' | 'team' | 'iedereen'
  status?: string[]
  /** Reis en fase (P05): fase-id's. */
  fase?: string[]
  klasse?: string[]
  aanleiding?: string[]
  laatsteContact?: string[]
  bereikbaarheid?: string[]
  /** cf.<sleutel> → waarden (keuzelijst, janee als 'ja'/'nee'). */
  cf?: Record<string, string[]>
}

export interface FilterContext { gebruikerId: string; teamIds: string[]; nu: Date }

type Groep = 'status' | 'fase' | 'klasse' | 'aanleiding' | 'laatsteContact' | 'bereikbaarheid'
const DAG = 24 * 3600 * 1000

function voldoetWaarde(a: AccountRij, groep: Groep | `cf.${string}`, w: string, ctx: FilterContext): boolean {
  if (groep.startsWith('cf.')) {
    const v = a.cf[groep.slice(3)]
    if (Array.isArray(v)) return v.map(String).includes(w)
    if (typeof v === 'boolean') return (v ? 'ja' : 'nee') === w
    return v !== undefined && v !== null && String(v) === w
  }
  switch (groep) {
    case 'status': return a.nbStatus === w
    case 'fase': return a.faseId === w
    case 'klasse': return w === 'geen' ? !a.klasse : a.klasse === w
    case 'aanleiding': return w === 'met' ? !!a.aanleiding : true
    case 'laatsteContact': {
      if (w === 'nooit') return !a.laatsteContactOp
      const d = a.laatsteContactOp ? (ctx.nu.getTime() - Date.parse(a.laatsteContactOp)) / DAG : Infinity
      return w === '30' ? d > 30 : w === '90' ? d > 90 : true
    }
    case 'bereikbaarheid': {
      const actief = a.contacten.filter((c) => c.status !== 'vertrokken')
      if (w === 'zonderTelefoon') return !a.telefoon && !actief.some((c) => c.telefoon || c.mobiel)
      if (w === 'zonderEmail') return !a.email && !actief.some((c) => c.email)
      if (w === 'zonderBeslisser') return !actief.some((c) => c.rol === 'beslisser')
      return true
    }
  }
  return true
}

function groepen(f: Filters): [Groep | `cf.${string}`, string[]][] {
  const g: [Groep | `cf.${string}`, string[]][] = []
  for (const k of ['status', 'fase', 'klasse', 'aanleiding', 'laatsteContact', 'bereikbaarheid'] as Groep[]) if (f[k]?.length) g.push([k, f[k]!])
  for (const [k, v] of Object.entries(f.cf ?? {})) if (v.length) g.push([`cf.${k}`, v])
  return g
}

function basis(a: AccountRij, f: Filters, ctx: FilterContext): boolean {
  if (!pastBijActief(!!a.gedeactiveerd, f.actief ?? 'actief')) return false
  if (f.q) {
    const q = normaliseerNaam(f.q)
    if (!normaliseerNaam(`${a.name} ${a.city ?? ''}`).includes(q)) return false
  }
  const e = f.eigenaar ?? 'mij'
  if (e === 'mij' && a.ownerId !== ctx.gebruikerId) return false
  if (e === 'team' && a.ownerId !== ctx.gebruikerId && !(a.ownerTeamId && ctx.teamIds.includes(a.ownerTeamId))) return false
  return true
}

/**
 * Bereikbaarheid is een "en"-groep (zonder telefoon én zonder e-mail is strenger);
 * de andere groepen zijn "of" binnen de groep.
 */
function voldoetGroep(a: AccountRij, groep: Groep | `cf.${string}`, waarden: string[], ctx: FilterContext) {
  return groep === 'bereikbaarheid' ? waarden.every((w) => voldoetWaarde(a, groep, w, ctx)) : waarden.some((w) => voldoetWaarde(a, groep, w, ctx))
}

export function pasFiltersToe(rijen: AccountRij[], f: Filters, ctx: FilterContext): AccountRij[] {
  const g = groepen(f)
  return rijen.filter((a) => basis(a, f, ctx) && g.every(([k, w]) => voldoetGroep(a, k, w, ctx)))
}

/**
 * Teller per pilwaarde: het aantal rijen dat je krijgt als je die pil aanklikt,
 * met alle andere actieve filters. Voor een "of"-groep: de andere groepen plus
 * deze ene waarde; voor bereikbaarheid ("en"): de huidige waarden plus deze.
 */
export function filterTellers(rijen: AccountRij[], f: Filters, ctx: FilterContext, mogelijk: Record<string, string[]>): Record<string, Record<string, number>> {
  const uit: Record<string, Record<string, number>> = {}
  const actief = groepen(f)
  const kandidaten = rijen.filter((a) => basis(a, f, ctx))
  for (const [groep, waarden] of Object.entries(mogelijk)) {
    const anderen = actief.filter(([k]) => k !== groep)
    const huidig = actief.find(([k]) => k === groep)?.[1] ?? []
    const pool = kandidaten.filter((a) => anderen.every(([k, w]) => voldoetGroep(a, k, w, ctx)))
    uit[groep] = {}
    for (const w of waarden) {
      uit[groep]![w] = groep === 'bereikbaarheid'
        ? pool.filter((a) => voldoetGroep(a, groep as Groep, [...new Set([...huidig, w])], ctx)).length
        : pool.filter((a) => voldoetWaarde(a, groep as Groep, w, ctx)).length
    }
  }
  return uit
}

export type Sortering = 'naam' | 'laatsteContact' | 'score' | 'klasse' | 'dagenInFase'
export function sorteer(rijen: AccountRij[], s: Sortering = 'score', klasseVolgorde: string[] = []): AccountRij[] {
  const r = [...rijen]
  const t = (x: string | null | undefined) => (x ? Date.parse(x) : 0)
  switch (s) {
    case 'naam': return r.sort((a, b) => a.name.localeCompare(b.name, 'nl'))
    case 'laatsteContact': return r.sort((a, b) => t(b.laatsteContactOp) - t(a.laatsteContactOp))
    case 'klasse': return r.sort((a, b) => (klasseVolgorde.indexOf(a.klasse ?? '') + 1 || 999) - (klasseVolgorde.indexOf(b.klasse ?? '') + 1 || 999) || a.name.localeCompare(b.name, 'nl'))
    case 'dagenInFase': return r.sort((a, b) => t(a.faseSinds) - t(b.faseSinds))
    default: return r.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'nl'))
  }
}

/** Filters naar en van de URL (filters en sortering overleven herladen). */
export function filtersUitQuery(q: Record<string, unknown>): Filters {
  const lijst = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []).map(String).filter(Boolean)
  const f: Filters = {
    q: typeof q.q === 'string' ? q.q : undefined,
    actief: leesActiefFilter(q.actief),
    eigenaar: (['mij', 'team', 'iedereen'] as const).find((e) => e === q.eigenaar) ?? 'mij',
    status: lijst(q.status), fase: lijst(q.fase), klasse: lijst(q.klasse), aanleiding: lijst(q.aanleiding),
    laatsteContact: lijst(q.laatsteContact), bereikbaarheid: lijst(q.bereikbaarheid), cf: {},
  }
  for (const [k, v] of Object.entries(q)) if (k.startsWith('cf.')) f.cf![k.slice(3)] = lijst(v)
  return f
}

export function filtersNaarQuery(f: Filters): Record<string, string> {
  const q: Record<string, string> = {}
  if (f.q) q.q = f.q
  if (f.actief && f.actief !== 'actief') q.actief = f.actief
  if (f.eigenaar && f.eigenaar !== 'mij') q.eigenaar = f.eigenaar
  for (const k of ['status', 'fase', 'klasse', 'aanleiding', 'laatsteContact', 'bereikbaarheid'] as const) if (f[k]?.length) q[k] = f[k]!.join(',')
  for (const [k, v] of Object.entries(f.cf ?? {})) if (v.length) q[`cf.${k}`] = v.join(',')
  return q
}

/** Tellers voor het filter Status (actief, gedeactiveerd, alle), met alle andere filters erop. */
export function actiefTellers(rijen: AccountRij[], f: Filters, ctx: FilterContext): Record<ActiefFilter, number> {
  const tel = (actief: ActiefFilter) => pasFiltersToe(rijen, { ...f, actief }, ctx).length
  return { actief: tel('actief'), gedeactiveerd: tel('gedeactiveerd'), alle: tel('alle') }
}
