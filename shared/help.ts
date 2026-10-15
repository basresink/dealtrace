// Helpcenter (F21): artikelen uit content/help/ inlezen, het artikel van een scherm,
// "Voor jou" en wat mee kan in het dagpakket. Geen leerpaden, geen voortgang (B19).
import { FUNCTIES } from './functies'

export interface HelpArtikel {
  id?: string
  slug: string
  titel: string
  categorie: string
  collectie: 'product' | 'newbusiness'
  samenvatting: string
  inhoud: string
  routes: string[]
  features: string[]
  niveau?: string | null
  organisationId?: string | null
  bijgewerktOp?: string
}

export const CATEGORIEEN_PRODUCT = ['Aan de slag', 'Dagelijks werk', 'Prospects', 'Plannen en sturen', 'Inrichten', 'Voor de salesmanager'] as const
export const CATEGORIEEN_NEWBUSINESS = ['Fundament', 'Voorbereiden', 'Bellen', 'Bezwaren', 'Schrijven', 'Op pad', 'Volhouden', 'Van afspraak naar overdracht', 'Jezelf verbeteren'] as const
/** "Aan de slag" op de startpagina: vijf vaste artikelen (F21). */
export const AAN_DE_SLAG = ['je-eerste-dag-in-dealtrace', 'vandaag-lezen-en-afronden', 'een-belblok-uitvoeren-met-een-script', 'een-afspraak-plannen-afronden-en-overdragen', 'waarom-vijf-pogingen-werken'] as const
export const FEEDBACK_REDENEN = ['Klopt niet', 'Onduidelijk', 'Mist iets', 'Anders'] as const

/** Leest een Markdown-artikel met frontmatter (titel, categorie, collectie, samenvatting, routes). */
export function leesArtikel(slug: string, bron: string): HelpArtikel {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(bron)
  const velden: Record<string, string> = {}
  for (const regel of (m?.[1] ?? '').split('\n')) {
    const i = regel.indexOf(': ')
    if (i > 0) velden[regel.slice(0, i).trim()] = regel.slice(i + 2).trim()
  }
  const inhoud = (m ? bron.slice(m[0].length) : bron).trim()
  return {
    slug, titel: velden.titel ?? slug, categorie: velden.categorie ?? 'Aan de slag', collectie: velden.collectie === 'newbusiness' ? 'newbusiness' : 'product',
    samenvatting: velden.samenvatting ?? '', inhoud, routes: (velden.routes ?? '').split(',').map((r) => r.trim()).filter(Boolean),
    features: FUNCTIES.filter((f) => f.helpartikel === slug).map((f) => f.sleutel),
    niveau: laagsteStartNiveau(slug),
  }
}

/** Het niveau waarop de eerste functie van dit artikel in de startindeling aangaat (alleen oriëntatie). */
function laagsteStartNiveau(slug: string): string | null {
  const n = FUNCTIES.filter((f) => f.helpartikel === slug).map((f) => f.startNiveau)
  for (const x of ['beginner', 'gevorderd', 'expert']) if (n.includes(x as any)) return x
  return null
}

/** Het helpartikel van een route: eerst een artikel dat de route noemt, anders het artikel van de zijbalkfunctie. */
export function artikelVoorRoute(route: string, artikelen: Pick<HelpArtikel, 'slug' | 'routes'>[]): string | null {
  const [pad, query = ''] = route.split('?')
  const kandidaten = [route, pad!]
  for (const k of kandidaten) {
    const a = artikelen.find((x) => x.routes.some((r) => r === k || (query && r === `${pad}?${query}`)))
    if (a) return a.slug
  }
  // Langste route die een voorvoegsel is (/accounts/123 → /accounts).
  let beste: { slug: string; lengte: number } | null = null
  for (const a of artikelen) for (const r of a.routes) {
    if (r !== '/' && !r.includes('?') && (pad === r || pad!.startsWith(`${r}/`)) && (!beste || r.length > beste.lengte)) beste = { slug: a.slug, lengte: r.length }
  }
  if (beste) return beste.slug
  const f = FUNCTIES.find((x) => x.zijbalk && (pad === x.zijbalk.route || (x.zijbalk.route !== '/' && pad!.startsWith(`${x.zijbalk.route}/`))))
  return f?.helpartikel || null
}

/** Gelezen na scrollen tot het einde; een kort artikel zonder scroll telt bij openen. */
export function isGelezen(scrollTop: number, zichtbaar: number, hoogte: number): boolean {
  if (hoogte <= zichtbaar + 4) return true
  return scrollTop + zichtbaar >= hoogte - 24
}

/**
 * "Voor jou": eerst de artikelen van functies die de laatste 7 dagen aangingen (pil "nieuw"),
 * daarna "Aan de slag" zolang niet alle vijf gelezen zijn, anders "Nieuw en bijgewerkt".
 */
export function voorJou(nieuweFuncties: string[], gelezen: Set<string>, artikelen: HelpArtikel[]): { nieuw: HelpArtikel[]; aanDeSlag: HelpArtikel[]; bijgewerkt: HelpArtikel[] } {
  const perSlug = new Map(artikelen.map((a) => [a.slug, a]))
  const nieuwSlugs = [...new Set(nieuweFuncties.map((s) => FUNCTIES.find((f) => f.sleutel === s)?.helpartikel).filter((s): s is string => !!s && perSlug.has(s)))]
  const aanDeSlag = AAN_DE_SLAG.map((s) => perSlug.get(s)).filter((a): a is HelpArtikel => !!a)
  const alleGelezen = aanDeSlag.every((a) => gelezen.has(a.slug))
  const bijgewerkt = [...artikelen].sort((a, b) => (b.bijgewerktOp ?? '').localeCompare(a.bijgewerktOp ?? '')).slice(0, 5)
  return { nieuw: nieuwSlugs.map((s) => perSlug.get(s)!), aanDeSlag: alleGelezen ? [] : aanDeSlag, bijgewerkt }
}

/** De artikelen die mee kunnen in het dagpakket: van functies die aanstaan, zonder verborgen artikelen. */
export function artikelenVoorDagpakket(functiesAan: string[], artikelen: Pick<HelpArtikel, 'slug' | 'features'>[], verborgen: string[] = []): string[] {
  const aan = new Set(functiesAan)
  const weg = new Set(verborgen)
  return artikelen.filter((a) => !weg.has(a.slug) && (a.features.length === 0 || a.features.some((f) => aan.has(f)))).map((a) => a.slug)
}

/** Zoekterm zoals de database hem vergelijkt: kleine letters, zonder accenten. */
export const zoekNormaal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
