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
  poortwachter: 'Poortwachter', opening: 'Opening', aanleiding: 'Aanleiding', toestemming: 'Toestemmingsvraag', vragen: 'Vragen', winpunt: 'Winpunt',
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
  const blokken = [...s.data.blokken].sort((a, b) => BLOK_VOLGORDE.indexOf(a.soort) - BLOK_VOLGORDE.indexOf(b.soort)).map((b) => {
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
}): { waarden: Record<string, string | null>; meldingen: string[]; winpuntId: string | null; concurrentId: string | null } {
  const meldingen: string[] = []
  const v = i.verhaal
  const kern = v ? kernzinVoor(v, i.account.brancheId) : { tekst: null, terugval: true }
  const bel = v ? beloftVoor(v, i.account.brancheId) : { tekst: null, terugval: true }
  if (v && kern.terugval && 'melding' in kern && kern.melding) meldingen.push(kern.melding)
  const wp = v?.winpunten ? kiesWinpunt(v.winpunten, { faseId: i.account.faseId ?? null, eerderGebruikt: i.eerderGebruikteWinpunten }) : null
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
}
