// Platformbeheer, klantflyout (F23, pakket C): Data en AVG, AI per klant en opzeggen. Pure regels; de server
// schrijft. AVG-verzoeken bevatten nooit persoonsgegevens: alleen een kenmerk (zoals een ticketnummer), de
// soort en de data. De beheerder van de klant handelt een verzoek van een betrokkene af in zijn eigen
// organisatie; de founder legt het vast en bewaakt de termijn van 30 dagen (bouwplan 15.2).

export const AVG_TERMIJN_DAGEN = 30
/** Na de einddatum van een opzegging kan de beheerder nog zo lang exporteren; daarna mag de data weg. */
export const BEWAREN_NA_OPZEGGEN_DAGEN = 30

export const AVG_VERZOEK_SOORTEN = ['betrokkene-verwijderen', 'betrokkene-inzage', 'organisatie-verwijderen'] as const
export type AvgVerzoekSoort = typeof AVG_VERZOEK_SOORTEN[number]
export const AVG_VERZOEK_LABEL: Record<AvgVerzoekSoort, string> = {
  'betrokkene-verwijderen': 'Betrokkene wil verwijderd worden',
  'betrokkene-inzage': 'Betrokkene wil inzage',
  'organisatie-verwijderen': 'Klant wil al zijn gegevens verwijderd',
}

export interface AvgVerzoek {
  id: string
  soort: AvgVerzoekSoort
  /** Kenmerk zonder persoonsgegevens, bijvoorbeeld het ticketnummer. */
  kenmerk: string
  ontvangenOp: string
  termijnOp: string
  status: 'open' | 'afgehandeld'
  afgehandeldOp?: string | null
  door: string
  op: string
}

export interface Verwerkersovereenkomst { versie: string; getekendOp: string; door?: string; op?: string }

export interface AvgData {
  verwerkersovereenkomst?: Verwerkersovereenkomst | null
  verzoeken?: AvgVerzoek[]
  exportGevraagdOp?: string | null
}

export type VerzoekStand = 'open' | 'over_tijd' | 'afgehandeld'

const dag = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
export const isDatum = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(dag(v).getTime()) && iso(dag(v)) === v

export function plusDagen(datum: string, dagen: number): string {
  const d = dag(datum)
  d.setUTCDate(d.getUTCDate() + dagen)
  return iso(d)
}

/** De stand van een verzoek op een dag: afgehandeld, of open tot en met de termijn, daarna over tijd. */
export function verzoekStand(v: Pick<AvgVerzoek, 'status' | 'termijnOp'>, vandaag: string): VerzoekStand {
  if (v.status === 'afgehandeld') return 'afgehandeld'
  return vandaag > v.termijnOp ? 'over_tijd' : 'open'
}

/** Nog zoveel dagen tot de termijn; negatief is over tijd. */
export function dagenTot(datum: string, vandaag: string): number {
  return Math.round((dag(datum).getTime() - dag(vandaag).getTime()) / 86_400_000)
}

/** Een kenmerk mag geen persoonsgegevens bevatten: geen e-mailadres, geen telefoonnummer, kort. Geeft de fout of null. */
export function kenmerkFout(t: unknown): string | null {
  const s = typeof t === 'string' ? t.trim() : ''
  if (!s) return 'Geef een kenmerk, bijvoorbeeld het ticketnummer'
  if (s.length > 60) return 'Houd het kenmerk kort (hooguit 60 tekens)'
  if (/@/.test(s)) return 'Geen e-mailadres in het kenmerk; gebruik het ticketnummer'
  if (/(?:\+|00)?\d[\d\s-]{8,}\d/.test(s)) return 'Geen telefoonnummer in het kenmerk; gebruik het ticketnummer'
  return null
}

/** Controleert een nieuw verzoek. Ontvangen kan niet in de toekomst liggen. */
export function valideerVerzoek(b: { soort?: unknown; kenmerk?: unknown; ontvangenOp?: unknown }, vandaag: string): string[] {
  const fouten: string[] = []
  if (!AVG_VERZOEK_SOORTEN.includes(b.soort as AvgVerzoekSoort)) fouten.push('Kies de soort verzoek')
  const k = kenmerkFout(b.kenmerk)
  if (k) fouten.push(k)
  if (!isDatum(b.ontvangenOp)) fouten.push('Geef de datum van ontvangst')
  else if (b.ontvangenOp > vandaag) fouten.push('De datum van ontvangst ligt in de toekomst')
  return fouten
}

/** Controleert een opzegging: einddatum vanaf vandaag, een reden en de naam van de organisatie letterlijk overgetypt. */
export function valideerOpzegging(b: { einddatum?: unknown; reden?: unknown; naam?: unknown }, organisatieNaam: string, vandaag: string): string[] {
  const fouten: string[] = []
  if (!isDatum(b.einddatum)) fouten.push('Kies de laatste dag van het abonnement')
  else if (b.einddatum < vandaag) fouten.push('De laatste dag ligt in het verleden')
  if (typeof b.reden !== 'string' || b.reden.trim().length < 3) fouten.push('Geef de reden van opzeggen')
  if (typeof b.naam !== 'string' || b.naam.trim() !== organisatieNaam.trim()) fouten.push('Typ de naam van de organisatie precies over')
  return fouten
}

/** De standaard einddatum: het einde van de lopende contractperiode, anders over de opzegtermijn. */
export function standaardEinddatum(c: { start?: string; looptijdMaanden?: number; opzegtermijnMaanden?: number }, vandaag: string): string {
  const termijn = c.opzegtermijnMaanden ?? 1
  const v = dag(vandaag)
  const minimaal = new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() + termijn, v.getUTCDate()))
  if (c.start && isDatum(c.start) && c.looptijdMaanden) {
    const s = dag(c.start)
    let eind = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + c.looptijdMaanden, s.getUTCDate()))
    while (eind < minimaal) eind = new Date(Date.UTC(eind.getUTCFullYear(), eind.getUTCMonth() + c.looptijdMaanden, eind.getUTCDate()))
    return plusDagen(iso(eind), -1)
  }
  return iso(minimaal)
}

/** Bronnen in gewone taal (accounts.nb_bron en leads.bron). */
export const BRON_NAAM: Record<string, string> = {
  hand: 'Met de hand', handmatig: 'Met de hand', import: 'Import', leadgenerator: 'Leadgenerator', kvk: 'KvK',
  datacollectief: 'Datacollectief', crm: 'CRM', ai: 'AI-zoeker', web: 'Website', salesdna: 'SalesDNA', seed: 'Startdata', onbekend: 'Onbekend',
}
export const bronNaam = (b: string) => BRON_NAAM[b] ?? b

/** Bytes als "1,2 MB". */
export function grootteTekst(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`
}
