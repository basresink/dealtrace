// Bewijsplicht en ouderdom (P19, 2.1, 11.2, 15.1): geen bewijs, geen inzicht. Een citaat telt alleen
// als het letterlijk in het materiaal staat; een URL alleen als hij in de echte zoekresultaten stond.
// Zachte grens: geen taakvoorstel; harde grens: het inzicht vervalt.
import { magBenaderen, type Kanaal } from './nbStatus'

export const BRONSOORTEN = ['vacature', 'nieuws', 'website'] as const
export type BronSoort = typeof BRONSOORTEN[number]
/** Ouderdom in dagen per bronsoort: [zacht, hard]. */
export const OUDERDOM: Record<BronSoort, [number, number]> = { vacature: [30, 120], nieuws: [90, 365], website: [30, 90] }

const DAG = 864e5
/** vers, zacht of hard. Precies op de grens telt nog als de lagere stand; een datum in de toekomst is vers; zonder datum hard. */
export function ouderdomStatus(soort: BronSoort, datum: string | null | undefined, nu: Date): 'vers' | 'zacht' | 'hard' {
  if (!datum || Number.isNaN(Date.parse(datum))) return 'hard'
  const dagen = Math.floor((nu.getTime() - Date.parse(datum)) / DAG)
  const [zacht, hard] = OUDERDOM[soort]
  return dagen > hard ? 'hard' : dagen > zacht ? 'zacht' : 'vers'
}

const norm = (t: string) => t.toLowerCase().replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim()
const normUrl = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[#?].*$/, '').replace(/\/+$/, '')

export interface Bewijsstuk { citaat: string; bron: string; datum?: string | null; url?: string | null }
/**
 * Klopt het bewijs? Elk citaat moet (na witruimte en hoofdletters) in het materiaal staan; elke URL in
 * de zoekresultaten (met of zonder slash aan het eind). Zonder één geldig bewijsstuk geen inzicht.
 */
export function valideerBewijs(oordeel: { evidence?: Bewijsstuk[] }, materiaal: string, zoekUrls: string[] | null): { geldig: boolean; redenen: string[] } {
  const ev = oordeel.evidence ?? []
  const redenen: string[] = []
  if (!ev.length) redenen.push('Geen bewijs')
  const m = norm(materiaal)
  const urls = new Set((zoekUrls ?? []).map(normUrl))
  for (const e of ev) {
    if (!e.citaat?.trim() || !m.includes(norm(e.citaat))) redenen.push('Citaat staat niet in het materiaal')
    if (e.url && zoekUrls && !urls.has(normUrl(e.url))) redenen.push('URL kwam niet uit de zoekresultaten')
  }
  return { geldig: !redenen.length, redenen: [...new Set(redenen)] }
}

/** Een taakvoorstel alleen bij zekerheid 60 of meer en een bron die niet zacht verlopen is. */
export function magTaakVoorstel(inzicht: { zekerheid: number; bronSoort?: BronSoort | null; bronDatum?: string | null }, nu: Date): boolean {
  if (inzicht.zekerheid < 60) return false
  return !inzicht.bronSoort || ouderdomStatus(inzicht.bronSoort, inzicht.bronDatum, nu) === 'vers'
}

/** Concurrentnamen in vrije tekst (F09, F25): heel woord, B.V. en hoofdletters doen niet ter zake. */
export function vindConcurrenten(tekst: string, concurrenten: { id: string; naam: string }[]): { id: string; naam: string; fragment: string }[] {
  const uit: { id: string; naam: string; fragment: string }[] = []
  for (const c of concurrenten) {
    const kern = c.naam.replace(/\s*\b(b\.?v\.?|n\.?v\.?)\s*$/i, '').trim()
    if (kern.length < 3) continue
    const esc = kern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const m = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu').exec(tekst)
    if (m) uit.push({ id: c.id, naam: c.naam, fragment: tekst.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).trim() })
  }
  return uit
}

/** Mag een trigger dit account terughalen? Alleen als de afkoelperiode voor dit kanaal voorbij is. */
export function heractivatieToegestaan(account: { nbStatus: string; data?: any }, kanaal: Kanaal, nu: Date): boolean {
  if (!['nee', 'wachtend'].includes(account.nbStatus)) return false
  return magBenaderen({ nbStatus: account.nbStatus, data: account.data ?? {} }, kanaal, nu).mag
}
