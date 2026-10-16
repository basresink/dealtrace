// Accountplannen in de opzet van DealDrive: de regels die server en scherm delen. De zes blokken met hun
// uitleg, de weergavestatus (actueel, verlopen of afgerond), de voortgang van het actieplan, het label
// voor de geldigheid en de controle van de invoer. Geen Vue- of Nitro-imports.

export type AccountplanSectie = 'klantinformatie' | 'doelstellingen' | 'kansen' | 'bedreigingen' | 'strategieen' | 'evaluatie'
export type AccountplanStatus = 'actueel' | 'afgerond'
export type AccountplanWeergave = 'actueel' | 'verlopen' | 'afgerond'

/** De zes blokken in leesvolgorde; `uitleg` staat onder de kop en is de placeholder van het veld. */
export const ACCOUNTPLAN_SECTIES: readonly { sleutel: AccountplanSectie; titel: string; uitleg: string }[] = [
  { sleutel: 'klantinformatie', titel: 'Klantinformatie', uitleg: 'Branche, grootte, kernactiviteiten en de beslissers. Wie zit er aan tafel en waar verdient dit bedrijf zijn geld?' },
  { sleutel: 'doelstellingen', titel: 'Doelen (SMART)', uitleg: 'Wat wil je met deze klant bereiken? Specifiek, meetbaar, haalbaar, relevant en met een termijn.' },
  { sleutel: 'kansen', titel: 'Kansen', uitleg: 'Waar zit groei: nieuwe behoeften, andere vestigingen of afdelingen, aanvullende producten, een aanleiding die nu speelt.' },
  { sleutel: 'bedreigingen', titel: 'Bedreigingen', uitleg: 'Wat de samenwerking in de weg staat: concurrentie, budgetdruk, wisselende beslissers, ontevredenheid.' },
  { sleutel: 'strategieen', titel: 'Strategieën', uitleg: 'Hoe je de doelen haalt: welke route, welke gesprekspartners, welke argumenten en in welke volgorde.' },
  { sleutel: 'evaluatie', titel: 'Evaluatie', uitleg: 'Wat er van het plan terechtkwam en wat je bijstelt. Zo sluit je de periode af.' },
]
export const SECTIE_SLEUTELS: readonly AccountplanSectie[] = ACCOUNTPLAN_SECTIES.map((s) => s.sleutel)
export const ACTIEPLAN_UITLEG = 'Acties met een datum en een contactpersoon. Elke actie is een taak op het account, dus je ziet hem ook op de accountkaart, op Vandaag en bij Taken.'

export const WEERGAVE_LABEL: Record<AccountplanWeergave, string> = { actueel: 'Actueel', verlopen: 'Verlopen', afgerond: 'Afgerond' }

const DAG = /^\d{4}-\d{2}-\d{2}$/

/**
 * De status op het scherm. Verlopen is een afgeleid gevolg van de datum: een actueel plan waarvan de laatste
 * geldige dag voorbij is. De einddatum zelf telt nog mee. Een afgerond plan blijft afgerond.
 * @param vandaag de datum van vandaag in Nederland (yyyy-mm-dd)
 */
export function weergaveStatus(plan: { status: string; geldigTot?: string | null }, vandaag: string): AccountplanWeergave {
  if (plan.status === 'afgerond') return 'afgerond'
  if (plan.geldigTot && DAG.test(plan.geldigTot) && plan.geldigTot < vandaag) return 'verlopen'
  return 'actueel'
}

export interface Voortgang { totaal: number; klaar: number; percentage: number }

/** Voortgang van het actieplan; geannuleerde taken tellen niet mee. Een leeg plan staat op 0 procent. */
export function voortgang(acties: { status: string }[]): Voortgang {
  const lijst = acties.filter((a) => a.status !== 'geannuleerd')
  const klaar = lijst.filter((a) => a.status === 'klaar').length
  return { totaal: lijst.length, klaar, percentage: lijst.length ? Math.round((klaar / lijst.length) * 100) : 0 }
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
/** "1 jan 2026" uit een dagstring, zonder tijdzonegedoe. */
export function dagKort(dag: string | null | undefined): string {
  if (!dag || !DAG.test(dag)) return ''
  const [j, m, d] = dag.split('-').map(Number)
  return `${d} ${MAANDEN[m! - 1]} ${j}`
}

/** "1 jan 2026 t/m 31 dec 2026", "vanaf ...", "tot ..." of "geen periode vastgelegd". */
export function geldigheidLabel(plan: { geldigVan?: string | null; geldigTot?: string | null }): string {
  const van = dagKort(plan.geldigVan)
  const tot = dagKort(plan.geldigTot)
  if (van && tot) return `${van} t/m ${tot}`
  if (van) return `vanaf ${van}`
  if (tot) return `tot ${tot}`
  return 'geen periode vastgelegd'
}

/** Sortering voor het overzicht: de meest recente geldigheid eerst, dan de nieuwste. */
export function sorteerPlannen<T extends { geldigVan?: string | null; createdAt?: string | null }>(plannen: T[]): T[] {
  const sleutel = (p: T) => p.geldigVan || p.createdAt || ''
  return [...plannen].sort((a, b) => sleutel(b).localeCompare(sleutel(a)))
}

/** Het overzicht in twee groepen: Actueel en Verlopen en afgerond. */
export function groepeer<T extends { status: string; geldigTot?: string | null }>(plannen: T[], vandaag: string): { actueel: T[]; historie: T[] } {
  const actueel: T[] = []
  const historie: T[] = []
  for (const p of plannen) (weergaveStatus(p, vandaag) === 'actueel' ? actueel : historie).push(p)
  return { actueel, historie }
}

export interface PlanInvoer {
  titel?: unknown
  geldigVan?: unknown
  geldigTot?: unknown
  status?: unknown
  secties?: unknown
  contactIds?: unknown
}
export interface PlanPatch {
  titel?: string
  geldigVan?: string | null
  geldigTot?: string | null
  status?: AccountplanStatus
  secties?: Partial<Record<AccountplanSectie, string>>
  contactIds?: string[]
}

const datumOfNull = (v: unknown, veld: string, fouten: string[]): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string' || !DAG.test(v) || Number.isNaN(Date.parse(v))) { fouten.push(`${veld} is geen geldige datum`); return undefined }
  return v
}

/**
 * Controleert de invoer voor aanmaken (`nieuw`) of wijzigen. Een titel is verplicht bij aanmaken; een
 * sectie tot 8000 tekens, leeg wist het blok; de einddatum ligt niet voor de begindatum.
 */
export function controleerPlan(b: PlanInvoer, nieuw: boolean): { patch: PlanPatch; fouten: string[] } {
  const fouten: string[] = []
  const patch: PlanPatch = {}
  if (b.titel !== undefined || nieuw) {
    const t = typeof b.titel === 'string' ? b.titel.trim() : ''
    if (t.length < 3) fouten.push('Geef het plan een titel van minstens 3 tekens')
    else patch.titel = t.slice(0, 160)
  }
  const van = datumOfNull(b.geldigVan, 'Geldig van', fouten)
  const tot = datumOfNull(b.geldigTot, 'Geldig tot', fouten)
  if (van !== undefined) patch.geldigVan = van
  if (tot !== undefined) patch.geldigTot = tot
  if (van && tot && tot < van) fouten.push('Geldig tot ligt voor Geldig van')
  if (b.status !== undefined) {
    if (b.status === 'actueel' || b.status === 'afgerond') patch.status = b.status
    else fouten.push('Onbekende status')
  }
  if (b.secties !== undefined) {
    if (!b.secties || typeof b.secties !== 'object') fouten.push('Secties ontbreken')
    else {
      patch.secties = {}
      for (const [k, v] of Object.entries(b.secties as Record<string, unknown>)) {
        if (!(SECTIE_SLEUTELS as readonly string[]).includes(k)) { fouten.push(`Onbekend blok: ${k}`); continue }
        if (v !== null && typeof v !== 'string') { fouten.push(`${k} is geen tekst`); continue }
        patch.secties[k as AccountplanSectie] = (v ?? '').trim().slice(0, 8000)
      }
    }
  }
  if (b.contactIds !== undefined) {
    if (!Array.isArray(b.contactIds) || b.contactIds.some((c) => typeof c !== 'string')) fouten.push('Contactpersonen zijn ongeldig')
    else patch.contactIds = [...new Set(b.contactIds as string[])].slice(0, 50)
  }
  return { patch, fouten }
}

/** Een plan zonder tekst in een blok en zonder acties: wel aangemaakt, nog niet geschreven. */
export function isLeegPlan(secties: Partial<Record<AccountplanSectie, string>> | undefined, acties: number): boolean {
  return acties === 0 && SECTIE_SLEUTELS.every((s) => !secties?.[s]?.trim())
}
