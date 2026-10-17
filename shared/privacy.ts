// Privacy en bewaartermijnen (bouwplan 15.2, F22 Data en AI). Eén bron voor het scherm
// /instellingen/privacy, de server en de tests: de termijnen die de organisatie zelf kiest, de vaste
// termijnen van Dealtrace en de onderdelen van de export van de hele organisatie.

export type BewaarSoort = 'activiteiten' | 'verslagen' | 'gedeactiveerdeProspects' | 'gearchiveerdeGebruikers'

/** Maanden per soort; null betekent: niet opschonen zolang het abonnement loopt. */
export type Bewaartermijnen = Record<BewaarSoort, number | null>

export interface BewaarDef {
  soort: BewaarSoort
  naam: string
  /** Wat er onder valt, in gewone taal. */
  uitleg: string
  /** Wat er gebeurt als de termijn verstrijkt. */
  gevolg: string
  /** Vanaf welk moment de termijn telt. */
  vanaf: string
  standaard: number | null
  keuzes: (number | null)[]
}

export const BEWAAR_SOORTEN: readonly BewaarDef[] = [
  {
    soort: 'activiteiten',
    naam: 'Activiteiten',
    uitleg: 'Gesprekken, mails, bezoeken en berichten die op een prospect of contactpersoon zijn vastgelegd, met hun uitkomst.',
    gevolg: 'De activiteit verdwijnt. De prospect zelf en de stand in de prospectreis blijven staan.',
    vanaf: 'de datum van de activiteit',
    standaard: 36,
    keuzes: [12, 24, 36, 60, null],
  },
  {
    soort: 'verslagen',
    naam: 'Verslagen',
    uitleg: 'Wat er na een gesprek of bezoek is opgeschreven of ingesproken, inclusief de verslagen die de AI voorstelde.',
    gevolg: 'De tekst van het verslag verdwijnt. De activiteit zelf blijft staan zolang die termijn loopt.',
    vanaf: 'de datum van het verslag',
    standaard: 24,
    keuzes: [6, 12, 24, 36, null],
  },
  {
    soort: 'gedeactiveerdeProspects',
    naam: 'Gedeactiveerde prospects',
    uitleg: 'Prospects die je bewust uit de lijst haalde (geen interesse, failliet, dubbel). Ze tellen nergens meer mee, maar de leadgenerator ontdubbelt er nog tegen.',
    gevolg: 'De prospect verdwijnt met zijn contactpersonen, taken en afspraken. Zo komt hij weer als nieuwe lead terug.',
    vanaf: 'de dag van deactiveren',
    standaard: 24,
    keuzes: [6, 12, 24, 36, null],
  },
  {
    soort: 'gearchiveerdeGebruikers',
    naam: 'Gearchiveerde gebruikers',
    uitleg: 'Collega\'s die niet meer met Dealtrace werken. Hun werk is bij het archiveren overgedragen.',
    gevolg: 'Naam en e-mailadres worden vervangen door "Oud-gebruiker". Wat zij deden, blijft staan zonder naam.',
    vanaf: 'de dag van archiveren',
    standaard: 12,
    keuzes: [3, 6, 12, 24, null],
  },
]

export const BEWAAR_STANDAARD: Bewaartermijnen = Object.fromEntries(BEWAAR_SOORTEN.map((d) => [d.soort, d.standaard])) as Bewaartermijnen

/** De termijnen die Dealtrace voor iedereen hanteert (bouwplan 15.2); de organisatie wijzigt ze niet. */
export const VASTE_TERMIJNEN: readonly { onderwerp: string; termijn: string; gevolg: string }[] = [
  { onderwerp: 'Contactpersonen zonder activiteit', termijn: '24 maanden na het laatste contact', gevolg: 'Gepseudonimiseerd; 30 dagen vooraf krijgt de eigenaar een melding.' },
  { onderwerp: 'Leads die niet zijn overgenomen', termijn: '60 dagen', gevolg: 'Verwijderd uit de leadgenerator.' },
  { onderwerp: 'Afgewezen leads', termijn: '120 dagen', gevolg: 'Verwijderd; alleen een gehashte sleutel blijft om dubbel benaderen te voorkomen.' },
  { onderwerp: 'Transcripten van gesprekken', termijn: '12 maanden', gevolg: 'Verwijderd. Spraakopnames verdwijnen direct na de transcriptie, tenzij je bewaren aanzet bij Organisatie.' },
  { onderwerp: 'Foto\'s bij een bezoek', termijn: '12 maanden', gevolg: 'Verwijderd.' },
  { onderwerp: 'Werk van de agents', termijn: '13 maanden', gevolg: 'Verwijderd uit het logboek van de agents.' },
  { onderwerp: 'Auditregels', termijn: '7 jaar', gevolg: 'Verwijderd. Zo lang moet je kunnen laten zien wie wat wijzigde.' },
]

/** Verwerkers waar Dealtrace een verwerkersovereenkomst mee heeft (vaste tekst, geen namen van klanten). */
export const VERWERKERS: readonly { wat: string; waar: string }[] = [
  { wat: 'Database en opslag', waar: 'In de EU, met een back-up van 7 dagen en een wekelijkse kopie in de EU.' },
  { wat: 'AI-verwerking', waar: 'Met een verwerkersovereenkomst, zonder training op jullie gegevens, in de EU waar dat kan. Privégegevens worden gemaskeerd.' },
  { wat: 'Transcriptie van spraak', waar: 'Alleen in de EU.' },
  { wat: 'Facturen en betalingen', waar: 'Bij de betaaldienst van Dealtrace; daar staan alleen de factuurgegevens.' },
]

export function isBewaarSoort(v: unknown): v is BewaarSoort {
  return typeof v === 'string' && BEWAAR_SOORTEN.some((d) => d.soort === v)
}

/** Leest een opgeslagen waarde; wat ontbreekt of niet klopt, wordt de standaard. */
export function leesBewaartermijnen(v: unknown): Bewaartermijnen {
  const uit = { ...BEWAAR_STANDAARD }
  if (!v || typeof v !== 'object') return uit
  for (const d of BEWAAR_SOORTEN) {
    const w = (v as Record<string, unknown>)[d.soort]
    if (w === null || (typeof w === 'number' && d.keuzes.includes(w))) uit[d.soort] = w
  }
  return uit
}

/** Controleert een wijziging: alleen bekende soorten met een van hun keuzes. Geeft de fouten in gewone taal. */
export function valideerBewaartermijnen(v: unknown): { waarde: Bewaartermijnen | null; fouten: string[] } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { waarde: null, fouten: ['Geef per soort een bewaartermijn'] }
  const fouten: string[] = []
  for (const k of Object.keys(v)) if (!isBewaarSoort(k)) fouten.push(`Onbekende soort: ${k}`)
  const uit = { ...BEWAAR_STANDAARD }
  for (const d of BEWAAR_SOORTEN) {
    if (!(d.soort in v)) continue
    const w = (v as Record<string, unknown>)[d.soort]
    if (w === null || (typeof w === 'number' && d.keuzes.includes(w))) uit[d.soort] = w
    else fouten.push(`${d.naam}: kies ${d.keuzes.map(termijnTekst).join(', ')}`)
  }
  return fouten.length ? { waarde: null, fouten } : { waarde: uit, fouten }
}

export function termijnTekst(maanden: number | null): string {
  if (maanden === null) return 'niet opschonen'
  if (maanden % 12 === 0) return maanden === 12 ? '1 jaar' : `${maanden / 12} jaar`
  return maanden === 1 ? '1 maand' : `${maanden} maanden`
}

/** De grens: alles van vóór deze datum vervalt bij de volgende opschoning. Rekent in UTC; een dag die in de
 * doelmaand niet bestaat (31 maart min een maand) wordt de laatste dag van die maand. */
export function grensdatum(nu: Date, maanden: number): Date {
  const j = nu.getUTCFullYear()
  const m = nu.getUTCMonth() - maanden
  const doel = new Date(Date.UTC(j, m, 1, nu.getUTCHours(), nu.getUTCMinutes(), nu.getUTCSeconds(), nu.getUTCMilliseconds()))
  const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate()
  doel.setUTCDate(Math.min(nu.getUTCDate(), laatste))
  return doel
}

/** Eén regel voor het overzicht "Wat vervalt bij de volgende opschoning". */
export function vervaltZin(def: Pick<BewaarDef, 'naam'>, maanden: number | null, aantal: number): string {
  if (maanden === null) return `${def.naam}: blijven staan, je schoont ze niet op.`
  if (!aantal) return `${def.naam}: niets ouder dan ${termijnTekst(maanden)}.`
  return `${def.naam}: ${aantal} ${aantal === 1 ? 'zou vervallen' : 'zouden vervallen'}, ouder dan ${termijnTekst(maanden)}.`
}

// ── Export van de hele organisatie ────────────────────────────────────────

/** De bestanden in de zip, in deze volgorde. De server bepaalt de kolommen; geheimen en privévelden gaan er nooit in. */
export const EXPORT_ONDERDELEN: readonly { bestand: string; naam: string }[] = [
  { bestand: 'accounts.csv', naam: 'Accounts (prospects en klanten)' },
  { bestand: 'contactpersonen.csv', naam: 'Contactpersonen' },
  { bestand: 'taken.csv', naam: 'Taken' },
  { bestand: 'afspraken.csv', naam: 'Afspraken' },
  { bestand: 'activiteiten.csv', naam: 'Activiteiten' },
  { bestand: 'verslagen.csv', naam: 'Verslagen' },
  { bestand: 'campagnes.csv', naam: 'Campagnes' },
  { bestand: 'campagne-accounts.csv', naam: 'Accounts in campagnes' },
  { bestand: 'accountplannen.csv', naam: 'Accountplannen' },
  { bestand: 'gebruikers.csv', naam: 'Gebruikers (naam, rol, team, zonder inloggegevens)' },
  { bestand: 'teams.csv', naam: 'Teams' },
  { bestand: 'instellingen.json', naam: 'Instellingen van de organisatie' },
]

/** Boven dit aantal rijen samen maakt Dealtrace de export niet in één keer (open punt: een exporttaak). */
export const EXPORT_MAX_RIJEN = 250_000

/** Een waarde als CSV-cel (puntkomma, aanhalingstekens). Een tekst die met =, +, - of @ begint, krijgt een
 * apostrof ervoor, zodat een spreadsheet hem nooit als formule uitvoert. */
export function csvCel(v: unknown): string {
  let t: string
  if (v === null || v === undefined) t = ''
  else if (v instanceof Date) t = v.toISOString()
  else if (typeof v === 'object') t = JSON.stringify(v)
  else t = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Een tabel als CSV met kop, puntkomma's en een BOM (Excel opent hem dan als UTF-8). */
export function naarCsv(kolommen: readonly string[], rijen: readonly Record<string, unknown>[]): string {
  return '﻿' + [kolommen.join(';'), ...rijen.map((r) => kolommen.map((k) => csvCel(r[k])).join(';'))].join('\r\n') + '\r\n'
}

export function exportBestandsnaam(organisatieNaam: string, nu: Date): string {
  const slug = organisatieNaam.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organisatie'
  return `dealtrace-export-${slug}-${nu.toISOString().slice(0, 10)}.zip`
}
