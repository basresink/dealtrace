// Belscript-templates (F08). Een script is een reeks blokken in vaste volgorde met
// variabelen tussen accolades. De salesmanager beheert, de accountmanager kiest, AI vult
// per account de aanleiding en het winpunt in. Zonder AI de vaste tekst met terugvalzinnen.
import { beloftVoor, kernzinVoor, kiesWinpunt, leesAlsDeKlantZegt, type VerkoopverhaalStand } from './verkoopverhaal'

export const SCRIPT_DOELEN = ['koud', 'opvolging', 'aanleiding', 'winback', 'bevestigen', 'anders'] as const
export type ScriptDoel = typeof SCRIPT_DOELEN[number]
export const DOEL_LABEL: Record<ScriptDoel, string> = { koud: 'Koude acquisitie', opvolging: 'Opvolging', aanleiding: 'Aanleiding', winback: 'Winback', bevestigen: 'Afspraak bevestigen', anders: 'Anders' }

export const BLOK_VOLGORDE = ['poortwachter', 'opening', 'aanleiding', 'toestemming', 'vragen', 'winpunt', 'bezwaren', 'afsluiting', 'voicemail', 'opvolgmail', 'vrij'] as const
export type BlokSoortScript = typeof BLOK_VOLGORDE[number]
export const BLOK_LABEL: Record<BlokSoortScript, string> = {
  poortwachter: 'Poortwachter', opening: 'Opening', aanleiding: 'Reden van bellen', toestemming: 'Toestemmingsvraag', vragen: 'Vragen', winpunt: 'Waarde en winpunt',
  bezwaren: 'Bezwaren', afsluiting: 'Afsluiting', voicemail: 'Voicemail', opvolgmail: 'Opvolgmail', vrij: 'Vrij blok',
}
export type Invulwijze = 'vast' | 'ai_aanvullen' | 'ai_schrijven'
export const CONTACT_ROLLEN = ['beslisser', 'beinvloeder', 'gebruiker', 'receptie', 'onbekend'] as const

export interface ScriptBlok {
  id: string
  soort: BlokSoortScript
  titel?: string
  tekst: string
  invulwijze: Invulwijze
  /** Bij een vraag: het veld waar het antwoord in komt (BAND of eigen veld). */
  veldKoppeling?: { bron: 'band' | 'cf' | 'contact' | 'account'; sleutel: string } | null
  /** Terugvaltekst als AI niets levert. */
  terugval?: string | null
}
export interface ScriptBezwaar { id: string; bezwaar: string; antwoord: string; wedervraag?: string; argumentRef?: string | null }
export interface ScriptData {
  reisfaseIds: string[]
  doelgroepIds: string[] | 'alle'
  teamIds: string[] | 'alle'
  contactRollen: string[]
  kanaal: 'vast' | 'mobiel' | 'beide'
  standaardVoor: { campagnesoorten: string[]; belblokIds: string[] }
  blokken: ScriptBlok[]
  bezwaren: ScriptBezwaar[]
  variabelen?: string[]
  opmerking?: string
  /** Het template waarmee het script begon (Belscript Studio), voor de resultaten per template. */
  template?: string | null
}
export interface Belscript {
  id: string
  naam: string
  doel: ScriptDoel
  status: 'concept' | 'actief' | 'gearchiveerd'
  versie: number
  eigenaarId?: string | null
  basisScriptId?: string | null
  isPersoonlijk?: boolean
  gebruikerId?: string | null
  data: ScriptData
}

/** De variabelen met hun terugvalzin (F08, F25). */
export const VARIABELEN: Record<string, { groep: string; terugval: string }> = {
  'gebruiker.voornaam': { groep: 'Gebruiker en organisatie', terugval: 'een collega' },
  'gebruiker.telefoon': { groep: 'Gebruiker en organisatie', terugval: 'ons algemene nummer' },
  'organisatie.naam': { groep: 'Gebruiker en organisatie', terugval: 'ons bedrijf' },
  'account.naam': { groep: 'Account', terugval: 'jullie bedrijf' },
  'account.plaats': { groep: 'Account', terugval: 'jullie regio' },
  'account.branche': { groep: 'Account', terugval: 'jullie branche' },
  'account.klasse': { groep: 'Account', terugval: '' },
  'contact.voornaam': { groep: 'Contact', terugval: '' },
  'contact.naam': { groep: 'Contact', terugval: 'de verantwoordelijke' },
  'contact.functie': { groep: 'Contact', terugval: 'verantwoordelijke' },
  'contact.rol': { groep: 'Contact', terugval: '' },
  'aanleiding.kort': { groep: 'Aanleiding en reis', terugval: 'jullie projecten' },
  'aanleiding.bron': { groep: 'Aanleiding en reis', terugval: '' },
  onderwerp: { groep: 'Aanleiding en reis', terugval: 'de inkoop van installatiemateriaal' },
  'reis.fase': { groep: 'Aanleiding en reis', terugval: '' },
  'poging.n': { groep: 'Aanleiding en reis', terugval: '' },
  'poging.van': { groep: 'Aanleiding en reis', terugval: '' },
  'vorige.uitkomst': { groep: 'Aanleiding en reis', terugval: 'ons vorige contact' },
  waarom: { groep: 'Verhaal', terugval: 'Wij helpen bedrijven zoals het uwe sneller en zonder zorgen te werken.' },
  belofte: { groep: 'Verhaal', terugval: 'We maken het u makkelijker.' },
  'winpunt.naam': { groep: 'Verhaal', terugval: 'onze aanpak' },
  argument: { groep: 'Verhaal', terugval: 'We denken mee voordat er een probleem is.' },
  'bewijs.klant': { groep: 'Verhaal', terugval: 'andere klanten in uw regio' },
  'verhaal.kernzin': { groep: 'Verhaal', terugval: 'Wij helpen bedrijven zoals het uwe sneller en zonder zorgen te werken.' },
  'verhaal.branche': { groep: 'Verhaal', terugval: '' },
  'visie.kernzin': { groep: 'Verhaal', terugval: '' },
  'belofte.branche': { groep: 'Verhaal', terugval: 'We maken het u makkelijker.' },
  waarde: { groep: 'Verhaal', terugval: '' },
  'concurrent.naam': { groep: 'Verhaal', terugval: 'uw huidige leverancier' },
  'concurrent.zoZegJeHet': { groep: 'Verhaal', terugval: '' },
  'voorstel.tijd1': { groep: 'Agenda', terugval: 'volgende week dinsdag' },
  'voorstel.tijd2': { groep: 'Agenda', terugval: 'donderdag' },
}
const VAR_RE = /\{([a-zA-Z][\w.]*)\}/g
export const isBekendeVariabele = (v: string) => v in VARIABELEN || /^cf\.[a-z0-9_]+$/i.test(v)
export function variabelenIn(tekst: string): string[] { return [...new Set([...tekst.matchAll(VAR_RE)].map((m) => m[1]!))] }
export function variabelenVan(data: Pick<ScriptData, 'blokken' | 'bezwaren'>): string[] {
  return [...new Set([...data.blokken.flatMap((b) => [...variabelenIn(b.tekst), ...variabelenIn(b.terugval ?? '')]), ...data.bezwaren.flatMap((z) => [...variabelenIn(z.antwoord), ...variabelenIn(z.wedervraag ?? '')])])]
}

const GESPROKEN = new Set<BlokSoortScript>(['poortwachter', 'opening', 'aanleiding', 'toestemming', 'vragen', 'winpunt', 'afsluiting', 'vrij'])
export const woordenVan = (data: Pick<ScriptData, 'blokken'>) => data.blokken.filter((b) => GESPROKEN.has(b.soort) && b.soort !== 'poortwachter').reduce((s, b) => s + b.tekst.replace(VAR_RE, 'x').split(/\s+/).filter(Boolean).length, 0)

/**
 * Validatie: bekende variabelen (fout met de naam), verplichte blokken bij activeren
 * (opening, afsluiting, voicemail), bestaande winpunten en concurrenten, lengte.
 */
export function valideerScript(s: Pick<Belscript, 'naam' | 'doel' | 'data'>, opties: { activeren?: boolean; winpuntIds?: string[]; concurrentIds?: string[] } = {}): { fouten: string[]; waarschuwingen: string[]; controleren: boolean; woorden: number } {
  const fouten: string[] = []
  const waarschuwingen: string[] = []
  if (!s.naam?.trim()) fouten.push('Geef het script een naam')
  if (!SCRIPT_DOELEN.includes(s.doel)) fouten.push('Kies een doel')
  const onbekend = variabelenVan(s.data).filter((v) => !isBekendeVariabele(v))
  for (const v of onbekend) fouten.push(`Onbekende variabele {${v}}`)
  for (const b of s.data.blokken) if (!BLOK_VOLGORDE.includes(b.soort)) fouten.push(`Onbekend blok ${b.soort}`)
  if (opties.activeren) {
    for (const nodig of ['opening', 'afsluiting', 'voicemail'] as const) if (!s.data.blokken.some((b) => b.soort === nodig && b.tekst.trim())) fouten.push(`Een actief script heeft een ${BLOK_LABEL[nodig].toLowerCase()}`)
  }
  let controleren = false
  if (opties.concurrentIds) for (const z of s.data.bezwaren) if (z.argumentRef?.startsWith('cc-') && !opties.concurrentIds.includes(z.argumentRef)) { controleren = true; waarschuwingen.push(`Bezwaar "${z.bezwaar}" verwijst naar een concurrent die niet meer bestaat`) }
  if (opties.winpuntIds) for (const z of s.data.bezwaren) if (z.argumentRef?.startsWith('wp-') && !opties.winpuntIds.includes(z.argumentRef)) { controleren = true; waarschuwingen.push(`Bezwaar "${z.bezwaar}" verwijst naar een winpunt dat niet meer bestaat`) }
  const woorden = woordenVan(s.data)
  if (woorden > 200) waarschuwingen.push(`Het script is ${woorden} woorden; richtlijn 150, maximaal 200`)
  const voicemail = s.data.blokken.find((b) => b.soort === 'voicemail')
  if (voicemail && voicemail.tekst.split(/\s+/).length > 65) waarschuwingen.push('De voicemail duurt langer dan 25 seconden')
  return { fouten, waarschuwingen, controleren, woorden }
}

// ── Kiezen ─────────────────────────────────────────────────────────────────

export interface KiesContext { campagneScriptId?: string | null; belblokScriptId?: string | null; doel?: ScriptDoel | null; faseId?: string | null; doelgroepId?: string | null; contactRol?: string | null }
export interface KiesGebruiker { id: string; niveau: string; teamId?: string | null }

/** Welke scripts ziet deze gebruiker? Een Beginner alleen actieve scripts van zijn team, zonder varianten. */
export function zichtbareScripts(scripts: Belscript[], g: KiesGebruiker): Belscript[] {
  return scripts.filter((s) => s.status === 'actief' && (s.isPersoonlijk
    ? g.niveau !== 'beginner' && s.gebruikerId === g.id
    : s.data.teamIds === 'alle' || (!!g.teamId && s.data.teamIds.includes(g.teamId))))
}

/**
 * Voorselectie (F08): script van de campagne, van het belblok, het best passende op doel,
 * reisfase, doelgroep en rol, dan de eigen variant daarvan, anders het startscript.
 */
export function kiesScript(ctx: KiesContext, scripts: Belscript[], g: KiesGebruiker): { scriptId: string; reden: string } | null {
  const zicht = zichtbareScripts(scripts, g)
  const algemeen = zicht.filter((s) => !s.isPersoonlijk)
  const variantVan = (id: string) => zicht.find((s) => s.isPersoonlijk && s.basisScriptId === id)
  const metVariant = (s: Belscript, reden: string) => { const v = variantVan(s.id); return v ? { scriptId: v.id, reden: `${reden}, jouw variant` } : { scriptId: s.id, reden } }
  const byId = (id?: string | null) => (id ? algemeen.find((s) => s.id === id) : undefined)
  const c = byId(ctx.campagneScriptId)
  if (c) return metVariant(c, 'Script van de campagne')
  const b = byId(ctx.belblokScriptId)
  if (b) return metVariant(b, 'Script van het belblok')
  const past = (s: Belscript) => {
    let p = 0
    if (ctx.doel && s.doel === ctx.doel) p += 8
    if (ctx.faseId && s.data.reisfaseIds.includes(ctx.faseId)) p += 4
    if (ctx.doelgroepId && s.data.doelgroepIds !== 'alle' && s.data.doelgroepIds.includes(ctx.doelgroepId)) p += 2
    if (ctx.contactRol && s.data.contactRollen.includes(ctx.contactRol)) p += 1
    return p
  }
  const beste = [...algemeen].map((s) => ({ s, p: past(s) })).filter((x) => x.p > 0).sort((x, y) => y.p - x.p || x.s.naam.localeCompare(y.s.naam, 'nl'))[0]
  if (beste) return metVariant(beste.s, 'Past bij doel, fase, doelgroep en rol')
  const start = algemeen.find((s) => s.doel === 'koud') ?? algemeen[0]
  return start ? metVariant(start, 'Startscript van de organisatie') : null
}

// ── Invullen zonder AI ─────────────────────────────────────────────────────

export interface ScriptContext {
  waarden: Record<string, string | null | undefined>
  /** AI-tekst per blok-id, met bronnen. */
  ai?: Record<string, { tekst: string; bronnen?: { soort: string; url?: string; datum?: string; citaat?: string }[] }>
}
export interface Segment { tekst: string; onbekend?: string }
export interface IngevuldBlok extends ScriptBlok { segmenten: Segment[]; onbekend: string[]; bronnen?: { soort: string; url?: string; datum?: string; citaat?: string }[]; vanAi: boolean }

function vul(tekst: string, waarden: ScriptContext['waarden']): { segmenten: Segment[]; onbekend: string[] } {
  const segmenten: Segment[] = []
  const onbekend: string[] = []
  let i = 0
  for (const m of tekst.matchAll(VAR_RE)) {
    if (m.index! > i) segmenten.push({ tekst: tekst.slice(i, m.index) })
    const v = m[1]!
    const w = waarden[v]
    if (w != null && String(w).trim()) segmenten.push({ tekst: String(w) })
    else { onbekend.push(v); segmenten.push({ tekst: VARIABELEN[v]?.terugval ?? '', onbekend: v }) }
    i = m.index! + m[0].length
  }
  if (i < tekst.length) segmenten.push({ tekst: tekst.slice(i) })
  return { segmenten, onbekend }
}

/** Vervangt variabelen, markeert onbekende (met terugvalzin), en zet AI-tekst waar die er is. Geen AI-aanroep. */
export function vulScript(s: Pick<Belscript, 'data'>, ctx: ScriptContext): { blokken: IngevuldBlok[]; bezwaren: (ScriptBezwaar & { antwoordIngevuld: string })[]; onbekend: string[] } {
  // De volgorde van het script zelf (de salesmanager zet de blokken in Belscript Studio op volgorde).
  const blokken = s.data.blokken.map((b) => {
    const ai = b.invulwijze !== 'vast' ? ctx.ai?.[b.id] : undefined
    if (ai?.tekst) return { ...b, segmenten: [{ tekst: ai.tekst }], onbekend: [], bronnen: ai.bronnen ?? [], vanAi: true }
    const basis = b.invulwijze === 'ai_schrijven' && b.terugval ? b.terugval : b.tekst
    const r = vul(basis, ctx.waarden)
    return { ...b, ...r, vanAi: false }
  })
  const bezwaren = s.data.bezwaren.map((z) => ({ ...z, antwoordIngevuld: vul(z.antwoord, ctx.waarden).segmenten.map((x) => x.tekst).join('') }))
  return { blokken, bezwaren, onbekend: [...new Set(blokken.flatMap((b) => b.onbekend))] }
}

/**
 * De waarden voor de variabelen uit account, contact, gebruiker en het verkoopverhaal
 * (F25): kernzin en belofte van de branche met terugval, het winpunt via kiesWinpunt en
 * de concurrent die het account nu heeft.
 */
export function scriptWaarden(i: {
  gebruiker: { naam: string; telefoon?: string | null }
  organisatie: { naam: string }
  account: { naam: string; plaats?: string | null; brancheId?: string | null; brancheNaam?: string | null; klasse?: string | null; huidigeLeverancierId?: string | null; faseNaam?: string | null; faseId?: string | null }
  contact?: { voornaam?: string | null; achternaam?: string | null; functie?: string | null; rol?: string | null } | null
  aanleiding?: { kort?: string | null; bron?: string | null } | null
  poging?: { n: number; van: number; vorige?: string | null } | null
  verhaal?: VerkoopverhaalStand | null
  eigenVelden?: Record<string, unknown>
  eerderGebruikteWinpunten?: string[]
  /** Het winpunt dat de regel van de taak meegaf (Dealtrace); gaat voor de eigen keuze. */
  winpuntId?: string | null
}): { waarden: Record<string, string | null>; meldingen: string[]; winpuntId: string | null; concurrentId: string | null } {
  const meldingen: string[] = []
  const v = i.verhaal
  const kern = v ? kernzinVoor(v, i.account.brancheId) : { tekst: null, terugval: true }
  const bel = v ? beloftVoor(v, i.account.brancheId) : { tekst: null, terugval: true }
  if (v && kern.terugval && 'melding' in kern && kern.melding) meldingen.push(kern.melding)
  const vast = i.winpuntId ? v?.winpunten?.find((w) => w.id === i.winpuntId && w.actief) : undefined
  const wp = vast ?? (v?.winpunten ? kiesWinpunt(v.winpunten, { faseId: i.account.faseId ?? null, eerderGebruikt: i.eerderGebruikteWinpunten }) : null)
  const cc = v && i.account.huidigeLeverancierId ? v.concurrenten.find((c) => c.id === i.account.huidigeLeverancierId) ?? null : null
  const waarden: Record<string, string | null> = {
    'gebruiker.voornaam': i.gebruiker.naam.replace(/^Testgebruiker\s+/, '').split(/\s+/)[0] ?? null, 'gebruiker.telefoon': i.gebruiker.telefoon ?? null,
    'organisatie.naam': i.organisatie.naam, 'account.naam': i.account.naam, 'account.plaats': i.account.plaats ?? null, 'account.branche': i.account.brancheNaam ?? null,
    'account.klasse': i.account.klasse ?? null, 'contact.voornaam': i.contact?.voornaam ?? null,
    'contact.naam': i.contact ? [i.contact.voornaam, i.contact.achternaam].filter(Boolean).join(' ') || null : null, 'contact.functie': i.contact?.functie ?? null,
    'contact.rol': i.contact?.rol ?? null, 'aanleiding.kort': i.aanleiding?.kort ? zinsdeel(i.aanleiding.kort) : null, 'aanleiding.bron': i.aanleiding?.bron ?? null,
    'reis.fase': i.account.faseNaam ?? null, 'poging.n': i.poging ? String(i.poging.n) : null, 'poging.van': i.poging ? String(i.poging.van) : null,
    'vorige.uitkomst': i.poging?.vorige ?? null,
    waarom: kern.tekst, 'verhaal.kernzin': kern.tekst, 'verhaal.branche': kern.terugval ? null : kern.tekst, belofte: bel.tekst, 'belofte.branche': bel.tekst,
    'visie.kernzin': v?.teksten?.find((t) => t.sleutel === 'visie')?.tekst?.split(/(?<=\.)\s/)[0] ?? null,
    waarde: v?.teksten?.find((t) => t.sleutel === 'waardestatement' && t.brancheId === (i.account.brancheId ?? null))?.tekst ?? v?.teksten?.find((t) => t.sleutel === 'waardestatement' && !t.brancheId)?.tekst ?? null,
    'winpunt.naam': wp?.titel ?? null, argument: wp?.omschrijving ?? null, 'bewijs.klant': null,
    'concurrent.naam': cc?.naam ?? null, 'concurrent.zoZegJeHet': cc?.zoZegJeHet ?? null,
    'voorstel.tijd1': null, 'voorstel.tijd2': null,
  }
  for (const [k, w] of Object.entries(i.eigenVelden ?? {})) waarden[`cf.${k}`] = w == null ? null : String(w)
  return { waarden, meldingen, winpuntId: wp?.id ?? null, concurrentId: cc?.id ?? null }
}

/** De bezwaren van het script plus, bij een bekende huidige leverancier, het bezwaar uit "Als de klant zegt". */
export function bezwarenMetConcurrent(s: Pick<Belscript, 'data'>, verhaal: VerkoopverhaalStand | null | undefined, concurrentId: string | null): ScriptBezwaar[] {
  const lijst = [...s.data.bezwaren]
  const cc = concurrentId ? verhaal?.concurrenten.find((c) => c.id === concurrentId) : undefined
  const z = leesAlsDeKlantZegt(cc?.alsDeKlantZegt)
  if (cc && z && !lijst.some((x) => x.argumentRef === cc.id)) lijst.unshift({ id: `bz-${cc.id}`, bezwaar: z.bezwaar, antwoord: z.antwoord, wedervraag: cc.zoZegJeHet, argumentRef: cc.id })
  return lijst
}

// ── Vergelijken ────────────────────────────────────────────────────────────

export interface ScriptResultaat { scriptId: string; versie: number; variant?: string | null; gesprekken: number; bereikt: number; afspraken: number; gemiddeldeDuurSec?: number }
export const TE_WEINIG = 'Te weinig gesprekken om te vergelijken'
/** Conversie per versie of variant; onder het minimum geen vergelijking (F08). */
export function scriptVergelijking(resultaten: ScriptResultaat[], minimum = 30) {
  const rijen = resultaten.map((r) => ({ ...r, conversie: r.gesprekken ? Math.round((r.afspraken / r.gesprekken) * 1000) / 10 : 0, genoeg: r.gesprekken >= minimum }))
  const vergelijkbaar = rijen.filter((r) => r.genoeg)
  return { rijen, melding: vergelijkbaar.length < 2 ? TE_WEINIG : null, beste: vergelijkbaar.length >= 2 ? [...vergelijkbaar].sort((a, b) => b.conversie - a.conversie)[0]! : null }
}
/** "28% naar afspraak" in de keuzelijst (vanaf Gevorderd). */
export const conversieLabel = (r?: Pick<ScriptResultaat, 'gesprekken' | 'afspraken'> | null) => (r && r.gesprekken ? `${Math.round((r.afspraken / r.gesprekken) * 100)}% naar afspraak` : 'nog geen gesprekken')

// ── Startset ───────────────────────────────────────────────────────────────

/** "Plant woningbouw" midden in een zin: "plant woningbouw" (afkortingen blijven). */
const zinsdeel = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t).replace(/[.!?]\s*$/, '')
const blok = (id: string, soort: BlokSoortScript, tekst: string, invulwijze: Invulwijze = 'vast', extra: Partial<ScriptBlok> = {}): ScriptBlok => ({ id, soort, tekst, invulwijze, ...extra })
const basisData = (extra: Partial<ScriptData>): ScriptData => ({ reisfaseIds: [], doelgroepIds: 'alle', teamIds: 'alle', contactRollen: [], kanaal: 'beide', standaardVoor: { campagnesoorten: [], belblokIds: [] }, blokken: [], bezwaren: [], ...extra })
const VOICEMAIL = 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. Ik bel over {aanleiding.kort}. Ik mail je zo ook even. Bel gerust terug op {gebruiker.telefoon}.'
const AFSLUITING = 'Zullen we {voorstel.tijd1} of {voorstel.tijd2} een half uur afspreken om dat samen te bekijken?'
const OPVOLGMAIL = 'Onderwerp: ons gesprek over {aanleiding.kort}\n\nBeste {contact.voornaam}, zoals beloofd een korte samenvatting.'
const VRAGEN = 'Hoe regelen jullie dat nu? Wie beslist daarover? Wanneer speelt het weer?'
const STANDAARD_BEZWAREN: ScriptBezwaar[] = [
  { id: 'bz-leverancier', bezwaar: 'We hebben al een leverancier.', antwoord: 'Dat dacht ik al. Veel van onze klanten werken met twee partijen: één voor de losse bestellingen en één die meedenkt bij projecten.', wedervraag: 'Wat zou er beter kunnen bij jullie huidige leverancier?' },
  { id: 'bz-geen-tijd', bezwaar: 'Ik heb geen tijd.', antwoord: 'Begrijpelijk. Het kost u een half uur en het levert u op elk project tijd op.', wedervraag: 'Wanneer komt het beter uit?' },
]

/** De zes scripts van de startset (F08, Platformsjablonen). */
export const STARTSET_SCRIPTS: Omit<Belscript, 'id' | 'versie' | 'status'>[] = [
  { naam: 'Koude acquisitie beslisser', doel: 'koud', data: basisData({ contactRollen: ['beslisser'], blokken: [
    blok('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. {verhaal.kernzin}', 'ai_aanvullen'),
    blok('aanleiding', 'aanleiding', 'Ik bel u omdat {aanleiding.kort}.', 'ai_aanvullen', { terugval: 'Ik bel u omdat we veel bedrijven zoals {account.naam} helpen.' }),
    blok('toestemming', 'toestemming', 'Heeft u twee minuten, of bel ik beter op een ander moment?'),
    blok('vragen', 'vragen', VRAGEN, 'vast', { veldKoppeling: { bron: 'band', sleutel: 'behoefte' } }),
    blok('winpunt', 'winpunt', '{winpunt.naam}: {argument}', 'ai_aanvullen'),
    blok('afsluiting', 'afsluiting', AFSLUITING), blok('voicemail', 'voicemail', VOICEMAIL), blok('opvolgmail', 'opvolgmail', OPVOLGMAIL, 'ai_schrijven', { terugval: OPVOLGMAIL }),
  ], bezwaren: STANDAARD_BEZWAREN }) },
  { naam: 'Langs de receptie', doel: 'koud', data: basisData({ contactRollen: ['receptie'], kanaal: 'vast', blokken: [
    blok('poortwachter', 'poortwachter', 'Goedemorgen, met {gebruiker.voornaam} van {organisatie.naam}. Ik wil graag {contact.naam} spreken over {aanleiding.kort}. Wie gaat er bij jullie over {onderwerp}?'),
    blok('opening', 'opening', 'Fijn dat u me doorverbindt. {verhaal.kernzin}'),
    blok('toestemming', 'toestemming', 'Wanneer kan ik {contact.voornaam} het beste terugbellen?'),
    blok('afsluiting', 'afsluiting', 'Dan bel ik {voorstel.tijd1} terug. Wat is het directe nummer?'), blok('voicemail', 'voicemail', VOICEMAIL),
  ], bezwaren: [{ id: 'bz-mail', bezwaar: 'Stuur maar een mail.', antwoord: 'Dat doe ik graag. Aan wie mag ik hem richten, zodat hij bij de juiste persoon komt?' }] }) },
  { naam: 'Opvolging na mail of LinkedIn', doel: 'opvolging', data: basisData({ blokken: [
    blok('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. Ik stuurde u laatst een bericht over {aanleiding.kort}.'),
    blok('vragen', 'vragen', 'Heeft u het kunnen lezen? Hoe kijkt u daarnaar?', 'vast', { veldKoppeling: { bron: 'band', sleutel: 'behoefte' } }),
    blok('afsluiting', 'afsluiting', AFSLUITING), blok('voicemail', 'voicemail', VOICEMAIL),
  ], bezwaren: STANDAARD_BEZWAREN }) },
  { naam: 'Bellen met een aanleiding', doel: 'aanleiding', data: basisData({ blokken: [
    blok('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}.'),
    blok('aanleiding', 'aanleiding', 'Ik zag dat {aanleiding.kort}. Daarom bel ik u.', 'ai_schrijven', { terugval: 'Ik bel u omdat er bij jullie iets verandert.' }),
    blok('winpunt', 'winpunt', '{winpunt.naam}: {argument}', 'ai_aanvullen'),
    blok('afsluiting', 'afsluiting', AFSLUITING), blok('voicemail', 'voicemail', VOICEMAIL),
  ], bezwaren: STANDAARD_BEZWAREN }) },
  { naam: 'Ex-klant terugwinnen', doel: 'winback', data: basisData({ blokken: [
    blok('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. We hebben een tijd samengewerkt en ik wil graag weten hoe het nu gaat.'),
    blok('vragen', 'vragen', 'Wat is er bij jullie veranderd sinds we samenwerkten? Wat miste u toen?', 'vast', { veldKoppeling: { bron: 'band', sleutel: 'behoefte' } }),
    blok('winpunt', 'winpunt', 'Sindsdien bieden we {winpunt.naam}: {argument}', 'ai_aanvullen'),
    blok('afsluiting', 'afsluiting', AFSLUITING), blok('voicemail', 'voicemail', VOICEMAIL),
  ], bezwaren: [{ id: 'bz-vertrek', bezwaar: 'Daar zijn we niet voor niets weggegaan.', antwoord: 'Dat begrijp ik, en dat neem ik serieus. Wat zou er anders moeten zijn om het opnieuw te proberen?' }] }) },
  { naam: 'Afspraak bevestigen', doel: 'bevestigen', data: basisData({ blokken: [
    blok('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. Ik bel even over onze afspraak.'),
    blok('vragen', 'vragen', 'Staat de afspraak nog? Wie schuiven er aan? Wat wilt u in elk geval bespreken?'),
    blok('afsluiting', 'afsluiting', 'Fijn, dan zie ik u dan. Ik stuur de bevestiging nog even per mail.'), blok('voicemail', 'voicemail', VOICEMAIL),
  ], bezwaren: [] }) },
]

/** Wat het belpaneel na een gesprek meegeeft voor de activiteit (F08). */
export interface ScriptStaat {
  scriptId: string; versie: number; gekozenDoor: 'voorstel' | 'gebruiker'; gewisseld: boolean
  bezwaren: { id: string; bezwaar: string; argumentRef?: string | null }[]
  vragen: { blokId: string; vraag: string; antwoord: string; veld?: { bron: string; sleutel: string } | null }[]
  /** De blokken die in de belmodus open zijn geweest (stap voor stap). */
  blokkenGebruikt?: string[]
  /** Gebeld met een bewaarde versie per prospect (Belscript Studio). */
  prospectVersieId?: string | null
  prospectVersie?: number | null
}

// ── Belscript Studio ───────────────────────────────────────────────────────
// Vier onderdelen op /belscripts: het standaardscript van het team (blokken, variabelen,
// voorbeeld, bezwaren, versies), zes templates als startpunt, een script per prospect dat de AI
// vult en de accountmanager beoordeelt, en het script compact in de belmodus.

export const WOORDEN_RICHTLIJN = 150
export const WOORDEN_MAX = 200
/** Gesproken tempo: ongeveer tweeënhalf woord per seconde. */
export const secondenVoor = (woorden: number) => Math.round(woorden / 2.5)
export const INVULWIJZE_LABEL: Record<Invulwijze, string> = { vast: 'Vaste tekst', ai_aanvullen: 'AI vult aan', ai_schrijven: 'AI schrijft' }
/** De blokken die je in de studio toevoegt (bezwaren staan apart, de opvolgmail hoort bij een template). */
export const STUDIO_BLOKKEN: BlokSoortScript[] = ['opening', 'aanleiding', 'toestemming', 'vragen', 'winpunt', 'afsluiting', 'voicemail', 'poortwachter', 'vrij']

/** De variabelen in de invoegbalk, per groep. Alle variabelen staan in VARIABELEN. */
export const VARIABELE_CHIPS: { groep: string; variabelen: string[] }[] = [
  { groep: 'Contact', variabelen: ['contact.voornaam', 'contact.functie'] },
  { groep: 'Account', variabelen: ['account.naam', 'account.plaats', 'concurrent.naam'] },
  { groep: 'Verhaal', variabelen: ['verhaal.kernzin', 'winpunt.naam', 'argument'] },
  { groep: 'Aanleiding', variabelen: ['aanleiding.kort', 'voorstel.tijd1', 'voorstel.tijd2'] },
]

const STUDIO_VOICEMAIL = 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. Ik bel over {aanleiding.kort}. Ik mail u zo een korte toelichting. Bel gerust terug op {gebruiker.telefoon}.'
/** De begintekst van een nieuw blok per soort. */
export const NIEUW_BLOK_TEKST: Record<BlokSoortScript, string> = {
  poortwachter: 'Goedemorgen, met {gebruiker.voornaam} van {organisatie.naam}. Wie gaat er bij jullie over {onderwerp}?',
  opening: 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. {verhaal.kernzin}',
  aanleiding: 'Ik bel u omdat {aanleiding.kort}.',
  toestemming: 'Heeft u twee minuten, of bel ik beter op een ander moment?',
  vragen: 'Hoe regelen jullie dat nu? Wie beslist daarover? Wanneer speelt het weer?',
  winpunt: 'Klanten in {account.plaats} kiezen voor ons omdat {argument}',
  bezwaren: '',
  afsluiting: AFSLUITING,
  voicemail: STUDIO_VOICEMAIL,
  opvolgmail: OPVOLGMAIL,
  vrij: '',
}
/** Een nieuw blok; reden van bellen en waarde laten de AI aanvullen, met de terugvalzin uit de begintekst. */
export function nieuwBlok(soort: BlokSoortScript, id: string): ScriptBlok {
  const ai = soort === 'aanleiding' || soort === 'winpunt'
  return { id, soort, tekst: NIEUW_BLOK_TEKST[soort] ?? '', invulwijze: ai ? 'ai_aanvullen' : 'vast', veldKoppeling: null, terugval: soort === 'aanleiding' ? 'Ik bel u omdat we veel bedrijven zoals {account.naam} helpen.' : soort === 'winpunt' ? '{winpunt.naam}: {argument}' : null }
}
/** Een nieuw blok komt vóór de afsluiting (of achteraan als die er niet is). */
export function voegBlokToe(blokken: ScriptBlok[], blok: ScriptBlok): ScriptBlok[] {
  const i = blokken.findIndex((b) => b.soort === 'afsluiting')
  const uit = [...blokken]
  uit.splice(i >= 0 ? i : uit.length, 0, blok)
  return uit
}
export function verplaatsBlok<T>(lijst: T[], i: number, richting: -1 | 1): T[] {
  const j = i + richting
  if (i < 0 || j < 0 || i >= lijst.length || j >= lijst.length) return lijst
  const uit = [...lijst]
  ;[uit[i], uit[j]] = [uit[j]!, uit[i]!]
  return uit
}
/** Een variabele invoegen op de cursor (of over de selectie heen). */
export function voegVariabeleIn(tekst: string, variabele: string, start = tekst.length, eind = start): { tekst: string; cursor: number } {
  const v = `{${variabele}}`
  const s = Math.max(0, Math.min(start, tekst.length))
  const e = Math.max(s, Math.min(eind, tekst.length))
  return { tekst: tekst.slice(0, s) + v + tekst.slice(e), cursor: s + v.length }
}
/** Woorden met de richtlijn: "142 woorden, ongeveer 57 seconden (richtlijn 150)". */
export function lengteMelding(woorden: number): { tekst: string; stand: 'goed' | 'lang' | 'te_lang'; procent: number } {
  const stand = woorden > WOORDEN_MAX ? 'te_lang' : woorden > WOORDEN_RICHTLIJN ? 'lang' : 'goed'
  return { tekst: `${woorden} ${woorden === 1 ? 'woord' : 'woorden'}, ongeveer ${secondenVoor(woorden)} seconden (richtlijn ${WOORDEN_RICHTLIJN}, maximaal ${WOORDEN_MAX})`, stand, procent: Math.min(100, Math.round((woorden / WOORDEN_MAX) * 100)) }
}

// ── Templates ──────────────────────────────────────────────────────────────

export type TemplateSoort = 'nieuw' | 'bestaand'
export interface ScriptTemplate {
  id: string
  naam: string
  /** Wat het gesprek moet opleveren. */
  doel: string
  scriptDoel: ScriptDoel
  soort: TemplateSoort
  wanneer: string
  rol: string
  contactRollen: string[]
  blokken: ScriptBlok[]
  bezwaren: ScriptBezwaar[]
}
const tb = (id: string, soort: BlokSoortScript, tekst: string, invulwijze: Invulwijze = 'vast', terugval: string | null = null): ScriptBlok => ({ id, soort, tekst, invulwijze, terugval, veldKoppeling: soort === 'vragen' ? { bron: 'band', sleutel: 'behoefte' } : null })

/** De zes templates (fictieve teksten). Resultaten komen uit de eigen gesprekken van de organisatie. */
export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  { id: 'koud', naam: 'Koude acquisitie', doel: 'Een afspraak met de beslisser', scriptDoel: 'koud', soort: 'nieuw', rol: 'Beslisser', contactRollen: ['beslisser'],
    wanneer: 'Eerste contact zonder eerdere aanraking. Het contact is beslisser of je weet het nog niet.',
    blokken: [
      tb('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. {verhaal.kernzin}', 'ai_aanvullen', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}.'),
      tb('aanleiding', 'aanleiding', 'Ik bel u omdat {aanleiding.kort}.', 'ai_aanvullen', 'Ik bel u omdat we veel bedrijven zoals {account.naam} helpen.'),
      tb('toestemming', 'toestemming', 'Heeft u twee minuten, of bel ik beter op een ander moment?'),
      tb('vragen', 'vragen', 'Hoe regelen jullie dat nu met {concurrent.naam}? Wie beslist daarover? Wanneer speelt het weer?'),
      tb('winpunt', 'winpunt', '{winpunt.naam}: {argument}', 'ai_aanvullen', 'We denken mee voordat er een probleem is.'),
      tb('afsluiting', 'afsluiting', AFSLUITING), tb('voicemail', 'voicemail', STUDIO_VOICEMAIL),
    ],
    bezwaren: [
      { id: 'bz-leverancier', bezwaar: 'We zitten goed bij onze huidige leverancier.', antwoord: 'Dat hoor ik vaker, en dat is fijn. Waar het bij projecten vaak wringt is de levering op de bouw. Hoe gaat dat bij jullie?', wedervraag: 'Wat zou er beter kunnen?' },
      { id: 'bz-geen-tijd', bezwaar: 'Ik heb geen tijd.', antwoord: 'Begrijpelijk. Het kost u een half uur en het levert u op elk project tijd op.', wedervraag: 'Wanneer komt het beter uit?' },
      { id: 'bz-informatie', bezwaar: 'Stuur maar wat informatie.', antwoord: 'Doe ik graag. Zodat ik het juiste stuur: speelt het vooral bij projecten of bij service?' },
    ] },
  { id: 'mail', naam: 'Opvolging na mail', doel: 'Je mail of LinkedIn-bericht omzetten in een gesprek', scriptDoel: 'opvolging', soort: 'bestaand', rol: 'Alle rollen', contactRollen: [],
    wanneer: 'Twee tot vijf werkdagen na een mail of bericht zonder reactie.',
    blokken: [
      tb('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. Ik stuurde u laatst een bericht over {aanleiding.kort}.'),
      tb('vragen', 'vragen', 'Heeft u het kunnen lezen? Hoe kijkt u daarnaar?'),
      tb('winpunt', 'winpunt', 'Kort gezegd: {winpunt.naam}.', 'ai_aanvullen', 'Kort gezegd: we maken het u makkelijker.'),
      tb('afsluiting', 'afsluiting', AFSLUITING), tb('voicemail', 'voicemail', STUDIO_VOICEMAIL),
    ],
    bezwaren: [{ id: 'bz-niet-gezien', bezwaar: 'Ik heb uw mail niet gezien.', antwoord: 'Geen probleem, in het kort: {winpunt.naam}. Mag ik u twee vragen stellen?' }] },
  { id: 'beurs', naam: 'Opvolging na beurs', doel: 'Een standbezoek omzetten in een afspraak', scriptDoel: 'opvolging', soort: 'bestaand', rol: 'Alle rollen', contactRollen: [],
    wanneer: 'Binnen tien werkdagen na de beurs, met een gescande badge of visitekaartje.',
    blokken: [
      tb('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. We spraken elkaar op de beurs.'),
      tb('aanleiding', 'aanleiding', 'U vroeg toen naar {aanleiding.kort}.', 'ai_schrijven', 'Ik beloofde u terug te bellen.'),
      tb('vragen', 'vragen', 'Wat sprak u op de stand het meest aan? Speelt het nu of later?'),
      tb('afsluiting', 'afsluiting', AFSLUITING), tb('voicemail', 'voicemail', STUDIO_VOICEMAIL),
    ],
    bezwaren: [{ id: 'bz-rondkijken', bezwaar: 'We keken alleen even rond.', antwoord: 'Dat snap ik. Wat zou er moeten gebeuren om er wel serieus naar te kijken?' }] },
  { id: 'nee', naam: 'Herintroductie na nee', doel: 'Opnieuw in gesprek na een eerdere nee, volgens de terugkomregel', scriptDoel: 'winback', soort: 'bestaand', rol: 'Beslisser', contactRollen: ['beslisser'],
    wanneer: 'Als de termijn van de terugkomregel verloopt, bijvoorbeeld zes maanden na "tevreden met leverancier".',
    blokken: [
      tb('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. We spraken elkaar eerder en ik beloofde terug te bellen.'),
      tb('aanleiding', 'aanleiding', 'U gaf toen aan: {vorige.uitkomst}.', 'ai_schrijven', 'U had toen geen behoefte.'),
      tb('vragen', 'vragen', 'Wat is er sindsdien veranderd? Wat mist u nu nog?'),
      tb('winpunt', 'winpunt', 'Sindsdien bieden we {winpunt.naam}.', 'ai_aanvullen', 'Sindsdien is er bij ons veel veranderd.'),
      tb('afsluiting', 'afsluiting', AFSLUITING), tb('voicemail', 'voicemail', STUDIO_VOICEMAIL),
    ],
    bezwaren: [{ id: 'bz-niets-veranderd', bezwaar: 'Er is niets veranderd.', antwoord: 'Fijn om te horen dat het loopt. Mag ik over een half jaar weer even bellen?' }] },
  { id: 'bevestig', naam: 'Afspraak bevestigen', doel: 'No-show voorkomen en de agenda scherp krijgen', scriptDoel: 'bevestigen', soort: 'bestaand', rol: 'Alle rollen', contactRollen: [],
    wanneer: 'Eén werkdag voor de afspraak, of als er meer dan twee weken tussen planning en afspraak zit.',
    blokken: [
      tb('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. Ik bel even over onze afspraak.'),
      tb('vragen', 'vragen', 'Staat de afspraak nog? Wie schuiven er aan? Wat wilt u in elk geval bespreken?'),
      tb('afsluiting', 'afsluiting', 'Fijn, dan zie ik u dan. Ik stuur de bevestiging nog even per mail.'), tb('voicemail', 'voicemail', STUDIO_VOICEMAIL),
    ],
    bezwaren: [] },
  { id: 'voicemail', naam: 'Voicemail', doel: 'Een terugbelverzoek dat aansluit op je mail', scriptDoel: 'anders', soort: 'nieuw', rol: 'Alle rollen', contactRollen: [],
    wanneer: 'Bij geen gehoor op poging twee of drie. Altijd met een mail erachteraan.',
    blokken: [
      tb('opening', 'opening', 'Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}.'),
      tb('voicemail', 'voicemail', 'Ik bel over {aanleiding.kort}. Ik mail u zo een korte toelichting. Bel gerust terug op {gebruiker.telefoon}.', 'ai_aanvullen', 'Ik mail u zo een korte toelichting. Bel gerust terug op {gebruiker.telefoon}.'),
      tb('afsluiting', 'afsluiting', 'Tot horens.'),
    ],
    bezwaren: [] },
]

/** Lengte van een template: het gesproken deel, of bij een voicemailscript de voicemail. */
export function templateLengte(t: Pick<ScriptTemplate, 'blokken'>): { woorden: number; seconden: number } {
  const gesproken = woordenVan(t)
  const vm = t.blokken.filter((b) => b.soort === 'voicemail' || b.soort === 'opening').reduce((s, b) => s + b.tekst.replace(VAR_RE, 'x').split(/\s+/).filter(Boolean).length, 0)
  const woorden = t.blokken.every((b) => ['opening', 'voicemail', 'afsluiting'].includes(b.soort)) ? vm : gesproken
  return { woorden, seconden: secondenVoor(woorden) }
}
export const TEMPLATE_FILTERS = [
  { sleutel: 'alle', label: 'Alle' },
  { sleutel: 'nieuw', label: 'Nieuw contact' },
  { sleutel: 'bestaand', label: 'Eerder contact' },
  { sleutel: 'kort', label: 'Korter dan 50 woorden' },
] as const
export type TemplateFilter = typeof TEMPLATE_FILTERS[number]['sleutel']
export function filterTemplates<T extends ScriptTemplate>(lijst: T[], filter: TemplateFilter): T[] {
  return lijst.filter((t) => filter === 'alle' || (filter === 'kort' ? templateLengte(t).woorden < 50 : t.soort === filter))
}
/** Bij welk template hoort een script (eigen template, anders de startset)? */
const STARTSET_TEMPLATE: Record<string, string> = { 'start-1': 'koud', 'start-3': 'mail', 'start-6': 'bevestig' }
export function templateVanScript(s: { startset?: string | null; data: Pick<ScriptData, 'template'> }): string | null {
  return s.data.template ?? (s.startset ? STARTSET_TEMPLATE[s.startset] ?? null : null)
}
/** Resultaat uit de eigen gesprekken; onder het minimum geen percentage. */
export function templateResultaat(r: { gesprekken: number; afspraken: number } | null | undefined, minimum = 30): { genoeg: boolean; label: string; gesprekken: number } {
  const n = r?.gesprekken ?? 0
  if (n < minimum) return { genoeg: false, gesprekken: n, label: `Nog te weinig gesprekken (${n} van ${minimum})` }
  return { genoeg: true, gesprekken: n, label: `${Math.round(((r!.afspraken) / n) * 100)}% naar afspraak · ${n} gesprekken` }
}
/** Een nieuw concept uit een template. */
export function scriptUitTemplate(t: ScriptTemplate): { naam: string; doel: ScriptDoel; data: ScriptData } {
  return { naam: t.naam, doel: t.scriptDoel, data: basisData({ contactRollen: [...t.contactRollen], blokken: t.blokken.map((b) => ({ ...b })), bezwaren: t.bezwaren.map((z) => ({ ...z })), template: t.id }) }
}

// ── Per prospect ───────────────────────────────────────────────────────────

export type ProspectBlokStatus = 'vast' | 'voorgesteld' | 'bevestigd' | 'bewerkt' | 'verworpen' | 'geen_voorstel'
export type GegevenSleutel = 'aanleiding' | 'branche' | 'leverancier' | 'winpunt' | 'rol' | 'tijden'
export interface Herkomst { sleutel: GegevenSleutel | 'script'; label: string }
export interface ProspectGegeven { sleutel: GegevenSleutel; label: string; waarde: string | null; toelichting?: string | null; bron: string; gebruikt: boolean }
export interface ProspectBlok extends ScriptBlok { voorstel?: string | null; status: ProspectBlokStatus; herkomst: Herkomst[]; vanAi: boolean }
export interface ProspectScriptData {
  scriptNaam: string
  scriptDoel: ScriptDoel
  blokken: ProspectBlok[]
  bezwaren: ScriptBezwaar[]
  gegevens: ProspectGegeven[]
  nietMeegestuurd: string[]
}
export const NIET_MEEGESTUURD = ['namen van andere contacten', 'notities', 'mails en gespreksverslagen']
const GEGEVEN_LABEL: Record<GegevenSleutel, string> = { aanleiding: 'Aanleiding', branche: 'Branche', leverancier: 'Huidige leverancier', winpunt: 'Winpunt', rol: 'Rol van het contact', tijden: 'Voorstel voor tijden' }

/** Welke gegevens gaan naar de AI, met hun bron; wat ontbreekt staat erbij met de reden. */
export function prospectGegevens(i: {
  aanleiding?: { tekst?: string | null; bron?: string | null; op?: string | null } | null
  branche?: { naam?: string | null; kernzin?: string | null; algemeen?: boolean } | null
  leverancier?: { naam?: string | null } | null
  winpunt?: { titel?: string | null; argument?: string | null } | null
  contact?: { naam?: string | null; functie?: string | null; rol?: string | null } | null
  agendaGekoppeld?: boolean
}): ProspectGegeven[] {
  const datum = i.aanleiding?.op ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(i.aanleiding.op)) : null
  const g = (sleutel: GegevenSleutel, waarde: string | null | undefined, bron: string, toelichting?: string | null): ProspectGegeven => ({ sleutel, label: GEGEVEN_LABEL[sleutel], waarde: waarde?.trim() ? waarde.trim() : null, toelichting: toelichting ?? null, bron, gebruikt: !!waarde?.trim() })
  const rol = [i.contact?.functie, i.contact?.rol && i.contact.rol !== 'onbekend' ? i.contact.rol : null].filter(Boolean).join(', ')
  return [
    g('aanleiding', i.aanleiding?.tekst, i.aanleiding?.tekst ? `Accountkaart, aanleiding${i.aanleiding.bron ? ` (${i.aanleiding.bron})` : ''}${datum ? `, ${datum}` : ''}` : 'Accountkaart: geen aanleiding'),
    g('branche', i.branche?.naam, i.branche?.naam ? 'Verkoopverhaal, branches' : 'Accountkaart: geen branche', i.branche?.kernzin ? `"${i.branche.kernzin}"${i.branche.algemeen ? ' (algemene kernzin)' : ''}` : null),
    g('leverancier', i.leverancier?.naam, i.leverancier?.naam ? 'Accountkaart, huidige leverancier en Verkoopverhaal, concurrenten' : 'Accountkaart: leverancier onbekend'),
    g('winpunt', i.winpunt?.titel, i.winpunt?.titel ? 'Verkoopverhaal, winpunten' : 'Verkoopverhaal: geen actief winpunt', i.winpunt?.argument ?? null),
    g('rol', rol || null, i.contact?.naam ? `Contactkaart ${i.contact.naam}` : 'Geen contact bij dit prospect'),
    { sleutel: 'tijden', label: GEGEVEN_LABEL.tijden, waarde: null, toelichting: null, bron: i.agendaGekoppeld ? 'Agenda: tijden bij het bellen' : 'Agenda niet gekoppeld: terugvalzin', gebruikt: false },
  ]
}

/** Per blok de gegevens waarop de AI zich baseert ("Gebaseerd op"). */
export const AI_HERKOMST: Partial<Record<BlokSoortScript, GegevenSleutel[]>> = {
  opening: ['branche', 'rol'], aanleiding: ['aanleiding'], toestemming: ['rol'], vragen: ['leverancier', 'rol'], winpunt: ['winpunt'],
  poortwachter: ['rol'], vrij: ['aanleiding', 'branche'], voicemail: ['aanleiding'], afsluiting: ['tijden'],
}
export function herkomstVoor(soort: BlokSoortScript, gegevens: ProspectGegeven[], aiBronnen: string[] = []): Herkomst[] {
  const sleutels = new Set<GegevenSleutel>([...(AI_HERKOMST[soort] ?? []), ...aiBronnen.filter((x): x is GegevenSleutel => x in GEGEVEN_LABEL)])
  const uit: Herkomst[] = gegevens.filter((x) => x.gebruikt && sleutels.has(x.sleutel)).map((x) => ({ sleutel: x.sleutel, label: x.sleutel === 'rol' ? `Rol: ${x.waarde}` : `${x.label}: ${x.waarde}` }))
  return uit.length ? uit : [{ sleutel: 'script', label: 'Standaardscript' }]
}
/** De blokken die de AI per prospect vult: alles wat niet vast is, behalve bezwaren en de opvolgmail. */
export const aiBlokkenVan = (s: Pick<Belscript, 'data'>) => s.data.blokken.filter((b) => b.invulwijze !== 'vast' && b.soort !== 'bezwaren' && b.soort !== 'opvolgmail')
const terugvalVan = (b: ScriptBlok) => (b.terugval?.trim() ? b.terugval : b.tekst)

/** Het concept na de AI-vulling: AI-blokken als voorstel met herkomst, de rest vast uit het standaardscript. */
export function prospectConcept(s: Pick<Belscript, 'naam' | 'doel' | 'data'>, gegevens: ProspectGegeven[], ai: Record<string, { tekst: string; bronnen?: string[] }>): ProspectScriptData {
  const aiIds = new Set(aiBlokkenVan(s).map((b) => b.id))
  const blokken: ProspectBlok[] = s.data.blokken.filter((b) => b.soort !== 'opvolgmail' && b.soort !== 'bezwaren').map((b) => {
    if (!aiIds.has(b.id)) return { ...b, status: 'vast', herkomst: [], vanAi: false }
    const v = ai[b.id]?.tekst?.trim()
    if (!v) return { ...b, tekst: terugvalVan(b), voorstel: null, status: 'geen_voorstel', herkomst: [], vanAi: false }
    return { ...b, terugval: terugvalVan(b), tekst: v, voorstel: v, status: 'voorgesteld', herkomst: herkomstVoor(b.soort, gegevens, ai[b.id]?.bronnen), vanAi: true }
  })
  return { scriptNaam: s.naam, scriptDoel: s.doel, blokken, bezwaren: s.data.bezwaren.map((z) => ({ ...z })), gegevens, nietMeegestuurd: NIET_MEEGESTUURD }
}
export const teBeoordelen = (blokken: Pick<ProspectBlok, 'status'>[]) => blokken.filter((b) => b.status === 'voorgesteld').length

export interface ProspectBesluit { id: string; status?: 'bevestigd' | 'verworpen' | null; tekst?: string | null }
/**
 * De beoordeling: elk AI-voorstel bevestigd (aangepaste tekst wordt "bewerkt") of verworpen
 * (dan de terugvalzin). Zonder besluit over een voorstel geen versie; nooit stil toegepast.
 */
export function beslisProspect(blokken: ProspectBlok[], besluiten: ProspectBesluit[]): { blokken: ProspectBlok[]; fouten: string[]; aangepast: number } {
  const per = new Map(besluiten.map((b) => [b.id, b]))
  let aangepast = 0
  const uit = blokken.map((b): ProspectBlok => {
    const x = per.get(b.id)
    const tekst = typeof x?.tekst === 'string' ? x.tekst.trim().slice(0, 2000) : null
    if (b.status === 'voorgesteld' || b.status === 'bevestigd' || b.status === 'bewerkt' || b.status === 'verworpen') {
      const besluit = x?.status ?? (b.status === 'voorgesteld' ? null : b.status === 'verworpen' ? 'verworpen' : 'bevestigd')
      if (!besluit) return b
      if (besluit === 'verworpen') return { ...b, status: 'verworpen', tekst: terugvalVan(b), vanAi: false }
      const nieuw = tekst || b.tekst
      const bewerkt = nieuw !== (b.voorstel ?? '').trim()
      if (bewerkt) aangepast++
      return { ...b, status: bewerkt ? 'bewerkt' : 'bevestigd', tekst: nieuw, vanAi: true }
    }
    if (tekst && tekst !== b.tekst.trim()) { aangepast++; return { ...b, tekst } }
    return b
  })
  const open = teBeoordelen(uit)
  return { blokken: uit, aangepast, fouten: open ? [`Nog ${open} AI-${open === 1 ? 'blok' : 'blokken'} te beoordelen`] : [] }
}
export function prospectSamenvatting(blokken: ProspectBlok[], aangepast: number): string {
  const ai = blokken.filter((b) => b.voorstel).length
  const weg = blokken.filter((b) => b.status === 'verworpen').length
  return [`AI-concept beoordeeld (${ai} ${ai === 1 ? 'blok' : 'blokken'})`, aangepast ? `${aangepast} aangepast` : null, weg ? `${weg} verworpen` : null].filter(Boolean).join(', ')
}

/** Een bewaarde versie als script voor de belmodus: de beoordeelde teksten, variabelen blijven variabelen. */
export function prospectVersieAlsScript(v: { id: string; versie: number; belscriptId: string; scriptVersie: number; data: ProspectScriptData }): { script: Belscript; aiBlokIds: string[]; herkomst: Record<string, Herkomst[]> } {
  const blokken: ScriptBlok[] = v.data.blokken.map((b) => ({ id: b.id, soort: b.soort, titel: b.titel, tekst: b.tekst, invulwijze: 'vast', veldKoppeling: b.veldKoppeling ?? null, terugval: null }))
  return {
    script: { id: v.belscriptId, naam: `${v.data.scriptNaam}, persoonlijk versie ${v.versie}`, doel: v.data.scriptDoel, status: 'actief', versie: v.scriptVersie, data: basisData({ blokken, bezwaren: v.data.bezwaren }) },
    aiBlokIds: v.data.blokken.filter((b) => b.status === 'bevestigd' || b.status === 'bewerkt').map((b) => b.id),
    herkomst: Object.fromEntries(v.data.blokken.filter((b) => b.vanAi).map((b) => [b.id, b.herkomst])),
  }
}
/** Een vragenblok als losse vragen (vinkjes in de belmodus). */
export const vragenUit = (tekst: string) => tekst.split(/(?<=\?)\s+/).map((x) => x.trim()).filter(Boolean)
/** Voor het voorbeeld: tekst in stukken, met per variabele of hij ingevuld of onbekend (terugvalzin) is. */
export function voorbeeldSegmenten(tekst: string, waarden: Record<string, string | null | undefined>): { tekst: string; variabele?: string; onbekend?: boolean }[] {
  const uit: { tekst: string; variabele?: string; onbekend?: boolean }[] = []
  let i = 0
  for (const m of tekst.matchAll(VAR_RE)) {
    if (m.index! > i) uit.push({ tekst: tekst.slice(i, m.index) })
    const v = m[1]!
    const w = waarden[v]
    uit.push(w != null && String(w).trim() ? { tekst: String(w), variabele: v } : { tekst: VARIABELEN[v]?.terugval ?? '', variabele: v, onbekend: true })
    i = m.index! + m[0].length
  }
  if (i < tekst.length) uit.push({ tekst: tekst.slice(i) })
  return uit
}
/** De onbekende variabelen van een script voor een prospect (de accountmanager hoort de terugvalzin). */
export function onbekendVoor(data: Pick<ScriptData, 'blokken'>, waarden: Record<string, string | null | undefined>): string[] {
  return [...new Set(data.blokken.filter((b) => b.soort !== 'opvolgmail').flatMap((b) => variabelenIn(b.tekst)).filter((v) => !(waarden[v] != null && String(waarden[v]).trim())))]
}
