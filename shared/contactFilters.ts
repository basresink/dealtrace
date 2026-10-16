// Filters, tellers en sortering van de contactlijst (/contacten/alle). Eén plek voor
// de server (lijst en export) en de tests. Tellers rekenen mee met alle andere actieve
// filters, net als bij accounts (shared/accountFilters.ts).
import { ROLLEN_CONTACT } from './contactgegevens'

export interface ContactFilterRij {
  id: string
  naam: string
  functie: string | null
  bedrijf: string
  rol: string
  soort: string | null | undefined
  eigenaarId: string | null | undefined
  email: string | null
  telefoon: string | null
  mobiel: string | null
  belMeNiet: boolean
  consent: { email?: { status?: string } }
  laatsteContactOp: string | null
  laatsteActiviteitOp?: string | null
}

export interface ContactFilters {
  q: string
  rol: string[]
  soort: string[]
  /** true: alleen contacten bij je eigen accounts ("Van mijn accounts"). */
  mijn: boolean
  bereikbaarheid: string[]
  laatsteContact: string[]
  toestemming: string[]
}

export type ContactGroep = 'rol' | 'soort' | 'bereikbaarheid' | 'laatsteContact' | 'toestemming'
export const CONTACT_SORTERINGEN = ['rol', 'naam', 'bedrijf', 'laatsteContact'] as const
export type ContactSortering = typeof CONTACT_SORTERINGEN[number]

const SOORTEN = ['prospect', 'klant']
const BEREIK = ['zonderEmail', 'zonderTelefoon']
const CONTACT = ['30', '90']
const TOESTEMMING = ['belMeNiet', 'geenMail']
const DAG = 864e5

const lijst = (v: unknown, mag: readonly string[]) => (typeof v === 'string' && v ? v.split(',').filter((w) => mag.includes(w)) : [])

/** Normaliseer voor zoeken: kleine letters, zonder accenten. */
export const zoekVorm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Filters uit de query. Oude parameters blijven werken: `zonderEmail=1`, `zonderTelefoon=1`
 * en `geenContact=30|90` tellen als bereikbaarheid en laatste contact; `mijn=0` is iedereen.
 */
export function contactFiltersUitQuery(q: Record<string, unknown>): ContactFilters {
  const bereik = lijst(q.bereikbaarheid, BEREIK)
  if (q.zonderEmail === '1' && !bereik.includes('zonderEmail')) bereik.push('zonderEmail')
  if (q.zonderTelefoon === '1' && !bereik.includes('zonderTelefoon')) bereik.push('zonderTelefoon')
  const contact = lijst(q.laatsteContact, CONTACT)
  if (typeof q.geenContact === 'string' && CONTACT.includes(q.geenContact) && !contact.includes(q.geenContact)) contact.push(q.geenContact)
  return {
    q: typeof q.q === 'string' ? q.q.trim() : '',
    rol: lijst(q.rol, ROLLEN_CONTACT),
    soort: lijst(q.soort, SOORTEN),
    mijn: (q.mijn ?? '1') !== '0',
    bereikbaarheid: bereik,
    laatsteContact: contact,
    toestemming: lijst(q.toestemming, TOESTEMMING),
  }
}

function past(c: ContactFilterRij, groep: ContactGroep, waarde: string, nu: number): boolean {
  switch (groep) {
    case 'rol': return c.rol === waarde
    case 'soort': return c.soort === waarde
    case 'bereikbaarheid': return waarde === 'zonderEmail' ? !c.email : !c.telefoon && !c.mobiel
    case 'laatsteContact': return !c.laatsteContactOp || nu - Date.parse(c.laatsteContactOp) > Number(waarde) * DAG
    case 'toestemming': return waarde === 'belMeNiet' ? c.belMeNiet : c.consent?.email?.status === 'nee'
  }
}

/** Binnen een groep is het "of", tussen groepen "en". `zonder` laat één groep weg (voor de tellers). */
export function pasContactFiltersToe<T extends ContactFilterRij>(rijen: T[], f: ContactFilters, ctx: { gebruikerId: string; nu?: Date }, zonder?: ContactGroep): T[] {
  const nu = (ctx.nu ?? new Date()).getTime()
  const term = f.q ? zoekVorm(f.q) : ''
  const groepen: [ContactGroep, string[]][] = [['rol', f.rol], ['soort', f.soort], ['bereikbaarheid', f.bereikbaarheid], ['laatsteContact', f.laatsteContact], ['toestemming', f.toestemming]]
  return rijen.filter((c) => {
    if (f.mijn && c.eigenaarId !== ctx.gebruikerId) return false
    if (term && !zoekVorm(`${c.naam} ${c.functie ?? ''} ${c.bedrijf}`).includes(term)) return false
    // Binnen bereikbaarheid en laatste contact moeten alle gekozen voorwaarden kloppen (zoals de oude losse filters).
    for (const [g, w] of groepen) {
      if (g === zonder || !w.length) continue
      if (g === 'bereikbaarheid' || g === 'laatsteContact') { if (!w.every((x) => past(c, g, x, nu))) return false }
      else if (!w.some((x) => past(c, g, x, nu))) return false
    }
    return true
  })
}

/** Teller per filterwaarde, met alle andere actieve filters erop. */
export function contactTellers(rijen: ContactFilterRij[], f: ContactFilters, ctx: { gebruikerId: string; nu?: Date }): Record<ContactGroep, Record<string, number>> {
  const nu = (ctx.nu ?? new Date()).getTime()
  const mogelijk: Record<ContactGroep, readonly string[]> = { rol: ROLLEN_CONTACT, soort: SOORTEN, bereikbaarheid: BEREIK, laatsteContact: CONTACT, toestemming: TOESTEMMING }
  const uit = {} as Record<ContactGroep, Record<string, number>>
  for (const g of Object.keys(mogelijk) as ContactGroep[]) {
    // Bij "en"-groepen telt de teller met de andere gekozen waarden van dezelfde groep erbij.
    const basis = pasContactFiltersToe(rijen, g === 'bereikbaarheid' || g === 'laatsteContact' ? { ...f, [g]: [] } : f, ctx, g)
    uit[g] = Object.fromEntries(mogelijk[g].map((w) => {
      const anderen = (g === 'bereikbaarheid' || g === 'laatsteContact') ? (f[g] as string[]).filter((x) => x !== w) : []
      return [w, basis.filter((c) => past(c, g, w, nu) && anderen.every((x) => past(c, g, x, nu))).length]
    }))
  }
  return uit
}

/** Sortering: rol (beslissers eerst, dan naam), naam, bedrijf of laatste activiteit (recentste eerst). */
export function sorteerContacten<T extends ContactFilterRij>(rijen: T[], sort: string): T[] {
  const volgorde = ROLLEN_CONTACT as readonly string[]
  const r = [...rijen]
  const opNaam = (a: T, b: T) => a.naam.localeCompare(b.naam, 'nl')
  if (sort === 'naam') return r.sort(opNaam)
  if (sort === 'bedrijf') return r.sort((a, b) => a.bedrijf.localeCompare(b.bedrijf, 'nl') || volgorde.indexOf(a.rol) - volgorde.indexOf(b.rol) || opNaam(a, b))
  if (sort === 'laatsteContact') {
    const t = (c: T) => c.laatsteActiviteitOp ?? c.laatsteContactOp ?? ''
    return r.sort((a, b) => t(b).localeCompare(t(a)) || opNaam(a, b))
  }
  return r.sort((a, b) => volgorde.indexOf(a.rol) - volgorde.indexOf(b.rol) || opNaam(a, b))
}

/** Aantal actieve filterwaarden (voor de teller op de knop Filters); "Iedereen" telt als één. */
export function aantalActieveContactFilters(f: ContactFilters): number {
  return f.rol.length + f.soort.length + f.bereikbaarheid.length + f.laatsteContact.length + f.toestemming.length + (f.mijn ? 0 : 1)
}
