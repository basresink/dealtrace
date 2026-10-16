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
  /** Controlevragen (drie meerkeuzevragen), uit de sectie "## Controlevragen" van het Markdown-bestand. */
  vragen?: Controlevraag[]
}
export interface Controlevraag { vraag: string; opties: string[]; goed: number }

export const CATEGORIEEN_PRODUCT = ['Aan de slag', 'Dagelijks werk', 'Prospects', 'Plannen en sturen', 'Inrichten', 'Voor de salesmanager'] as const
export const CATEGORIEEN_NEWBUSINESS = ['Fundament', 'Voorbereiden', 'Bellen', 'Bezwaren', 'Schrijven', 'Op pad', 'Volhouden', 'Van afspraak naar overdracht', 'Jezelf verbeteren'] as const
/** "Aan de slag" op de startpagina: vijf vaste artikelen (F21). */
export const AAN_DE_SLAG = ['je-eerste-dag-in-dealtrace', 'vandaag-lezen-en-afronden', 'een-belblok-uitvoeren-met-een-script', 'een-afspraak-plannen-afronden-en-overdragen', 'waarom-vijf-pogingen-werken'] as const
export const FEEDBACK_REDENEN = ['Klopt niet', 'Onduidelijk', 'Mist iets', 'Anders'] as const

const ontquote = (t: string) => t.replace(/^"(.*)"$/, '$1')

/** Leest een Markdown-artikel met frontmatter (titel, categorie, collectie, samenvatting, routes). */
export function leesArtikel(slug: string, bron: string): HelpArtikel {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(bron)
  const velden: Record<string, string> = {}
  for (const regel of (m?.[1] ?? '').split('\n')) {
    const i = regel.indexOf(': ')
    if (i > 0) velden[regel.slice(0, i).trim()] = regel.slice(i + 2).trim()
  }
  const { inhoud, vragen } = haalControlevragen((m ? bron.slice(m[0].length) : bron).trim())
  return {
    slug, titel: ontquote(velden.titel ?? slug), categorie: velden.categorie ?? 'Aan de slag', collectie: velden.collectie === 'newbusiness' ? 'newbusiness' : 'product',
    samenvatting: ontquote(velden.samenvatting ?? ''), inhoud, routes: (velden.routes ?? '').split(',').map((r) => r.trim()).filter(Boolean),
    features: FUNCTIES.filter((f) => f.helpartikel === slug).map((f) => f.sleutel),
    niveau: laagsteStartNiveau(slug), vragen,
  }
}

/**
 * De sectie "## Controlevragen" uit de inhoud halen: genummerde vragen met opties "- [x]" (goed) en "- [ ]".
 * Een vraag zonder precies één goed antwoord of met minder dan twee opties telt niet.
 */
export function haalControlevragen(md: string): { inhoud: string; vragen: Controlevraag[] } {
  const i = md.search(/^## Controlevragen\s*$/m)
  if (i < 0) return { inhoud: md, vragen: [] }
  const rest = md.slice(i).split('\n').slice(1)
  const einde = rest.findIndex((r) => /^## /.test(r))
  const sectie = einde < 0 ? rest : rest.slice(0, einde)
  const na = einde < 0 ? '' : rest.slice(einde).join('\n')
  const vragen: Controlevraag[] = []
  let huidig: Controlevraag | null = null
  for (const regel of sectie) {
    const v = /^\s*\d+[.)]\s+(.+)$/.exec(regel)
    const o = /^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(regel)
    if (v) { huidig = { vraag: v[1]!.trim(), opties: [], goed: -1 }; vragen.push(huidig) }
    else if (o && huidig) { if (o[1]!.toLowerCase() === 'x') huidig.goed = huidig.opties.length; huidig.opties.push(o[2]!.trim()) }
  }
  return { inhoud: `${md.slice(0, i).trimEnd()}${na ? `\n\n${na}` : ''}`.trim(), vragen: vragen.filter((q) => q.opties.length >= 2 && q.goed >= 0 && q.opties.filter((_, j) => j === q.goed).length === 1) }
}

/** Leestijd in minuten bij 200 woorden per minuut; minstens 1. */
export function leestijd(md: string): number {
  const woorden = md.replace(/[#*_`>\[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(woorden / 200))
}

/** De vaste opbouw van een new business-artikel (F21). Geeft de koppen die ontbreken. */
export const NB_ONDERDELEN = ['Waarom dit werkt', 'Zo doe je het', 'Voorbeeld', 'Valkuilen', 'Zo doe je het in Dealtrace'] as const
export function ontbrekendeOnderdelen(md: string): string[] {
  return NB_ONDERDELEN.filter((k) => !new RegExp(`^## ${k}\\s*$`, 'm').test(md))
}

/**
 * Wat een gebruiker ziet: platformartikelen en eigen artikelen van de eigen organisatie, zonder verborgen
 * artikelen. Het niveau bepaalt alleen de volgorde (eerst tot en met je niveau), nooit wat je mag lezen.
 */
export function zichtbareArtikelen<T extends Pick<HelpArtikel, 'slug' | 'niveau' | 'organisationId'> & { id?: string }>(artikelen: T[], org: string, verborgen: string[], niveau: string): T[] {
  const weg = new Set(verborgen)
  const rang = (n: string | null | undefined) => (n ? ['beginner', 'gevorderd', 'expert'].indexOf(n) : 0)
  const mijn = rang(niveau)
  return artikelen.filter((a) => (!a.organisationId || a.organisationId === org) && !weg.has(a.id ?? a.slug))
    .map((a, i) => ({ a, i })).sort((x, y) => Number(rang(x.a.niveau) > mijn) - Number(rang(y.a.niveau) > mijn) || x.i - y.i).map((x) => x.a)
}

/** Alias met de naam uit P25; dezelfde functie als voorJou (één definitie, regel 16). */
export const artikelenVoorJou = (...args: Parameters<typeof voorJou>) => voorJou(...args)

/**
 * Bewijsplicht voor de AI-assistent (P33): elke helpbron verwijst naar een gevonden artikel en het citaat
 * staat letterlijk in dat artikel. Een antwoord met helpbronnen zonder één geldig citaat is ongeldig.
 */
export function citatenGeldig(antwoord: { bronnen?: { soort: string; ref?: string | null; citaat?: string | null }[] }, gevonden: Pick<HelpArtikel, 'slug' | 'titel' | 'samenvatting' | 'inhoud'>[]): boolean {
  const help = (antwoord.bronnen ?? []).filter((b) => b.soort === 'help')
  if (!help.length) return false
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase()
  return help.every((b) => {
    const a = gevonden.find((x) => x.slug === b.ref)
    return !!a && !!b.citaat?.trim() && norm(`${a.titel} ${a.samenvatting} ${a.inhoud}`).includes(norm(b.citaat))
  })
}

// ── Verkoopverhaal in artikelen (F25) ──────────────────────────────────────
export const VERHAAL_LEEG = 'Jullie verkoopverhaal is nog niet vastgelegd.'
export interface VerhaalVoorHelp { kernzin?: string | null; kernbelofte?: string | null; winpunten?: { titel: string; omschrijving?: string }[]; concurrenten?: { naam: string; alsDeKlantZegt?: string | null }[]; terugkomregels?: { reden: string; termijn: string; kanaal: string }[]; branches?: { naam: string }[] }
/** Vult {{verhaal:kernzin}}, {{verhaal:kernbelofte}}, {{verhaal:winpunten}}, {{verhaal:concurrenten}}, {{verhaal:terugkomregels}} en {{verhaal:branches}} met het leesmodel van de eigen organisatie. */
export function vulVerhaal(md: string, v: VerhaalVoorHelp | null): string {
  return md.replace(/\{\{verhaal:([a-z]+)\}\}/g, (_, k: string) => {
    const lijst = (x: string[]) => (x.length ? x.map((r) => `- ${r}`).join('\n') : VERHAAL_LEEG)
    switch (k) {
      case 'kernzin': return v?.kernzin ? `**"${v.kernzin}"**` : VERHAAL_LEEG
      case 'kernbelofte': return v?.kernbelofte ? `**"${v.kernbelofte}"**` : VERHAAL_LEEG
      case 'winpunten': return lijst((v?.winpunten ?? []).map((w) => `**${w.titel}**${w.omschrijving ? `: ${w.omschrijving}` : ''}`))
      case 'concurrenten': return lijst((v?.concurrenten ?? []).map((c) => `**${c.naam}**${c.alsDeKlantZegt ? `: ${c.alsDeKlantZegt}` : ''}`))
      case 'terugkomregels': return lijst((v?.terugkomregels ?? []).map((r) => `**${r.reden}**: ${r.termijn}, ${r.kanaal.toLowerCase()}`))
      case 'branches': return lijst((v?.branches ?? []).map((b) => b.naam))
      default: return ''
    }
  })
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

// ── Beheer van artikelen (F21) ─────────────────────────────────────────────
export interface ArtikelInvoer { titel: string; collectie: 'product' | 'newbusiness'; categorie: string; niveau?: string | null; samenvatting: string; inhoud: string; routes?: string[]; vragen?: Controlevraag[]; status: 'concept' | 'gepubliceerd' }
export const slugVan = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

// \u2500\u2500 Helpcenter-adressen (/helpcenter) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/** Paden onder /helpcenter die geen artikel zijn; een eigen artikel krijgt zo'n slug nooit. */
export const HELPCENTER_GERESERVEERD = ['instructies', 'academie', 'categorie'] as const
/** Het adres van een artikel en van een categorie in het helpcenter. */
export const helpLink = (slug: string) => `/helpcenter/${slug}`
export const categorieLink = (categorie: string) => `/helpcenter/categorie/${slugVan(categorie)}`
/** Categorie bij een slug uit de URL, of null. */
export function categorieUitSlug(slug: string): { naam: string; collectie: 'product' | 'newbusiness' } | null {
  const p = CATEGORIEEN_PRODUCT.find((c) => slugVan(c) === slug)
  if (p) return { naam: p, collectie: 'product' }
  const n = CATEGORIEEN_NEWBUSINESS.find((c) => slugVan(c) === slug)
  return n ? { naam: n, collectie: 'newbusiness' } : null
}
/** E\u00e9n zin per categorie, onder de kop in het helpcenter. */
export const CATEGORIE_UITLEG: Record<string, string> = {
  'Aan de slag': 'Je eerste dag, je instellingen, meldingen, de AI-assistent en Dealtrace op je telefoon.',
  'Dagelijks werk': 'Vandaag, acties, agenda, belblokken, bezoeken, inzichten en concepten.',
  'Prospects': 'Prospects toevoegen en importeren, de accountkaart, contacten en de prospectreis.',
  'Plannen en sturen': 'Prospectplanning, campagnes, Richting, de funnel en je dashboard.',
  'Inrichten': 'Regels, reizen, agents, koppelingen en instellingen voor de beheerder.',
  'Voor de salesmanager': 'Je team, coaching, analyse, audit en verbetervoorstellen.',
  'Fundament': 'Waarom new business anders is, je ideale klant, de prospectmix en je funnel.',
  'Voorbereiden': 'Je verhaal, een goede aanleiding, het buying committee en een winpunt per gesprek.',
  'Bellen': 'De eerste 20 seconden, de receptie, voicemail, BAND en om de afspraak vragen.',
  'Bezwaren': 'De bezwaren die je elke week hoort, en wat je dan zegt.',
  'Schrijven': 'De eerste mail, een opvolgmail, LinkedIn en een kaartje dat opvalt.',
  'Op pad': 'Je regiodag, het eerste bezoek, binnenlopen en opvolgen binnen 24 uur.',
  'Volhouden': 'De vierde en vijfde poging, nee als datapunt, referrals en netwerken.',
  'Van afspraak naar overdracht': 'De eerste afspraak, doorvragen, een vervolg, no-shows en een goede overdracht.',
  'Jezelf verbeteren': 'Je cijfers lezen, feedback vragen en een goede week.',
}
/** Controle vóór opslaan: titel, categorie bij de collectie, inhoud; een gepubliceerd new business-artikel heeft de vijf vaste onderdelen. */
export function controleerArtikel(a: Partial<ArtikelInvoer>): string[] {
  const f: string[] = []
  if (!a.titel || a.titel.trim().length < 4) f.push('Geef het artikel een titel')
  if (a.collectie !== 'product' && a.collectie !== 'newbusiness') f.push('Kies een collectie')
  const cats: readonly string[] = a.collectie === 'newbusiness' ? CATEGORIEEN_NEWBUSINESS : CATEGORIEEN_PRODUCT
  if (!a.categorie || !cats.includes(a.categorie)) f.push('Kies een categorie uit de collectie')
  if (a.niveau && !['beginner', 'gevorderd', 'expert'].includes(a.niveau)) f.push('Onbekend niveau')
  if (!a.inhoud?.trim()) f.push('Schrijf de inhoud')
  if (a.status === 'gepubliceerd' && a.collectie === 'newbusiness' && a.inhoud) {
    const mist = ontbrekendeOnderdelen(a.inhoud)
    if (mist.length) f.push(`Een new business-artikel heeft deze onderdelen nog nodig: ${mist.join(', ')}`)
  }
  for (const v of a.vragen ?? []) if (!v.vraag?.trim() || (v.opties ?? []).length < 2 || v.goed < 0 || v.goed >= v.opties.length) f.push('Elke controlevraag heeft minstens twee antwoorden en één goed antwoord')
  if (/[\u2013\u2014]/.test(`${a.titel ?? ''} ${a.samenvatting ?? ''} ${a.inhoud ?? ''}`)) f.push('Gebruik geen gedachtestreepjes')
  return [...new Set(f)]
}
