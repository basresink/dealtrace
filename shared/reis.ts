// De prospectreis (F05, hoofdstuk 7). De standaardreis staat hier één keer
// (gat 16: één reisseed); de startset en de seed maken er een echte rij van.
// Reisregels staan alleen hier; statusregels alleen in shared/nbStatus.ts.
import type { Gebeurtenis } from './nbStatus'

export const HOOFDFASEN = ['vinden', 'bewerken', 'verbinden', 'overgedragen', 'verloren'] as const
export type Hoofdfase = typeof HOOFDFASEN[number]
export const HOOFDFASE_LABEL: Record<Hoofdfase, string> = { vinden: 'Vinden', bewerken: 'Bewerken', verbinden: 'Verbinden', overgedragen: 'Overgedragen', verloren: 'Verloren' }

export interface Fase {
  id: string
  hoofdfase: Hoofdfase
  label: string
  omschrijving: string
  volgorde: number
  /** Token-naam: zwart, geel, paars, oranje, groen, rood, grijs. */
  kleur: string
  accent: string
  verwachtVerblijfDagen?: number | null
  /** Tekst als het verblijf geen getal is ("tot de afspraak"). */
  verblijfTekst?: string
  instap?: boolean
  eind?: 'overgedragen' | 'verloren' | null
}

export interface Voorwaarde { klasse?: string[]; rol?: string[]; kanaal?: string[] }

export interface Overgang {
  id: string
  /** null = instap (bij binnenkomst). */
  vanFaseId: string | null
  gebeurtenis: Gebeurtenis
  naarFaseId: string
  voorwaarde?: Voorwaarde
  prioriteit: number
}

export interface ReisData {
  fases: Fase[]
  overgangen: Overgang[]
  overschrijvingen?: Record<string, unknown>
}

export interface ActiviteitTemplate {
  faseId: string
  naam: string
  rol: 'binnendienst' | 'buitendienst' | 'alle'
  actiesoort: 'taak' | 'bellen' | 'mail' | 'bezoek' | 'briefing' | 'pitstop' | 'overdracht' | 'terugkom'
  belscript?: string
  termijnWerkdagen: number
  uitvoerder: 'eigenaar'
  omschrijving?: string
}

// ---------------------------------------------------------------------------
// De standaardreis (F05): tien fases in vijf hoofdfases, tot en met de eerste
// afspraak en de overdracht (B17).
// ---------------------------------------------------------------------------

export const STANDAARD_FASES: Fase[] = [
  { id: 'gevonden', hoofdfase: 'vinden', label: 'Gevonden', omschrijving: 'Het account is binnengekomen; het dossier is nog niet compleet.', volgorde: 1, kleur: 'zwart', accent: 'Alleen feiten uit het dossier; geen aannames over behoefte.', verwachtVerblijfDagen: 5, instap: true },
  { id: 'dossier-compleet', hoofdfase: 'vinden', label: 'Dossier compleet', omschrijving: 'Alle criteria van het dossier hebben een oordeel.', volgorde: 2, kleur: 'zwart', accent: 'Benoem één concrete aanleiding uit het dossier.', verwachtVerblijfDagen: 5 },
  { id: 'gekwalificeerd', hoofdfase: 'bewerken', label: 'Gekwalificeerd', omschrijving: 'Het account past en mag benaderd worden.', volgorde: 3, kleur: 'geel', accent: 'Kennismaken: één reden voor contact, geen pitch.', verwachtVerblijfDagen: 10 },
  { id: 'benaderd', hoofdfase: 'bewerken', label: 'Benaderd', omschrijving: 'Er is een eerste contact geweest.', volgorde: 4, kleur: 'geel', accent: 'Verwijs naar het eerdere contact en stel één vraag.', verwachtVerblijfDagen: 21 },
  { id: 'in-gesprek', hoofdfase: 'bewerken', label: 'In gesprek', omschrijving: 'Er is echt gesproken met iemand van het account.', volgorde: 5, kleur: 'geel', accent: 'Onderscheid benoemen en vergelijkingscriteria opvragen.', verwachtVerblijfDagen: 21 },
  { id: 'afspraak-gepland', hoofdfase: 'verbinden', label: 'Afspraak gepland', omschrijving: 'De eerste afspraak staat in de agenda.', volgorde: 6, kleur: 'paars', accent: 'Bevestigen, voorbereiden: wie zit erbij, wat wil je weten, welk winpunt.', verwachtVerblijfDagen: null, verblijfTekst: 'tot de afspraak' },
  { id: 'afspraak-gehouden', hoofdfase: 'verbinden', label: 'Afspraak gehouden', omschrijving: 'De eerste afspraak is gehouden en afgerond.', volgorde: 7, kleur: 'oranje', accent: 'Behoefte, beslisser, noodzaak, draagvlak toetsen; vervolg afspreken.', verwachtVerblijfDagen: 2 },
  { id: 'overgedragen', hoofdfase: 'overgedragen', label: 'Overgedragen', omschrijving: 'Overgedragen aan DealDrive, het CRM of een collega.', volgorde: 8, kleur: 'groen', accent: 'Overdracht met briefing; de deal ontstaat in DealDrive of het CRM.', verwachtVerblijfDagen: null, verblijfTekst: 'eindfase', eind: 'overgedragen' },
  { id: 'verloren', hoofdfase: 'verloren', label: 'Verloren', omschrijving: 'Nee met reden; terug op de terugkomdatum.', volgorde: 9, kleur: 'rood', accent: 'Heropvolging over drie maanden, zonder druk.', verwachtVerblijfDagen: null, verblijfTekst: 'eindfase', eind: 'verloren' },
  { id: 'geparkeerd', hoofdfase: 'verloren', label: 'Geparkeerd', omschrijving: 'Geen reactie na de laatste poging; wacht op de terugkomdatum.', volgorde: 10, kleur: 'grijs', accent: 'Alleen bij een nieuwe aanleiding.', verwachtVerblijfDagen: null, verblijfTekst: 'tot terugkomdatum' },
]

const o = (id: string, van: string | null, g: Gebeurtenis, naar: string, prioriteit = 10): Overgang => ({ id, vanFaseId: van, gebeurtenis: g, naarFaseId: naar, prioriteit })

/**
 * Overgangen uit F05. Eén aanvulling (voorstel): "Kwalificeer" kan ook vanuit
 * Gevonden, omdat de knop daar volgens P05 al staat.
 */
export const STANDAARD_OVERGANGEN: Overgang[] = [
  o('o-instap-lead', null, 'lead-overgenomen', 'gevonden'),
  o('o-instap-import', null, 'import', 'gevonden'),
  o('o-dossier', 'gevonden', 'dossier-compleet', 'dossier-compleet'),
  o('o-kwal', 'dossier-compleet', 'gekwalificeerd', 'gekwalificeerd'),
  o('o-kwal-gevonden', 'gevonden', 'gekwalificeerd', 'gekwalificeerd', 5),
  o('o-contact', 'gekwalificeerd', 'eerste-contact', 'benaderd'),
  o('o-gesprek', 'benaderd', 'gesprek-gevoerd', 'in-gesprek'),
  o('o-afspraak-kwal', 'gekwalificeerd', 'eerste-afspraak-gepland', 'afspraak-gepland'),
  o('o-afspraak-ben', 'benaderd', 'eerste-afspraak-gepland', 'afspraak-gepland'),
  o('o-afspraak-gespr', 'in-gesprek', 'eerste-afspraak-gepland', 'afspraak-gepland'),
  o('o-gehouden', 'afspraak-gepland', 'eerste-afspraak-gehouden', 'afspraak-gehouden'),
  o('o-noshow', 'afspraak-gepland', 'afspraak-niet-verschenen', 'in-gesprek'),
  o('o-overdracht', 'afspraak-gehouden', 'overgedragen', 'overgedragen'),
  o('o-geen-vervolg', 'afspraak-gehouden', 'geen-vervolg', 'verloren'),
  o('o-park-kwal', 'gekwalificeerd', 'geparkeerd', 'geparkeerd'),
  o('o-park-ben', 'benaderd', 'geparkeerd', 'geparkeerd'),
  o('o-park-gespr', 'in-gesprek', 'geparkeerd', 'geparkeerd'),
  o('o-terug-park', 'geparkeerd', 'heropvolging', 'gekwalificeerd'),
  o('o-terug-verl', 'verloren', 'heropvolging', 'gekwalificeerd'),
]

/** Startactiviteiten per fase en rol (F05); de motor (P06) voert ze uit bij "fase betreden". */
export const STANDAARD_ACTIVITEITEN: ActiviteitTemplate[] = [
  { faseId: 'gevonden', naam: 'Dossier controleren', rol: 'alle', actiesoort: 'taak', termijnWerkdagen: 2, uitvoerder: 'eigenaar' },
  { faseId: 'dossier-compleet', naam: 'Kwalificeren met BAND-vragen in een belblok', rol: 'binnendienst', actiesoort: 'bellen', termijnWerkdagen: 2, uitvoerder: 'eigenaar' },
  { faseId: 'dossier-compleet', naam: 'Kwalificeren bij bezoek in de regio', rol: 'buitendienst', actiesoort: 'bezoek', termijnWerkdagen: 5, uitvoerder: 'eigenaar', omschrijving: 'Als het account in een regiodag valt.' },
  { faseId: 'gekwalificeerd', naam: 'Eerste belpoging', rol: 'binnendienst', actiesoort: 'bellen', belscript: 'Koude acquisitie beslisser', termijnWerkdagen: 1, uitvoerder: 'eigenaar' },
  { faseId: 'gekwalificeerd', naam: 'Kans langs de route op de volgende regiodag', rol: 'buitendienst', actiesoort: 'bezoek', termijnWerkdagen: 5, uitvoerder: 'eigenaar', omschrijving: 'Anders een belpoging.' },
  { faseId: 'benaderd', naam: 'Opvolgpoging volgens het hercontactritme', rol: 'alle', actiesoort: 'bellen', termijnWerkdagen: 3, uitvoerder: 'eigenaar' },
  { faseId: 'afspraak-gepland', naam: 'Briefing maken en afspraak bevestigen (mail)', rol: 'binnendienst', actiesoort: 'briefing', termijnWerkdagen: 1, uitvoerder: 'eigenaar' },
  { faseId: 'afspraak-gepland', naam: 'Pitstop klaarzetten op de dag van het bezoek', rol: 'buitendienst', actiesoort: 'pitstop', termijnWerkdagen: 0, uitvoerder: 'eigenaar' },
  { faseId: 'afspraak-gehouden', naam: 'Overdracht klaarzetten', rol: 'binnendienst', actiesoort: 'overdracht', termijnWerkdagen: 1, uitvoerder: 'eigenaar', omschrijving: 'Als de binnendienst de afspraak maakte.' },
  { faseId: 'afspraak-gehouden', naam: 'Afspraak afronden met verslag en overdragen binnen 24 uur', rol: 'buitendienst', actiesoort: 'overdracht', termijnWerkdagen: 1, uitvoerder: 'eigenaar' },
  { faseId: 'geparkeerd', naam: 'Terugkomtaak op de terugkomdatum', rol: 'alle', actiesoort: 'terugkom', termijnWerkdagen: 0, uitvoerder: 'eigenaar' },
]

export const STANDAARDREIS_NAAM = 'Standaardreis'

export function standaardReisData(): ReisData {
  return structuredClone({ fases: STANDAARD_FASES, overgangen: STANDAARD_OVERGANGEN, overschrijvingen: {} })
}

export const standaardReisId = (org: string) => `reis-standaard-${org}`

// ---------------------------------------------------------------------------
// Doelgroepen en toewijzing
// ---------------------------------------------------------------------------

export interface DoelgroepData {
  omschrijving?: string
  sbi?: string[]
  brancheIds?: string[]
  klassen?: string[]
  omvang?: { min?: number | null; max?: number | null }
  gebiedIds?: string[]
  postcodes?: string[]
  bron?: 'koud' | 'warm' | 'referral' | 'winback' | null
  eigenVeldFilters?: { sleutel: string; vergelijking: 'is' | 'niet' | 'min' | 'max' | 'bevat'; waarde: unknown }[]
  uitsluitingen?: { segmenten?: string[]; tags?: string[] }
  geschatteOmvang?: number
  ambitieToets?: 'ja' | 'deels' | 'nee'
}

export interface Doelgroep {
  id: string
  naam: string
  status: 'concept' | 'actief' | 'gearchiveerd'
  prioriteit: number
  data: DoelgroepData
}

export interface ReisKeuze { id: string; doelgroepId: string | null; isStandaard: boolean; status: string }

/** Wat de doelgroepfilters van een account nodig hebben. */
export interface DoelgroepAccount {
  sbi?: string[]
  vvBrancheId?: string | null
  klasse?: string | null
  medewerkers?: number | null
  postcode?: string | null
  gebiedId?: string | null
  bron?: string | null
  segment?: string | null
  tags?: string[]
  cf?: Record<string, unknown>
}

export const BRON_SOORT: Record<string, string> = { import: 'koud', leadgenerator: 'koud', handmatig: 'koud', kvk: 'koud', referral: 'referral', signaal: 'warm', beurs: 'warm', crm: 'winback', dealdrive: 'winback' }

/** Past het account in de doelgroep? Lege filters tellen niet; alle gevulde filters moeten kloppen. */
export function pastInDoelgroep(a: DoelgroepAccount, d: Pick<Doelgroep, 'data'>): boolean {
  const f = d.data ?? {}
  const sbiOk = !f.sbi?.length || (a.sbi ?? []).some((s) => f.sbi!.some((p) => s.startsWith(p)))
  const brancheOk = !f.brancheIds?.length || (!!a.vvBrancheId && f.brancheIds.includes(a.vvBrancheId))
  // SBI en branche zijn twee manieren om de branche te noemen: één van beide volstaat.
  if (f.sbi?.length && f.brancheIds?.length) { if (!sbiOk && !brancheOk) return false } else if (!sbiOk || !brancheOk) return false
  if (f.klassen?.length && (!a.klasse || !f.klassen.includes(a.klasse))) return false
  if (f.omvang && (f.omvang.min != null || f.omvang.max != null)) {
    const m = a.medewerkers
    if (m == null) return false
    if (f.omvang.min != null && m < f.omvang.min) return false
    if (f.omvang.max != null && m > f.omvang.max) return false
  }
  if (f.postcodes?.length) {
    const pc = (a.postcode ?? '').replace(/\s/g, '')
    if (!pc || !f.postcodes.some((p) => pastPostcode(pc, p))) return false
  }
  if (f.gebiedIds?.length && (!a.gebiedId || !f.gebiedIds.includes(a.gebiedId))) return false
  if (f.bron && (BRON_SOORT[a.bron ?? ''] ?? 'koud') !== f.bron) return false
  for (const e of f.eigenVeldFilters ?? []) {
    const v = a.cf?.[e.sleutel]
    const n = Number(v)
    switch (e.vergelijking) {
      case 'is': if (String(v ?? '') !== String(e.waarde)) return false; break
      case 'niet': if (String(v ?? '') === String(e.waarde)) return false; break
      case 'min': if (v == null || Number.isNaN(n) || n < Number(e.waarde)) return false; break
      case 'max': if (v == null || Number.isNaN(n) || n > Number(e.waarde)) return false; break
      case 'bevat': if (!(Array.isArray(v) ? v.map(String).includes(String(e.waarde)) : String(v ?? '').toLowerCase().includes(String(e.waarde).toLowerCase()))) return false; break
    }
  }
  const u = f.uitsluitingen ?? {}
  if (u.segmenten?.length && a.segment && u.segmenten.includes(a.segment)) return false
  if (u.tags?.length && (a.tags ?? []).some((t) => u.tags!.includes(t))) return false
  return true
}

/** "38" past op 3811AB; "3800-3899" is een reeks op de cijfers. */
function pastPostcode(pc: string, p: string): boolean {
  const r = /^(\d{4})-(\d{4})$/.exec(p.trim())
  if (r) { const n = Number(pc.slice(0, 4)); return n >= Number(r[1]) && n <= Number(r[2]) }
  return pc.toUpperCase().startsWith(p.replace(/\s/g, '').toUpperCase())
}

/**
 * De reis bij binnenkomst: de eerste actieve doelgroep op prioriteit (laagste
 * getal eerst) waarin het account past en die een actieve reis heeft; anders de standaardreis.
 */
export function kiesReis(account: DoelgroepAccount, doelgroepen: Doelgroep[], reizen: ReisKeuze[]): string | null {
  const actief = doelgroepen.filter((d) => d.status === 'actief').sort((a, b) => a.prioriteit - b.prioriteit || a.naam.localeCompare(b.naam))
  for (const d of actief) {
    if (!pastInDoelgroep(account, d)) continue
    const r = reizen.find((x) => x.doelgroepId === d.id && x.status === 'actief')
    if (r) return r.id
  }
  return reizen.find((r) => r.isStandaard && r.status === 'actief')?.id ?? null
}

/** De doelgroep waarin het account valt (voor de teller en voor doelgroep_id), ook zonder eigen reis. */
export function kiesDoelgroep(account: DoelgroepAccount, doelgroepen: Doelgroep[]): string | null {
  return doelgroepen.filter((d) => d.status === 'actief').sort((a, b) => a.prioriteit - b.prioriteit).find((d) => pastInDoelgroep(account, d))?.id ?? null
}

// ---------------------------------------------------------------------------
// Fasewissel, validatie en verblijf
// ---------------------------------------------------------------------------

export interface FaseContext { klasse?: string | null; rol?: string | null; kanaal?: string | null }

function voorwaardeKlopt(v: Voorwaarde | undefined, c: FaseContext): boolean {
  if (!v) return true
  if (v.klasse?.length && (!c.klasse || !v.klasse.includes(c.klasse))) return false
  if (v.rol?.length && (!c.rol || !v.rol.includes(c.rol))) return false
  if (v.kanaal?.length && (!c.kanaal || !v.kanaal.includes(c.kanaal))) return false
  return true
}

/**
 * De fase na een gebeurtenis: de overgang met de hoogste prioriteit (hoogste getal)
 * waarvan de voorwaarde klopt; hoogstens één wissel per gebeurtenis. null = geen wissel.
 * faseId null betekent: nog niet in de reis (instap).
 */
export function volgendeFase(template: ReisData, faseId: string | null, gebeurtenis: Gebeurtenis, context: FaseContext = {}): string | null {
  const kandidaten = template.overgangen
    .filter((x) => x.vanFaseId === faseId && x.gebeurtenis === gebeurtenis && voorwaardeKlopt(x.voorwaarde, context))
    .sort((a, b) => b.prioriteit - a.prioriteit)
  const naar = kandidaten[0]?.naarFaseId ?? null
  return naar && naar !== faseId && template.fases.some((f) => f.id === naar) ? naar : null
}

export function instapFase(template: ReisData, gebeurtenis: Gebeurtenis = 'import'): string | null {
  return volgendeFase(template, null, gebeurtenis) ?? template.fases.find((f) => f.instap)?.id ?? null
}

export function fase(template: ReisData, faseId: string | null | undefined): Fase | undefined {
  return template.fases.find((f) => f.id === faseId)
}

export function valideerReis(template: ReisData): { fouten: string[]; waarschuwingen: string[]; informatie: string[] } {
  const fouten: string[] = []
  const waarschuwingen: string[] = []
  const informatie: string[] = []
  const ids = new Set<string>()
  const namen = new Set<string>()
  for (const f of template.fases) {
    if (!f.label?.trim()) fouten.push(`Fase ${f.id} heeft geen naam`)
    else if (namen.has(f.label.trim().toLowerCase())) fouten.push(`Fasenaam "${f.label}" komt twee keer voor`)
    namen.add(f.label?.trim().toLowerCase())
    if (ids.has(f.id)) fouten.push(`Fase-id ${f.id} komt twee keer voor`)
    ids.add(f.id)
    if (!(HOOFDFASEN as readonly string[]).includes(f.hoofdfase)) fouten.push(`Fase "${f.label}" heeft geen geldige hoofdfase`)
  }
  for (const x of template.overgangen) {
    if (x.vanFaseId !== null && !ids.has(x.vanFaseId)) fouten.push(`Overgang ${x.id} start in een onbekende fase`)
    if (!ids.has(x.naarFaseId)) fouten.push(`Overgang ${x.id} gaat naar een onbekende fase`)
    if (x.vanFaseId === x.naarFaseId) fouten.push(`Overgang ${x.id} gaat naar dezelfde fase`)
  }
  const instap = template.fases.filter((f) => f.instap || template.overgangen.some((x) => x.vanFaseId === null && x.naarFaseId === f.id))
  if (!instap.length) fouten.push('Er is geen instapfase')
  if (!template.fases.some((f) => f.eind === 'overgedragen')) fouten.push('Er is geen eindfase overgedragen')
  if (!template.fases.some((f) => f.eind === 'verloren')) fouten.push('Er is geen eindfase verloren')
  for (const f of template.fases) {
    const bereikbaar = instap.includes(f) || template.overgangen.some((x) => x.naarFaseId === f.id && x.vanFaseId !== null)
    if (!bereikbaar) waarschuwingen.push(`Fase onbereikbaar: ${f.label}`)
    const uitweg = template.overgangen.some((x) => x.vanFaseId === f.id)
    if (!uitweg && !f.eind) waarschuwingen.push(`Doodlopende fase: ${f.label}`)
    const gebruikt = new Set(template.overgangen.filter((x) => x.vanFaseId === f.id).map((x) => x.gebeurtenis))
    if (!f.eind && !gebruikt.size) informatie.push(`Gebeurtenis zonder overgang in ${f.label}`)
  }
  return { fouten, waarschuwingen, informatie }
}

export interface Afspraak { id: string; status: 'gepland' | 'gehouden' | 'geannuleerd' | 'niet-verschenen'; op: string }

/**
 * Is deze afspraak de eerste afspraak met de prospect (gat 3)? Geannuleerde en
 * niet-verschenen afspraken tellen niet mee; een tweede afspraak geeft false.
 */
export function isEersteAfspraak(afspraakId: string, afspraken: Afspraak[]): boolean {
  const geldig = afspraken.filter((x) => x.status === 'gepland' || x.status === 'gehouden').sort((a, b) => a.op.localeCompare(b.op) || a.id.localeCompare(b.id))
  return geldig[0]?.id === afspraakId
}

const DAG = 24 * 3600 * 1000

export function dagenInFase(account: { faseSinds?: string | null }, nu: Date): number | null {
  if (!account.faseSinds) return null
  return Math.max(0, Math.floor((nu.getTime() - Date.parse(account.faseSinds)) / DAG))
}

/** Verwacht verblijf overschreden? Een eindfase of een fase zonder getal nooit. */
export function verblijfOverschreden(account: { faseSinds?: string | null }, f: Fase | undefined, nu: Date): boolean {
  if (!f || f.eind || f.verwachtVerblijfDagen == null) return false
  const d = dagenInFase(account, nu)
  return d !== null && d > f.verwachtVerblijfDagen
}

/** Overschrijft alleen de accenten van de fases; andere velden blijven gelijk. */
export function pasAccentenToe(data: ReisData, accenten: { id: string; accent: string }[]): ReisData {
  const nieuw = structuredClone(data)
  for (const a of accenten) {
    const f = nieuw.fases.find((x) => x.id === a.id)
    if (f) f.accent = String(a.accent ?? '').slice(0, 300)
  }
  return nieuw
}

/** Startfase voor een account dat al een status had voordat de reis bestond (migratie en seed). */
export function faseVoorStatus(status: string): string | null {
  switch (status) {
    case 'nieuw': return 'gevonden'
    case 'in reis': return 'gekwalificeerd'
    case 'wachtend': return 'geparkeerd'
    case 'nee': return 'verloren'
    case 'gescoord': return 'afspraak-gepland'
    case 'overgedragen': return 'overgedragen'
    default: return null
  }
}
