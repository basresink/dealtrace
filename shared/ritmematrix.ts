// Accountmatrix en ritmes (F16). Elke standaard staat hier één keer (gat 16).
// Een matrixcel: null = "niet ingesteld" (de standaard geldt), 0 = "bewust uit"
// (geen ritmetaken), een getal = aantal per periode (gat 43).

export type AccountType = 'prospect' | 'klant'
export type Periode = 'maand' | 'kwartaal' | 'halfjaar' | 'jaar'
export const PERIODEN: Periode[] = ['maand', 'kwartaal', 'halfjaar', 'jaar']
const PER_JAAR: Record<Periode, number> = { maand: 12, kwartaal: 4, halfjaar: 2, jaar: 1 }

/** Eén cel: aantal per periode. */
export interface MatrixCel { aantal: number | null; periode: Periode }
export type Matrix = Record<string, Record<string, MatrixCel | null | undefined>>

export interface Klasse { id: string; naam: string; code?: string; omschrijving?: string; tabblad?: string; minMedewerkers?: number | null; maxMedewerkers?: number | null }

export const KLASSEN_STANDAARD: Klasse[] = [
  { id: 'A', code: 'A', naam: 'A · Corporate', omschrijving: '250 of meer medewerkers', minMedewerkers: 250, maxMedewerkers: null },
  { id: 'B', code: 'B', naam: 'B · Groot MKB', omschrijving: '50 tot 250 medewerkers', minMedewerkers: 50, maxMedewerkers: 249 },
  { id: 'C', code: 'C', naam: 'C · Middenbedrijf', omschrijving: '10 tot 50 medewerkers', minMedewerkers: 10, maxMedewerkers: 49 },
  { id: 'D', code: 'D', naam: 'D · Klein MKB', omschrijving: 'tot 10 medewerkers', minMedewerkers: 0, maxMedewerkers: 9 },
]

const c = (aantal: number, periode: Periode): MatrixCel => ({ aantal, periode })
/** Belmatrix: prospect A en B maandelijks, C per kwartaal, D per halfjaar; klant A maandelijks, B per kwartaal, C per halfjaar, D jaarlijks. */
export const BELMATRIX_STANDAARD: Matrix = {
  prospect: { A: c(1, 'maand'), B: c(1, 'maand'), C: c(1, 'kwartaal'), D: c(1, 'halfjaar') },
  klant: { A: c(1, 'maand'), B: c(1, 'kwartaal'), C: c(1, 'halfjaar'), D: c(1, 'jaar') },
}
/** Afspraakmatrix: meeting (online) en bezoek; A per kwartaal, B per halfjaar, C jaarlijks, D alleen bezoek jaarlijks. */
export const AFSPRAAKMATRIX_STANDAARD: Matrix = {
  meeting: { A: c(1, 'kwartaal'), B: c(1, 'halfjaar'), C: c(1, 'jaar'), D: c(0, 'jaar') },
  bezoek: { A: c(1, 'kwartaal'), B: c(1, 'halfjaar'), C: c(1, 'jaar'), D: c(1, 'jaar') },
}
export const CAPACITEIT_STANDAARD = { binnendienst: 40, buitendienst: 6 }
export const FREQUENTIEPLAFOND_STANDAARD = { werkdagen: 3, maxBerichten: 1 }

/** De klassecode van een klasse ("A · Aantal monteurs" geeft A). */
export function klasseCode(k: Pick<Klasse, 'code' | 'naam' | 'id'> | null | undefined): string | null {
  if (!k) return null
  if (k.code) return k.code.slice(0, 2).toUpperCase()
  const m = /^\s*([A-Za-z0-9]{1,2})\s*·/.exec(k.naam)
  return (m?.[1] ?? k.id.slice(0, 2)).toUpperCase()
}

/** Jaartotaal van een cel: null blijft null (niet ingesteld), 0 blijft 0 (bewust uit). */
export function jaartotaal(cel: MatrixCel | null | undefined): number | null {
  if (!cel || cel.aantal === null || cel.aantal === undefined) return null
  return cel.aantal * PER_JAAR[cel.periode]
}

/** Interval in dagen: 365 / jaartotaal, afgerond, minimaal 1; null bij 0 of niet ingesteld. */
export function intervalDagen(cel: MatrixCel | null | undefined): number | null {
  const j = jaartotaal(cel)
  if (!j) return null
  return Math.max(1, Math.round(365 / j))
}

export function ritmeLabel(cel: MatrixCel | null | undefined): string {
  const j = jaartotaal(cel)
  if (j === null) return 'niet ingesteld'
  if (j === 0) return 'bewust uit (0)'
  const d = intervalDagen(cel)!
  const w = Math.round(d / 7)
  const elke = d >= 14 && d < 300 ? `elke ${w} weken` : d % 7 === 0 ? `elke ${w === 1 ? 'week' : `${w} weken`}` : d >= 300 ? 'elk jaar' : `elke ${d} dagen`
  return `${j}×/jaar = ${elke}`
}

/** De cel die geldt: ingesteld (ook 0) gaat voor de standaard; "niet ingesteld" valt terug op de standaard. */
export function geldendeCel(matrix: Matrix | null | undefined, rij: string, code: string | null, standaard: Matrix): MatrixCel | null {
  if (!code) return null
  const eigen = matrix?.[rij]?.[code]
  if (eigen && eigen.aantal !== null && eigen.aantal !== undefined) return eigen
  return standaard[rij]?.[code] ?? null
}

/** Een matrix uit de instellingen, met de standaard als een cel kapot is; met waarschuwingen. */
export function leesMatrix(waarde: unknown, standaard: Matrix): { matrix: Matrix; waarschuwingen: string[] } {
  const w: string[] = []
  if (waarde === undefined || waarde === null) return { matrix: standaard, waarschuwingen: [] }
  if (typeof waarde !== 'object' || Array.isArray(waarde)) return { matrix: standaard, waarschuwingen: ['Matrix ongeldig; de standaard geldt'] }
  const uit: Matrix = {}
  for (const [rij, cellen] of Object.entries(waarde as Record<string, unknown>)) {
    if (!cellen || typeof cellen !== 'object') { w.push(`Rij ${rij} ongeldig; de standaard geldt`); continue }
    uit[rij] = {}
    for (const [k, cel] of Object.entries(cellen as Record<string, any>)) {
      if (cel === null) { uit[rij]![k] = null; continue }
      const ok = cel && typeof cel === 'object' && (cel.aantal === null || (Number.isInteger(cel.aantal) && cel.aantal >= 0 && cel.aantal <= 100)) && PERIODEN.includes(cel.periode)
      if (ok) uit[rij]![k] = { aantal: cel.aantal, periode: cel.periode }
      else w.push(`Cel ${rij} ${k} ongeldig; de standaard geldt`)
    }
  }
  return { matrix: uit, waarschuwingen: w }
}

/** Controle bij opslaan (422 bij een ongeldige matrix). */
export function valideerMatrix(waarde: unknown): string[] {
  return leesMatrix(waarde, {}).waarschuwingen
}

/**
 * Eigen velden die vroeger de omvang droegen (zoals "Aantal monteurs"). De accountmatrix rekent met het
 * generieke veld `data.medewerkers`; deze velden zijn alleen nog een terugval voor oude accounts en staan
 * niet meer in het venster Nieuwe prospect.
 */
export const OMVANG_EIGEN_VELDEN: readonly string[] = ['aantal_monteurs']

/** Klasse uit het aantal medewerkers, met de grenzen van de organisatie (anders 10, 50, 250). */
export function klasseVoorOmvang(medewerkers: number | null | undefined, klassen: Klasse[] = KLASSEN_STANDAARD): string | null {
  if (medewerkers === null || medewerkers === undefined || !Number.isFinite(medewerkers)) return null
  const metGrenzen = klassen.map((k) => {
    const s = KLASSEN_STANDAARD.find((x) => x.code === klasseCode(k))
    return { k, min: k.minMedewerkers ?? s?.minMedewerkers ?? null, max: k.maxMedewerkers ?? s?.maxMedewerkers ?? null }
  }).filter((x) => x.min !== null)
  const hit = metGrenzen.find((x) => medewerkers >= x.min! && (x.max === null || medewerkers <= x.max))
  return hit?.k.id ?? null
}

export interface AfrekenAccount { id: string; type: AccountType; klasseCode: string | null; ownerId?: string | null }
export interface AfrekenActiviteit { accountId: string; kanaal: string; op: string }

/**
 * Afrekening per account (gat 44), niet als som per klasse: hoeveel contactmomenten
 * op het voorgeschreven kanaal dit account in de periode had tegen wat de matrix vraagt.
 */
export function ritmeAfrekening(
  accounts: AfrekenAccount[], activiteiten: AfrekenActiviteit[], periode: { van: string; tot: string },
  matrix: Matrix = BELMATRIX_STANDAARD, kanaal = 'bellen',
): { accountId: string; verwacht: number; gedaan: number; stand: 'achter' | 'op schema' | 'vooruit' | 'uit' }[] {
  const dagen = Math.max(1, Math.round((Date.parse(periode.tot) - Date.parse(periode.van)) / 864e5) + 1)
  const telling = new Map<string, number>()
  for (const a of activiteiten) {
    if (a.kanaal !== kanaal || a.op.slice(0, 10) < periode.van || a.op.slice(0, 10) > periode.tot) continue
    telling.set(a.accountId, (telling.get(a.accountId) ?? 0) + 1)
  }
  return accounts.map((a) => {
    const cel = geldendeCel(matrix, a.type, a.klasseCode, a.type === 'klant' ? BELMATRIX_STANDAARD : BELMATRIX_STANDAARD)
    const j = jaartotaal(cel)
    const gedaan = telling.get(a.id) ?? 0
    if (!j) return { accountId: a.id, verwacht: 0, gedaan, stand: 'uit' as const }
    const verwacht = Math.max(1, Math.round((j * dagen) / 365))
    return { accountId: a.id, verwacht, gedaan, stand: gedaan < verwacht ? 'achter' as const : gedaan > verwacht ? 'vooruit' as const : 'op schema' as const }
  })
}
