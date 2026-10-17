// Steun bij het dagritme: op Dagstart, Weekstart en Weekreview een blok Tips en tricks en drie artikelen uit
// de New business academie (het vak en Nieuwe klanten werven). Puur: de server geeft het moment, de werkplek,
// wat de gebruiker die dag of week deed (signalen) en de artikelen die hij mag lezen; deze functie kiest.
// Een signaal (weinig bereik, no-shows, een eerste afspraak) gaat voor; daarna past het moment (dagstart:
// de dag goed beginnen, bellen en route; weekstart: plannen en prioriteren; weekreview: reflecteren en
// leren) en de werkplek (binnendienst of buitendienst). Ongelezen artikelen gaan voor gelezen; de rest
// wisselt per dag of week via het zaad, zodat je niet elke keer hetzelfde ziet.
import { helpLink } from './help'

export type RitmeMoment = 'dagstart' | 'weekstart' | 'weekreview'
type Plek = 'binnen' | 'buiten'

/** Wat de gebruiker die dag of week deed. Alles optioneel: een ontbrekend signaal telt niet. */
export interface RitmeSignalen {
  /** Belpogingen in de periode. */
  pogingen?: number
  /** Gesprekken (opgenomen) in de periode. */
  gesprekken?: number
  /** Bereik in procenten (gesprekken van pogingen), of null als er te weinig pogingen zijn. */
  bereik?: number | null
  /** Afspraken gemaakt in de periode. */
  afspraken?: number
  /** Afspraken waar de prospect niet verscheen (laatste twee weken). */
  noShows?: number
  /** Tempo tegen het pogingendoel loopt achter. */
  tempoAchter?: boolean
  /** Taken die drie keer of vaker doorschoven, nog zonder besluit. */
  blijvers?: number
  /** Taken over tijd. */
  achterstallig?: number
  /** Afspraken die voorbij zijn zonder verslag. */
  zonderVerslag?: number
  /** Er staat een eerste afspraak met een prospect in de dag of week. */
  eersteAfspraak?: boolean
  /** Bezoeken op locatie in de dag of week. */
  bezoeken?: number
  /** Belacties die vandaag klaarstaan. */
  belTaken?: number
  /** Overdrachten in de periode. */
  overdrachten?: number
}

export interface SteunBronArtikel { slug: string; titel: string; samenvatting?: string | null; collectie?: string | null; bron?: string | null }
export interface SteunArtikel { slug: string; titel: string; samenvatting: string; reden: string; href: string; bron: string | null }
export interface SteunTip { sleutel: string; titel: string; tekst: string; reden: string | null; href: string | null }
export interface RitmeSteun { tips: SteunTip[]; artikelen: SteunArtikel[] }

/** Een regel die een signaal koppelt aan artikelen en een korte eigen tip. */
interface SignaalRegel {
  sleutel: string
  /** Waar de regel geldt; zonder momenten overal. */
  momenten?: RitmeMoment[]
  plek?: Plek
  geldt: (s: RitmeSignalen) => boolean
  reden: (s: RitmeSignalen) => string
  artikelen: string[]
  tip?: { titel: string; tekst: string }
}

const mv = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

/** Signalen, op volgorde van gewicht: de eerste regel die geldt, weegt het zwaarst. */
export const SIGNAAL_REGELS: SignaalRegel[] = [
  {
    sleutel: 'no-shows', geldt: (s) => (s.noShows ?? 0) >= 1,
    reden: (s) => `${mv(s.noShows!, 'prospect kwam', 'prospects kwamen')} de laatste twee weken niet opdagen.`,
    artikelen: ['een-no-show-opvangen', 'de-eerste-afspraak-voorbereiden'],
    tip: { titel: 'Bevestig je afspraak een dag vooraf', tekst: 'Stuur de dag ervoor een kort bericht met tijd, plek en wat je meeneemt. Wie bevestigt, komt vaker opdagen.' },
  },
  {
    sleutel: 'weinig-bereik', geldt: (s) => s.bereik != null && (s.pogingen ?? 0) >= 10 && s.bereik < 25,
    reden: (s) => `Je bereik was ${s.bereik}%: minder dan een op de vier pogingen werd een gesprek.`,
    artikelen: ['een-voicemail-die-teruggebeld-wordt', 'langs-de-receptie', 'waarom-de-vierde-en-vijfde-poging-het-verschil-maken'],
    tip: { titel: 'Wissel van belmoment', tekst: 'Neemt je doelgroep om negen uur niet op, bel dan na vieren of vlak voor de lunch. Kijk in Dagstart welk uur het best werkt.' },
  },
  {
    sleutel: 'gesprekken-zonder-afspraak', geldt: (s) => (s.gesprekken ?? 0) >= 5 && (s.afspraken ?? 0) * 10 < (s.gesprekken ?? 0),
    reden: (s) => `${mv(s.gesprekken!, 'gesprek', 'gesprekken')} en ${mv(s.afspraken ?? 0, 'afspraak', 'afspraken')}: vraag vaker om de afspraak.`,
    artikelen: ['om-de-afspraak-vragen', 'de-vijf-bezwaren-die-je-elke-week-hoort', 'een-bezwaar-in-vier-stappen'],
    tip: { titel: 'Vraag twee keer om de afspraak', tekst: 'Een eerste nee is vaak een reflex. Erken het bezwaar, geef een reden en vraag het daarna nog een keer.' },
  },
  {
    sleutel: 'tempo-achter', geldt: (s) => !!s.tempoAchter,
    reden: () => 'Je loopt achter op je pogingendoel.',
    artikelen: ['de-mindset-van-een-jager', 'je-funnel-terugrekenen-vanuit-je-doel', 'een-goede-week'],
    tip: { titel: 'Eerst vijf pogingen, dan je mail', tekst: 'Begin je dag met vijf belpogingen voordat je je inbox opent. Dan staat het tempo voor je het weet.' },
  },
  {
    sleutel: 'eerste-afspraak', momenten: ['dagstart', 'weekstart'], geldt: (s) => !!s.eersteAfspraak,
    reden: () => 'Er staat een eerste afspraak met een prospect in je agenda.',
    artikelen: ['de-eerste-afspraak-voorbereiden', 'doorvragen-in-het-eerste-gesprek', 'het-buying-committee-in-kaart'],
  },
  {
    sleutel: 'eerste-bezoek', momenten: ['dagstart', 'weekstart'], plek: 'buiten', geldt: (s) => !!s.eersteAfspraak && (s.bezoeken ?? 0) > 0,
    reden: () => 'Je gaat op bezoek bij een prospect die je nog niet sprak.',
    artikelen: ['het-eerste-bezoek', 'inventariseren-en-doorvragen'],
  },
  {
    sleutel: 'zonder-verslag', geldt: (s) => (s.zonderVerslag ?? 0) >= 1,
    reden: (s) => `${mv(s.zonderVerslag!, 'afspraak heeft', 'afspraken hebben')} nog geen verslag.`,
    artikelen: ['na-het-bezoek-binnen-24-uur-opvolgen', 'een-vervolg-afspreken'],
    tip: { titel: 'Verslag binnen een uur', tekst: 'Spreek je verslag in zodra je weer in de auto of achter je bureau zit. Wat je dan vergeet, ben je morgen kwijt.' },
  },
  {
    sleutel: 'blijvers', momenten: ['weekstart', 'weekreview'], geldt: (s) => (s.blijvers ?? 0) >= 1,
    reden: (s) => `${mv(s.blijvers!, 'taak schoof', 'taken schoven')} drie keer of vaker door.`,
    artikelen: ['nee-is-een-datapunt', 'parkeren-en-terughalen', 'blijven-opvolgen-na-een-nee'],
    tip: { titel: 'Besluit over wat blijft liggen', tekst: 'Een taak die drie keer schoof, plan je vast in, draag je over of laat je los met een reden. Doorschuiven is ook een besluit.' },
  },
  {
    sleutel: 'achterstallig', momenten: ['dagstart', 'weekstart'], geldt: (s) => (s.achterstallig ?? 0) >= 5,
    reden: (s) => `${mv(s.achterstallig!, 'taak staat', 'taken staan')} over tijd.`,
    artikelen: ['parkeren-en-terughalen', 'een-goede-week'],
  },
  {
    sleutel: 'overdrachten', momenten: ['weekreview'], geldt: (s) => (s.overdrachten ?? 0) >= 1,
    reden: (s) => `Je droeg ${mv(s.overdrachten!, 'prospect', 'prospects')} over deze week.`,
    artikelen: ['een-goede-overdracht', 'vraag-je-klanten-wat-je-oploste', 'referrals-vragen'],
  },
  {
    sleutel: 'route', momenten: ['dagstart'], plek: 'buiten', geldt: (s) => (s.bezoeken ?? 0) > 0,
    reden: (s) => `Je hebt vandaag ${mv(s.bezoeken!, 'bezoek', 'bezoeken')} op je route.`,
    artikelen: ['binnenlopen-langs-de-route', 'koud-langsgaan-bij-bedrijven'],
  },
  {
    sleutel: 'belacties', momenten: ['dagstart'], geldt: (s) => (s.belTaken ?? 0) > 0,
    reden: (s) => `Er ${s.belTaken === 1 ? 'staat 1 belactie' : `staan ${s.belTaken} belacties`} klaar.`,
    artikelen: ['de-eerste-20-seconden', 'een-belscript-gebruiken-zonder-als-een-script-te-klinken', 'vragen-stellen-met-band'],
  },
]

/** De academieartikelen per moment, met de werkplek waar ze bij passen (zonder plek: allebei). */
export const MOMENT_ARTIKELEN: Record<RitmeMoment, { slug: string; plek?: Plek }[]> = {
  dagstart: [
    { slug: 'de-eerste-20-seconden', plek: 'binnen' },
    { slug: 'langs-de-receptie', plek: 'binnen' },
    { slug: 'een-voicemail-die-teruggebeld-wordt', plek: 'binnen' },
    { slug: 'een-opvolgmail-na-een-voicemail', plek: 'binnen' },
    { slug: 'je-belscript-in-vijf-stappen', plek: 'binnen' },
    { slug: 'om-de-afspraak-vragen', plek: 'binnen' },
    { slug: 'binnenlopen-langs-de-route', plek: 'buiten' },
    { slug: 'het-eerste-bezoek', plek: 'buiten' },
    { slug: 'koud-langsgaan-bij-bedrijven', plek: 'buiten' },
    { slug: 'na-het-bezoek-binnen-24-uur-opvolgen', plek: 'buiten' },
    { slug: 'inventariseren-en-doorvragen', plek: 'buiten' },
    { slug: 'een-goede-aanleiding-vinden' },
    { slug: 'een-winpunt-per-gesprek' },
    { slug: 'aandacht-vragen-met-hulpvraag-en-entree' },
    { slug: 'de-foray-toestemming-voor-je-vragen' },
  ],
  weekstart: [
    { slug: 'je-funnel-terugrekenen-vanuit-je-doel' },
    { slug: 'de-prospectmix-koud-warm-referral-winback' },
    { slug: 'een-goede-aanleiding-vinden' },
    { slug: 'het-buying-committee-in-kaart' },
    { slug: 'je-prospectjaar-plannen' },
    { slug: 'een-hoofdkanaal-en-een-subkanaal-kiezen' },
    { slug: 'prekwalificatie-segmenteren-targeten-positioneren' },
    { slug: 'strategische-prospects-benaderen' },
    { slug: 'lead-of-prospect' },
    { slug: 'je-regiodag-plannen', plek: 'buiten' },
    { slug: 'een-beurs-of-netwerkevent-voorbereiden', plek: 'buiten' },
    { slug: 'koud-langsgaan-bij-bedrijven', plek: 'buiten' },
    { slug: 'gericht-mailen-aan-een-kleine-groep', plek: 'binnen' },
    { slug: 'linkedin-profielbezoek-connectie-bericht', plek: 'binnen' },
    { slug: 'social-selling-eerst-de-relatie', plek: 'binnen' },
    { slug: 'je-belscript-in-vijf-stappen', plek: 'binnen' },
  ],
  weekreview: [
    { slug: 'je-cijfers-lezen' },
    { slug: 'een-goede-week' },
    { slug: 'feedback-vragen-aan-je-salesmanager' },
    { slug: 'nee-is-een-datapunt' },
    { slug: 'waarom-de-vierde-en-vijfde-poging-het-verschil-maken' },
    { slug: 'de-mindset-van-een-jager' },
    { slug: 'vraag-je-klanten-wat-je-oploste' },
    { slug: 'schrijf-je-eigen-testimonial' },
    { slug: 'van-eigenschap-naar-voordeel' },
    { slug: 'je-pitch-in-een-zin' },
    { slug: 'referrals-vragen' },
    { slug: 'personal-branding-voor-verkopers' },
    { slug: 'netwerken-en-beurzen', plek: 'buiten' },
    { slug: 'een-linkedin-profiel-dat-prospects-aanspreekt', plek: 'binnen' },
  ],
}

/** De Tips & Tricks-artikelen (tip-*) per moment en werkplek. */
export const MOMENT_TIPS: Record<RitmeMoment, { slug: string; plek?: Plek }[]> = {
  dagstart: [
    { slug: 'tip-start-je-dag-met-vandaag' },
    { slug: 'tip-pitstop-voor-je-belt' },
    { slug: 'tip-koppel-een-contact-aan-je-taak', plek: 'binnen' },
    { slug: 'tip-laat-je-belblok-zichzelf-vullen', plek: 'binnen' },
    { slug: 'tip-concepten-goedkeuren-in-een-tik', plek: 'binnen' },
    { slug: 'tip-pak-kansen-langs-je-route', plek: 'buiten' },
    { slug: 'tip-rijmodus-handen-aan-het-stuur', plek: 'buiten' },
    { slug: 'tip-werk-offline-onderweg', plek: 'buiten' },
    { slug: 'tip-spreek-je-verslag-in-na-een-afspraak', plek: 'buiten' },
  ],
  weekstart: [
    { slug: 'tip-kijk-drie-weken-vooruit-met-de-horizon' },
    { slug: 'tip-accountplannen-voor-je-topprospects' },
    { slug: 'tip-campagnes-met-een-winpunt' },
    { slug: 'tip-laat-je-belblok-zichzelf-vullen', plek: 'binnen' },
    { slug: 'tip-pak-kansen-langs-je-route', plek: 'buiten' },
    { slug: 'tip-werk-offline-onderweg', plek: 'buiten' },
  ],
  weekreview: [
    { slug: 'tip-lees-je-dashboard-in-drie-minuten' },
    { slug: 'tip-schoon-je-data-op-met-datakwaliteit' },
    { slug: 'tip-zet-de-terugkomdatum-slim' },
    { slug: 'tip-maak-van-een-inzicht-een-taak' },
    { slug: 'tip-laat-een-transcript-analyseren', plek: 'binnen' },
    { slug: 'tip-spreek-je-verslag-in-na-een-afspraak', plek: 'buiten' },
  ],
}

/** Korte eigen tips per moment, om te motiveren als er geen signaal is. */
export const MOMENT_EIGEN_TIPS: Record<RitmeMoment, { sleutel: string; titel: string; tekst: string; plek?: Plek }[]> = {
  dagstart: [
    { sleutel: 'eerste-uur', titel: 'Bel in je eerste uur', tekst: 'Het eerste uur is je sterkste uur. Pak het moeilijkste gesprek eerst, dan voelt de rest licht.', plek: 'binnen' },
    { sleutel: 'route-tussenstop', titel: 'Een tussenstop per dag', tekst: 'Plan op elke bezoekdag een korte tussenstop bij een prospect langs je route. In een maand zijn dat twintig extra kansen.', plek: 'buiten' },
    { sleutel: 'een-doel', titel: 'Kies een doel voor vandaag', tekst: 'Schrijf op wat vandaag geslaagd maakt: bijvoorbeeld twee nieuwe afspraken. Een helder doel houdt je bij de les.' },
  ],
  weekstart: [
    { sleutel: 'blokken-vast', titel: 'Zet je belblokken vast', tekst: 'Plan je belblokken op maandag voor de hele week. Wat in je agenda staat, gebeurt.' },
    { sleutel: 'top-vijf', titel: 'Kies je top vijf', tekst: 'Welke vijf prospects wil je deze week echt spreken? Zet ze bovenaan en begin elke dag met een van hen.' },
    { sleutel: 'regiodag', titel: 'Bundel je bezoeken', tekst: 'Plan bezoeken per regio op dezelfde dag. Minder rijden betekent meer gesprekken.', plek: 'buiten' },
  ],
  weekreview: [
    { sleutel: 'een-les', titel: 'Een les per week', tekst: 'Kies een ding dat je volgende week anders doet. Een kleine verandering die je volhoudt, levert meer op dan drie grote voornemens.' },
    { sleutel: 'vier-wat-goed-ging', titel: 'Vier wat goed ging', tekst: 'Noem voor jezelf het beste gesprek van de week en waarom het werkte. Daar bouw je volgende week op voort.' },
    { sleutel: 'pogingen-tellen', titel: 'Tel je pogingen, niet je nee', tekst: 'Elke poging brengt je dichter bij een afspraak. Een nee is informatie, geen oordeel.' },
  ],
}

/** De reden bij een artikel zonder signaal: waarom het bij dit moment past. */
export const MOMENT_REDEN: Record<RitmeMoment, string> = {
  dagstart: 'Om je dag goed te beginnen.',
  weekstart: 'Om je week te plannen.',
  weekreview: 'Om van je week te leren.',
}

/** De werkplek als binnen of buiten; hybride past bij allebei (null). */
export function plekVan(werkplek: string | null | undefined): Plek | null {
  if (werkplek === 'buitendienst') return 'buiten'
  if (werkplek === 'hybride') return null
  return 'binnen'
}
const past = (plek: Plek | undefined, mijn: Plek | null) => !plek || !mijn || plek === mijn

/** Een vaste, kleine hash: dezelfde invoer geeft dezelfde volgorde. */
function hash(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export interface RitmeSteunInvoer {
  moment: RitmeMoment
  werkplek: string | null | undefined
  signalen: RitmeSignalen
  /** De artikelen die de gebruiker mag lezen (gepubliceerd en niet verborgen). */
  artikelen: SteunBronArtikel[]
  /** Slugs die de gebruiker al las: die komen achteraan. */
  gelezen?: Iterable<string>
  /** Wisselt de volgorde per dag of week (bijvoorbeeld de datum). */
  zaad?: string
  aantalArtikelen?: number
  aantalTips?: number
}

/** De regels die gelden voor dit moment, deze werkplek en deze signalen, op volgorde van gewicht. */
export function geldendeSignalen(moment: RitmeMoment, werkplek: string | null | undefined, s: RitmeSignalen): SignaalRegel[] {
  const mijn = plekVan(werkplek)
  return SIGNAAL_REGELS.filter((r) => (!r.momenten || r.momenten.includes(moment)) && past(r.plek, mijn) && r.geldt(s))
}

/**
 * Kies de tips en de drie artikelen. Artikelen: eerst wat bij een signaal hoort (de zwaarste regel eerst,
 * hooguit twee per regel zodat er variatie blijft), daarna wat bij het moment en de werkplek past.
 * Ongelezen gaat voor gelezen; binnen een groep bepaalt het zaad de volgorde. Tips: eerst de eigen tip van
 * een signaal (hooguit twee), dan Tips & Tricks-artikelen van het moment, dan korte eigen tips.
 */
export function kiesRitmeSteun(p: RitmeSteunInvoer): RitmeSteun {
  const mijn = plekVan(p.werkplek)
  const perSlug = new Map(p.artikelen.map((a) => [a.slug, a]))
  const gelezen = new Set(p.gelezen ?? [])
  const zaad = p.zaad ?? ''
  const regels = geldendeSignalen(p.moment, p.werkplek, p.signalen)
  const nArt = p.aantalArtikelen ?? 3
  const nTip = p.aantalTips ?? 3
  const isAcademie = (a: SteunBronArtikel) => !a.collectie || a.collectie === 'newbusiness' || a.collectie === 'werven'
  const volgorde = (slugs: string[]) => [...slugs].sort((a, b) => Number(gelezen.has(a)) - Number(gelezen.has(b)) || hash(`${zaad}:${a}`) - hash(`${zaad}:${b}`))

  // Artikelen.
  const artikelen: SteunArtikel[] = []
  const gekozen = new Set<string>()
  const neem = (slug: string, reden: string) => {
    const a = perSlug.get(slug)
    if (!a || gekozen.has(slug) || !isAcademie(a) || artikelen.length >= nArt) return false
    gekozen.add(slug)
    artikelen.push({ slug, titel: a.titel, samenvatting: a.samenvatting ?? '', reden, href: helpLink(slug), bron: a.bron ?? null })
    return true
  }
  for (const r of regels) {
    let n = 0
    for (const slug of volgorde(r.artikelen)) if (n < 2 && neem(slug, r.reden(p.signalen))) n++
  }
  for (const slug of volgorde(MOMENT_ARTIKELEN[p.moment].filter((x) => past(x.plek, mijn)).map((x) => x.slug))) neem(slug, MOMENT_REDEN[p.moment])

  // Tips.
  const tips: SteunTip[] = []
  for (const r of regels) {
    if (tips.length >= Math.min(2, nTip)) break
    if (r.tip) tips.push({ sleutel: r.sleutel, titel: r.tip.titel, tekst: r.tip.tekst, reden: r.reden(p.signalen), href: null })
  }
  for (const slug of volgorde(MOMENT_TIPS[p.moment].filter((x) => past(x.plek, mijn)).map((x) => x.slug))) {
    if (tips.length >= nTip) break
    const a = perSlug.get(slug)
    if (a && (!a.collectie || a.collectie === 'tips')) tips.push({ sleutel: slug, titel: a.titel, tekst: a.samenvatting ?? '', reden: null, href: helpLink(slug) })
    if (tips.length >= Math.max(1, nTip - 1)) break
  }
  for (const t of [...MOMENT_EIGEN_TIPS[p.moment]].filter((x) => past(x.plek, mijn)).sort((a, b) => hash(`${zaad}:${a.sleutel}`) - hash(`${zaad}:${b.sleutel}`))) {
    if (tips.length >= nTip) break
    tips.push({ sleutel: t.sleutel, titel: t.titel, tekst: t.tekst, reden: null, href: null })
  }
  return { tips, artikelen }
}

/** Alle slugs die de selectie kan noemen (voor de controle dat ze bestaan). */
export function alleSteunSlugs(): string[] {
  return [...new Set([
    ...SIGNAAL_REGELS.flatMap((r) => r.artikelen),
    ...Object.values(MOMENT_ARTIKELEN).flat().map((x) => x.slug),
    ...Object.values(MOMENT_TIPS).flat().map((x) => x.slug),
  ])]
}
