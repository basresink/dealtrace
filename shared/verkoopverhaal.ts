// Het verkoopverhaal (F25, ADR-017, ADR-018). Alle keuzes en terugvallen staan hier één keer
// (gat 16): het leesmodel (VerkoopverhaalStand) dat elke functie leest, de onderdelen van de
// eigen inrichting met hun minimale velden, de verouderingsregel, de dekking per branche, de
// winpuntkeuze, de terugkomregels en het namenfilter. De server vult het leesmodel uit de
// tabellen vv_* (alleen bevestigd); de bron (eigen inrichting of SalesDNA, P29) is onzichtbaar.
import { AFKOELING_STANDAARD, type Afkoeling, type Kanaal } from './nbStatus'

export interface Terugkomregel {
  id: string
  lijst: 'verloren' | 'slapend'
  reden: string
  termijn: string
  termijnDagen: number
  kanaal: string
  rollen: string[]
  aanpak: string
  klassen?: string[]
}

export interface Redenmapping {
  bronSoort: 'nee' | 'deal_verloren' | 'offerte_verloren' | 'slapend'
  reden: string
  terugkomregelId: string | null
}

export interface Concurrent {
  id: string; naam: string; soort: string
  zoZegJeHet?: string; alsDeKlantZegt?: string; bewijs?: string; onderscheid?: string
}
export interface VerhaalTekst { id: string; sublaag: string; sleutel: string; brancheId: string | null; tekst: string; kernzin?: string | null }
export interface Winpunt { id: string; titel: string; omschrijving: string; faseId: string | null; weging: number; onderNorm: boolean; actief: boolean; impact?: 'hoog' | 'midden' | 'laag'; concurrentIds?: string[]; waarom?: string | null }

export interface Branche { id: string; naam: string; focus: string }

export interface VerkoopverhaalStand {
  branches?: Branche[]
  /** De ambitiezin (L0.2), voor de ambitietoets bij een doelgroep. */
  ambitie?: string | null
  terugkomregels: Terugkomregel[]
  redenmapping: Redenmapping[]
  concurrenten: Concurrent[]
  /** P10: teksten (kernzin, verhaal per branche, belofte) en winpunten voor de scripts. Tot P28 uit de seed. */
  teksten?: VerhaalTekst[]
  winpunten?: Winpunt[]
  /** P11: SBI-codes en trefwoorden per branche (vv_branche_mapping), voor de leadgenerator. */
  brancheMapping?: { brancheId: string; sbiCodes: string[]; trefwoorden: string[] }[]
}

/** Kanaal uit de regel ("Telefoon", "E-mail", "Bezoek") naar het kanaal van de afkoelperiode. */
export function kanaalVanRegel(k: string | null | undefined): Kanaal {
  const t = (k ?? '').toLowerCase()
  if (t.includes('mail')) return 'mail'
  if (t.includes('bezoek')) return 'bezoek'
  if (t.includes('linkedin')) return 'linkedin'
  if (t.includes('whatsapp')) return 'whatsapp'
  if (t.includes('kaart')) return 'kaart'
  return 'bellen'
}

/** De regel die bij een reden hoort: eerst via de mapping, anders op gelijke naam. */
export function regelVoorReden(reden: string, stand: Pick<VerkoopverhaalStand, 'terugkomregels' | 'redenmapping'>, bronSoort?: Redenmapping['bronSoort']): Terugkomregel | null {
  const m = stand.redenmapping.find((x) => x.reden === reden && (!bronSoort || x.bronSoort === bronSoort))
    ?? stand.redenmapping.find((x) => x.reden === reden)
  if (m) return m.terugkomregelId ? stand.terugkomregels.find((r) => r.id === m.terugkomregelId) ?? null : null
  return stand.terugkomregels.find((r) => r.reden.toLowerCase() === reden.toLowerCase()) ?? null
}

export interface TerugkomVoorstel {
  datum: string
  dagen: number
  kanaal: Kanaal
  regel: Terugkomregel | null
  /** De datum is opgeschoven naar het einde van de afkoelperiode. */
  opgeschoven: boolean
}

const DAG = 24 * 3600 * 1000
const plusDagen = (nu: Date, d: number) => new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()) + d * DAG).toISOString().slice(0, 10)

/**
 * De terugkomdatum bij een reden. De afkoelperiode is de ondergrens: een datum
 * binnen de afkoelperiode van het kanaal uit de regel schuift op naar het einde
 * ervan. "Niet geschikt" heeft 365 dagen; zonder regel geldt de afkoelperiode
 * van bellen (voorstel).
 */
export function terugkomDatum(
  reden: string,
  stand: Pick<VerkoopverhaalStand, 'terugkomregels' | 'redenmapping'>,
  nu: Date,
  afkoeling: Partial<Afkoeling> = AFKOELING_STANDAARD,
  bronSoort?: Redenmapping['bronSoort'],
): TerugkomVoorstel {
  const regel = reden === 'Niet geschikt' ? null : regelVoorReden(reden, stand, bronSoort)
  const kanaal = regel ? kanaalVanRegel(regel.kanaal) : 'bellen'
  const af = { ...AFKOELING_STANDAARD, ...afkoeling }
  const ondergrens = reden === 'Niet geschikt' ? 365 : af[kanaal]
  const gewenst = regel ? regel.termijnDagen : ondergrens
  const dagen = Math.max(gewenst, ondergrens)
  return { datum: plusDagen(nu, dagen), dagen, kanaal, regel, opgeschoven: dagen > gewenst }
}

/** "Terug op 14 januari 2027 · Beslissing uitgesteld · e-mail met nieuwe aanleiding". */
export function terugkomTekst(datum: string, regel: Pick<Terugkomregel, 'reden' | 'aanpak'> | null): string {
  const d = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${datum}T00:00:00Z`))
  return [`Terug op ${d}`, regel?.reden, regel?.aanpak].filter(Boolean).join(' · ')
}

/** Startset uit seed/voltvast.json (Bijlage C.6, C.8 en de redenmapping). */
export function verkoopverhaalUitSeed(vv: any): VerkoopverhaalStand {
  return {
    ambitie: (vv?.vv_teksten ?? []).find((t: any) => t.sleutel === 'ambitie')?.tekst ?? null,
    branches: (vv?.vv_branches ?? []).sort((a: any, b: any) => (a.focus === 'primair' ? 0 : 1) - (b.focus === 'primair' ? 0 : 1) || a.volgorde - b.volgorde)
      .map((b: any) => ({ id: b.extern_id, naam: b.naam, focus: b.focus })),
    terugkomregels: (vv?.vv_terugkomregels ?? []).map((r: any) => ({
      id: r.extern_id, lijst: r.lijst, reden: r.reden, termijn: r.termijn, termijnDagen: r.termijn_dagen, kanaal: r.kanaal,
      rollen: r.rollen_label ?? [], aanpak: r.aanpak, klassen: r.klassen ?? [],
    })),
    redenmapping: (vv?.eigen_aanvullingen?.vv_redenmapping ?? []).map((m: any) => ({ bronSoort: m.bron_soort, reden: m.dealtrace_reden, terugkomregelId: m.terugkomregel_id })),
    concurrenten: (vv?.vv_concurrenten ?? []).map((c: any) => ({ id: c.extern_id, naam: c.concurrent, soort: c.soort_label, zoZegJeHet: c.zoZegJeHet, alsDeKlantZegt: c.alsDeKlantZegt, bewijs: c.bewijs, onderscheid: c.onderscheid })),
    teksten: (vv?.vv_teksten ?? []).map((t: any) => ({ id: t.id, sublaag: t.sublaag, sleutel: t.sleutel, brancheId: t.branche_id ?? null, tekst: t.tekst, kernzin: t.kernzin ?? null })),
    brancheMapping: (vv?.eigen_aanvullingen?.vv_branche_mapping ?? []).map((m: any) => ({ brancheId: m.branche_id, sbiCodes: m.sbi_codes ?? [], trefwoorden: m.trefwoorden ?? [] })),
    winpunten: (vv?.vv_winpunten ?? []).map((w: any) => ({
      id: w.extern_id, titel: w.titel, omschrijving: w.omschrijving, faseId: w.fase ?? null, weging: Number(w.weging ?? 1),
      onderNorm: !!w.context?.klantfeedback?.onder_norm, actief: w.actief !== false,
    })),
  }
}

// ── Leesmodel voor scripts en concepten (F25; volledig in P28) ──────────────

const eersteZin = (t: string) => (/^.*?[.!?](\s|$)/.exec(t)?.[0] ?? t).trim()

/** De kernzin van de branche, met terugval op het algemene verhaal en een melding (C.9 geval 1). */
export function kernzinVoor(stand: Pick<VerkoopverhaalStand, 'teksten'>, brancheId: string | null | undefined): { tekst: string | null; terugval: boolean; melding?: string } {
  const t = stand.teksten ?? []
  const eigen = brancheId ? t.find((x) => x.sleutel === 'verhaal' && x.brancheId === brancheId) : undefined
  if (eigen) return { tekst: eigen.kernzin || eersteZin(eigen.tekst), terugval: false }
  const alg = t.find((x) => x.sleutel === 'bedrijfsverhaal' && !x.brancheId)
  return { tekst: alg ? alg.kernzin || eersteZin(alg.tekst) : null, terugval: true, melding: brancheId ? 'Deze branche heeft nog geen eigen verhaal; het algemene verhaal geldt.' : undefined }
}

/** De belofte van de branche (kernbelofte), met terugval op de algemene. */
export function beloftVoor(stand: Pick<VerkoopverhaalStand, 'teksten'>, brancheId: string | null | undefined): { tekst: string | null; terugval: boolean; melding?: string } {
  const t = stand.teksten ?? []
  const eigen = brancheId ? t.find((x) => x.sleutel === 'kernbelofte' && x.brancheId === brancheId) : undefined
  if (eigen) return { tekst: eigen.tekst, terugval: false }
  const alg = t.find((x) => x.sleutel === 'kernbelofte' && !x.brancheId)
  return { tekst: alg?.tekst ?? null, terugval: true, melding: brancheId ? 'Deze branche heeft nog geen eigen belofte; de algemene geldt.' : undefined }
}

/**
 * Het winpunt voor een gesprek: actief, bij voorkeur van de fase, hoogste weging. Een
 * winpunt onder de norm van de klantfeedback komt nooit als eerste (C.9 geval 4). Een
 * eerder gebruikt winpunt gaat achteraan (bericht 2 gebruikt een ander, 11.5).
 */
export function kiesWinpunt(winpunten: Winpunt[], opties: { faseId?: string | null; eerderGebruikt?: string[]; concurrentId?: string | null } = {}): Winpunt | null {
  const kandidaten = winpunten.filter((w) => w.actief)
  if (!kandidaten.length) return null
  const gebruikt = new Set(opties.eerderGebruikt ?? [])
  // Eerst "Tegen wie we hier winnen" met de huidige leverancier, dan impact, dan fase (F25).
  const impact = (w: Winpunt) => (w.impact === 'hoog' ? 0 : w.impact === 'laag' ? 2 : 1)
  const sleutel = (w: Winpunt) => [w.onderNorm ? 1 : 0, gebruikt.has(w.id) ? 1 : 0, opties.concurrentId && w.concurrentIds?.includes(opties.concurrentId) ? 0 : 1, impact(w), opties.faseId && w.faseId === opties.faseId ? 0 : 1, -w.weging]
  return [...kandidaten].sort((a, b) => { const x = sleutel(a), y = sleutel(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!; return a.id.localeCompare(b.id) })[0]!
}

/** "Als de klant zegt": '"Online is het goedkoper." Antwoord: "Per stuk soms wel."' naar bezwaar en antwoord. */
export function leesAlsDeKlantZegt(t: string | null | undefined): { bezwaar: string; antwoord: string } | null {
  if (!t) return null
  const m = /^\s*"?(.+?)"?\s*Antwoord:\s*"?(.+?)"?\s*$/s.exec(t)
  return m ? { bezwaar: m[1]!.trim(), antwoord: m[2]!.trim() } : null
}

// ── Eigen inrichting (P28): onderdelen, minimale velden, verouderingsregel ─────

export const ONDERDELEN = ['golden_circle', 'bedrijfsverhaal', 'ambitie', 'waarde', 'branches', 'concurrenten', 'winpunten', 'terugkomregels'] as const
export type Onderdeel = typeof ONDERDELEN[number]
export const ONDERDEEL_LABEL: Record<Onderdeel, string> = {
  golden_circle: 'Golden circle', bedrijfsverhaal: 'Bedrijfsverhaal', ambitie: 'Ambitie en visie', waarde: 'Waarde en belofte',
  branches: 'Branches', concurrenten: 'Concurrenten', winpunten: 'Winpunten', terugkomregels: 'Terugkomregels',
}
/** Sublaagcode zoals in SalesDNA (0.4), voor de teksten in het leesmodel. */
export const SUBLAAG: Partial<Record<Onderdeel, string>> = { golden_circle: 'L0.0', bedrijfsverhaal: 'L0.1', ambitie: 'L0.2', waarde: 'L0.4', branches: 'L0.6', concurrenten: 'L0.8', winpunten: 'L2.1', terugkomregels: 'L3.14' }
export const CONCURRENT_SOORTEN = { direct: 'Direct', indirect: 'Indirect', intern: 'Intern (de klant doet het zelf)', niets: 'Niets doen' } as const
export const TERMIJNEN = [0, 30, 61, 91, 182, 365] as const
export const MAX_HOOG_IMPACT = 3

export interface ConceptBranche { id: string; naam: string; focus: 'primair' | 'secundair'; horizon?: 'huidig' | 'toekomstig'; termijn?: string | null; prioriteit?: string | null; actief?: boolean }
export interface ConceptConcurrent { id: string; naam: string; soort: keyof typeof CONCURRENT_SOORTEN; sterk?: string; zwak?: string; onderscheid?: string; zoZegJeHet?: string; alsDeKlantZegt?: string; antwoord?: string; bewijs?: string; wanneerVerliezen?: string; actief?: boolean }
export interface ConceptFase { id: string; naam: string; soort?: string; volgorde: number; reisHoofdfase?: string | null }
export interface ConceptWinpunt { id: string; faseId: string | null; titel: string; omschrijving: string; waarom?: string; impact: 'hoog' | 'midden' | 'laag'; concurrentIds?: string[]; weging?: number; context?: unknown; actief?: boolean }
export interface ConceptTerugkomregel { id: string; lijst: 'verloren' | 'slapend'; reden: string; termijn: string; termijnDagen: number; kanaal: string; klassen?: string[]; rollen?: string[]; aanpak: string; hercontactritmeId?: string | null }
export interface Concepten {
  golden_circle: { waarom?: string; hoe?: string; wat?: string }
  bedrijfsverhaal: { wieZijnWij?: string; kernzin?: string | null; perBranche?: Record<string, string> }
  ambitie: { ambitie?: string; visie?: string; missie?: string }
  waarde: { kernbelofte?: string; waardestatement?: string; perBranche?: Record<string, { kernbelofte?: string; waardestatement?: string }> }
  branches: { items: ConceptBranche[] }
  concurrenten: { items: ConceptConcurrent[] }
  winpunten: { fasen: ConceptFase[]; items: ConceptWinpunt[] }
  terugkomregels: { items: ConceptTerugkomregel[] }
}
export const LEEG_CONCEPT: Concepten = {
  golden_circle: {}, bedrijfsverhaal: {}, ambitie: {}, waarde: {}, branches: { items: [] }, concurrenten: { items: [] }, winpunten: { fasen: [], items: [] }, terugkomregels: { items: [] },
}

const leeg = (v: unknown) => v == null || (typeof v === 'string' && !v.trim())

/** Ontbrekende minimale velden voor bevestigen (F25); leeg betekent: mag bevestigd worden. */
export function ontbrekendeVelden<O extends Onderdeel>(onderdeel: O, c: Concepten[O]): string[] {
  const f: string[] = []
  const regels = <T>(items: T[] | undefined, naam: (x: T, i: number) => string, velden: [keyof T, string][]) => (items ?? []).forEach((x, i) => { for (const [k, l] of velden) if (leeg((x as any)[k])) f.push(`${naam(x, i)}: ${l}`) })
  switch (onderdeel) {
    case 'golden_circle': { const g = c as Concepten['golden_circle']; if (leeg(g.waarom)) f.push('Waarom'); if (leeg(g.hoe)) f.push('Hoe'); break }
    case 'bedrijfsverhaal': if (leeg((c as Concepten['bedrijfsverhaal']).wieZijnWij)) f.push('Wie zijn wij'); break
    case 'ambitie': if (leeg((c as Concepten['ambitie']).visie)) f.push('Visie'); break
    case 'waarde': { const w = c as Concepten['waarde']; if (leeg(w.kernbelofte)) f.push('Kernbelofte'); if (leeg(w.waardestatement)) f.push('Waardestatement'); break }
    case 'branches': { const b = c as Concepten['branches']; if (!b.items?.length) f.push('Minstens één branche'); regels(b.items, (x, i) => x.naam || `Branche ${i + 1}`, [['naam', 'naam'], ['focus', 'focus']]); break }
    case 'concurrenten': regels((c as Concepten['concurrenten']).items, (x, i) => x.naam || `Concurrent ${i + 1}`, [['naam', 'naam'], ['soort', 'soort'], ['onderscheid', 'onderscheid'], ['zoZegJeHet', 'Zo zeg je het'], ['alsDeKlantZegt', 'Als de klant zegt']]); break
    case 'winpunten': regels((c as Concepten['winpunten']).items, (x, i) => x.titel || `Winpunt ${i + 1}`, [['titel', 'titel'], ['faseId', 'fase'], ['omschrijving', 'omschrijving'], ['waarom', 'waarom wij hier winnen']]); break
    case 'terugkomregels': regels((c as Concepten['terugkomregels']).items, (x, i) => x.reden || `Regel ${i + 1}`, [['reden', 'reden'], ['termijn', 'termijn'], ['kanaal', 'kanaal'], ['aanpak', 'aanpak']]); break
  }
  return f
}
/** Hooguit drie winpunten op impact hoog. */
export const teveelHoog = (c: Concepten['winpunten']) => (c.items ?? []).filter((w) => w.impact === 'hoog' && w.actief !== false).length > MAX_HOOG_IMPACT

/** Verouderingsregel eigen inrichting: wijzigt Branches of de kernbelofte, dan Controleren op Concurrenten en Winpunten. */
export function moetControleren(onderdeel: Onderdeel, vorige?: Partial<Concepten['waarde']> | null, nieuw?: Partial<Concepten['waarde']> | null): Onderdeel[] {
  if (onderdeel === 'branches') return ['concurrenten', 'winpunten']
  if (onderdeel === 'waarde' && (vorige?.kernbelofte ?? '') !== (nieuw?.kernbelofte ?? '')) return ['concurrenten', 'winpunten']
  return []
}

const AFKORTINGEN = /\b(o\.a|bijv|b\.v|m\.b\.t|i\.p\.v|d\.w\.z|enz|o\.m|t\.o\.v|z\.s\.m|ca|nr|mr|dr|ir|ing)\.$/i
/** De eerste dragende zin; afkortingen als "o.a." sluiten geen zin af. Zonder punt de hele tekst. */
export function kernzin(tekst: string | null | undefined): string {
  const t = (tekst ?? '').replace(/\s+/g, ' ').trim()
  let start = 0
  for (let i = 0; i < t.length; i++) {
    if (!'.!?'.includes(t[i]!)) continue
    const tot = t.slice(0, i + 1)
    if (t[i] === '.' && AFKORTINGEN.test(tot)) continue
    if (i + 1 < t.length && t[i + 1] !== ' ') continue
    return tot.slice(start).trim()
  }
  return t
}

/** Dekking per branche: hoeveel branches een eigen verhaal of belofte hebben. */
export function dekking(onderdeel: 'bedrijfsverhaal' | 'waarde', stand: Pick<VerkoopverhaalStand, 'branches' | 'teksten'>): { met: number; totaal: number; tekst: string } {
  const branches = stand.branches ?? []
  const sleutel = onderdeel === 'bedrijfsverhaal' ? 'verhaal' : 'kernbelofte'
  const met = branches.filter((b) => (stand.teksten ?? []).some((t) => t.sleutel === sleutel && t.brancheId === b.id && t.tekst.trim())).length
  return { met, totaal: branches.length, tekst: `${met} van ${branches.length} branches hebben een eigen ${onderdeel === 'bedrijfsverhaal' ? 'verhaal' : 'belofte'}` }
}

/** Het verhaal voor een account: het blok van zijn branche, anders het algemene met zichtbaar gat (C.9 geval 1). */
export function verhaalVoor(account: { vvBrancheId?: string | null }, stand: Pick<VerkoopverhaalStand, 'teksten' | 'branches'>): { tekst: string | null; kernzin: string | null; brancheBlok: boolean; gat: string | null } {
  const t = stand.teksten ?? []
  const eigen = account.vvBrancheId ? t.find((x) => x.sleutel === 'verhaal' && x.brancheId === account.vvBrancheId) : undefined
  const alg = t.find((x) => x.sleutel === 'bedrijfsverhaal' && !x.brancheId)
  const br = (stand.branches ?? []).find((b) => b.id === account.vvBrancheId)
  if (eigen) return { tekst: eigen.tekst, kernzin: alg?.kernzin || kernzin(alg?.tekst), brancheBlok: true, gat: null }
  return { tekst: alg?.tekst ?? null, kernzin: alg ? alg.kernzin || kernzin(alg.tekst) : null, brancheBlok: false, gat: br ? `Voor ${br.naam} is nog geen eigen verhaal; je ziet het algemene verhaal.` : null }
}

/** Kernbelofte en waardestatement voor een account, met terugval op algemeen. */
export function beloftevoor(account: { vvBrancheId?: string | null }, stand: Pick<VerkoopverhaalStand, 'teksten' | 'branches'>): { kernbelofte: string | null; waardestatement: string | null; brancheBlok: boolean; gat: string | null } {
  const t = stand.teksten ?? []
  const vind = (sleutel: string, br: string | null) => t.find((x) => x.sleutel === sleutel && (x.brancheId ?? null) === br)?.tekst ?? null
  const b = account.vvBrancheId ?? null
  const eigen = b ? vind('kernbelofte', b) : null
  const br = (stand.branches ?? []).find((x) => x.id === b)
  return eigen
    ? { kernbelofte: eigen, waardestatement: vind('waardestatement', b) ?? vind('waardestatement', null), brancheBlok: true, gat: null }
    : { kernbelofte: vind('kernbelofte', null), waardestatement: vind('waardestatement', null), brancheBlok: false, gat: br ? `Voor ${br.naam} is nog geen eigen belofte; je ziet de algemene.` : null }
}

/** Het winpunt voor dit gesprek of het gat in de fase, met terugval op de belofte (C.9 geval 2 tot en met 4). */
export function winpuntVoor(faseId: string | null | undefined, concurrentId: string | null | undefined, stand: Pick<VerkoopverhaalStand, 'winpunten'> & { fasen?: { id: string; naam: string }[] }): { winpunt: Winpunt | null; gat: string | null } {
  const actief = (stand.winpunten ?? []).filter((w) => w.actief)
  const inFase = faseId ? actief.filter((w) => w.faseId === faseId) : actief
  const fase = stand.fasen?.find((f) => f.id === faseId)
  if (faseId && !inFase.length) return { winpunt: kiesWinpunt(actief, { concurrentId }), gat: `Geen winpunt in ${fase?.naam ?? 'deze fase'}` }
  return { winpunt: kiesWinpunt(inFase, { faseId, concurrentId }), gat: null }
}

const TUSSENVOEGSELS = /^(van|der|den|de|het|ten|ter|te|in|op|'t)$/i
/** Namenfilter (11.2): namen van contacten en klanten in vrije tekst worden de rol; een naam als deel van een woord blijft staan. */
export function filterNamen(tekst: string, namen: { naam: string; rol?: string }[]): string {
  let uit = tekst
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const n of [...namen].sort((a, b) => b.naam.length - a.naam.length)) {
    const rol = n.rol ?? 'de contactpersoon'
    const volledig = n.naam.trim()
    if (!volledig) continue
    uit = uit.replace(new RegExp(`(?<![\\p{L}])${esc(volledig)}(?![\\p{L}])`, 'giu'), rol)
    for (const deel of volledig.split(/\s+/).filter((d) => d.length >= 3 && !TUSSENVOEGSELS.test(d))) {
      uit = uit.replace(new RegExp(`(?<![\\p{L}])${esc(deel)}(?![\\p{L}])`, 'giu'), rol)
    }
  }
  return uit
}

// ── Startset (Bijlage C) en het leesmodel ─────────────────────────────────────

const SOORT_UIT_SEED: Record<string, keyof typeof CONCURRENT_SOORTEN> = { 'concurrent-direct': 'direct', 'concurrent-indirect': 'indirect', 'concurrent-intern': 'intern', 'niets-doen': 'niets' }

/** De startset (seed/voltvast.json, letterlijk) als concept per onderdeel. De golden circle staat niet in Bijlage C en blijft leeg. */
export function startsetConcepten(vv: any): Concepten {
  const perBranche = (sleutel: string) => Object.fromEntries((vv?.vv_teksten ?? []).filter((t: any) => t.sleutel === sleutel && t.branche_id).map((t: any) => [t.branche_id, t.tekst]))
  const alg = (sublaag: string, sleutel: string) => (vv?.vv_teksten ?? []).find((t: any) => t.sublaag === sublaag && t.sleutel === sleutel && !t.branche_id)
  const beloftes: Record<string, { kernbelofte?: string; waardestatement?: string }> = {}
  for (const t of (vv?.vv_teksten ?? []).filter((x: any) => x.sublaag === 'L0.4' && x.branche_id)) (beloftes[t.branche_id] ??= {})[t.sleutel as 'kernbelofte'] = t.tekst
  return {
    golden_circle: {},
    bedrijfsverhaal: { wieZijnWij: alg('L0.1', 'bedrijfsverhaal')?.tekst, kernzin: alg('L0.1', 'bedrijfsverhaal')?.kernzin ?? null, perBranche: perBranche('verhaal') },
    ambitie: { ambitie: alg('L0.2', 'ambitie')?.tekst, visie: alg('L0.2', 'visie')?.tekst, missie: alg('L0.2', 'missie')?.tekst },
    waarde: { kernbelofte: alg('L0.4', 'kernbelofte')?.tekst, waardestatement: alg('L0.4', 'waardestatement')?.tekst, perBranche: beloftes },
    branches: { items: (vv?.vv_branches ?? []).map((b: any) => ({ id: b.extern_id, naam: b.naam, focus: b.focus, horizon: b.horizon, termijn: b.termijn, prioriteit: b.prioriteit, actief: true })) },
    concurrenten: { items: (vv?.vv_concurrenten ?? []).map((c: any) => ({
      id: c.extern_id, naam: c.concurrent, soort: SOORT_UIT_SEED[c.soortConcurrent] ?? 'direct', sterk: c.sterk, zwak: c.zwak, onderscheid: c.onderscheid,
      zoZegJeHet: c.zoZegJeHet, alsDeKlantZegt: c.alsDeKlantZegt, antwoord: leesAlsDeKlantZegt(c.alsDeKlantZegt)?.antwoord, bewijs: c.bewijs, wanneerVerliezen: c.wanneerVerliezen, actief: true,
    })) },
    winpunten: {
      fasen: (vv?.vv_fasen ?? []).map((f: any) => ({ id: f.extern_id, naam: f.naam, soort: f.soort, volgorde: f.volgorde, reisHoofdfase: f.reis_hoofdfase ?? null })),
      items: (vv?.vv_winpunten ?? []).map((w: any) => ({ id: w.extern_id, faseId: w.fase ?? null, titel: w.titel, omschrijving: w.omschrijving, waarom: w.onderscheidend, impact: w.impact ?? 'midden', concurrentIds: w.concurrenten ?? [], weging: Number(w.weging ?? 1), context: w.context ?? {}, actief: w.actief !== false })),
    },
    terugkomregels: { items: (vv?.vv_terugkomregels ?? []).map((r: any) => ({ id: r.extern_id, lijst: r.lijst, reden: r.reden, termijn: r.termijn, termijnDagen: r.termijn_dagen, kanaal: r.kanaal, klassen: r.klassen ?? [], rollen: r.rollen_label ?? [], aanpak: r.aanpak, hercontactritmeId: r.hercontactritme_id ?? null })) },
  }
}

/** Eigen aanvullingen uit de startset: SBI-mapping, ambitiedoelen, redenmapping, eigen opties. */
export function startsetAanvullingen(vv: any) {
  const e = vv?.eigen_aanvullingen ?? {}
  return {
    brancheMapping: (e.vv_branche_mapping ?? []).map((m: any) => ({ brancheId: m.branche_id, sbiCodes: m.sbi_codes ?? [], trefwoorden: m.trefwoorden ?? [], doelgroepIds: m.doelgroep_ids ?? [] })),
    ambitiedoelen: (e.vv_ambitiedoelen ?? []).map((a: any) => ({ id: a.id, naam: a.naam, doel: a.doel, eenheid: a.eenheid, jaar: a.jaar ?? null, stand: a.stand ?? null })),
    redenmapping: (e.vv_redenmapping ?? []).map((m: any) => ({ bronSoort: m.bron_soort, reden: m.dealtrace_reden, terugkomregelId: m.terugkomregel_id ?? null })),
    eigenOpties: (vv?.vv_eigen_opties ?? []).map((o: any) => ({ sublaag: o.sublaag, veld: o.veld, waarde: o.waarde })),
  }
}

/** Teksten van een tekstonderdeel uit het concept, zoals ze in het leesmodel komen. */
export function tekstenUitConcept(onderdeel: 'golden_circle' | 'bedrijfsverhaal' | 'ambitie' | 'waarde', c: any): VerhaalTekst[] {
  const sub = SUBLAAG[onderdeel]!
  const t = (sleutel: string, tekst: string | undefined | null, brancheId: string | null = null, kz?: string | null): VerhaalTekst[] => (tekst?.trim() ? [{ id: `tx-${sub}-${sleutel}-${brancheId ?? 'alg'}`, sublaag: sub, sleutel, brancheId, tekst: tekst.trim(), kernzin: kz ?? null }] : [])
  switch (onderdeel) {
    case 'golden_circle': return [...t('waarom', c.waarom), ...t('hoe', c.hoe), ...t('wat', c.wat)]
    case 'bedrijfsverhaal': return [...t('bedrijfsverhaal', c.wieZijnWij, null, c.kernzin?.trim() || kernzin(c.wieZijnWij)), ...Object.entries(c.perBranche ?? {}).flatMap(([b, x]) => t('verhaal', x as string, b))]
    case 'ambitie': return [...t('ambitie', c.ambitie), ...t('visie', c.visie), ...t('missie', c.missie)]
    case 'waarde': return [...t('kernbelofte', c.kernbelofte), ...t('waardestatement', c.waardestatement), ...Object.entries(c.perBranche ?? {}).flatMap(([b, x]: [string, any]) => [...t('kernbelofte', x?.kernbelofte, b), ...t('waardestatement', x?.waardestatement, b)])]
  }
}
