// Accountplannen in de opzet van DealDrive: de regels die server en scherm delen. De zes blokken met hun
// uitleg, de zes stappen van het aanmaakformulier, de weergavestatus (actueel, verlopen of afgerond), de
// voortgang van het actieplan, het label voor de geldigheid, de statusfilter, de controle van de invoer
// (ook eigenaar, acties bij aanmaken, notities en eigen velden) en de AI-voorzet per blok. Geen Vue- of
// Nitro-imports.

export type AccountplanSectie = 'klantinformatie' | 'doelstellingen' | 'kansen' | 'bedreigingen' | 'strategieen' | 'evaluatie'
export type AccountplanStatus = 'actueel' | 'afgerond'
export type AccountplanWeergave = 'actueel' | 'verlopen' | 'afgerond'

/** De zes blokken in leesvolgorde; `uitleg` staat onder de kop en is de placeholder van het veld. */
export const ACCOUNTPLAN_SECTIES: readonly { sleutel: AccountplanSectie; titel: string; uitleg: string }[] = [
  { sleutel: 'klantinformatie', titel: 'Klantinformatie', uitleg: 'Branche, grootte, kernactiviteiten en de beslissers. Wie zit er aan tafel en waar verdient dit bedrijf zijn geld?' },
  { sleutel: 'doelstellingen', titel: 'Doelstellingen (SMART)', uitleg: 'Wat wil je met deze prospect bereiken? Specifiek, meetbaar, haalbaar, relevant en met een termijn.' },
  { sleutel: 'kansen', titel: 'Kansen', uitleg: 'Waar zit groei: nieuwe behoeften, andere vestigingen of afdelingen, aanvullende producten, een aanleiding die nu speelt.' },
  { sleutel: 'bedreigingen', titel: 'Bedreigingen', uitleg: 'Wat de samenwerking in de weg staat: concurrentie, budgetdruk, wisselende beslissers, ontevredenheid.' },
  { sleutel: 'strategieen', titel: 'Strategieën', uitleg: 'Hoe je de doelen haalt: welke route, welke gesprekspartners, welke argumenten en in welke volgorde.' },
  { sleutel: 'evaluatie', titel: 'Evaluatie', uitleg: 'Wat er van het plan terechtkwam en wat je bijstelt. Zo sluit je de periode af.' },
]
export const SECTIE_SLEUTELS: readonly AccountplanSectie[] = ACCOUNTPLAN_SECTIES.map((s) => s.sleutel)
export const ACTIEPLAN_UITLEG = 'Acties met een datum en een contactpersoon. Elke actie is een taak op het account, dus je ziet hem ook op de accountkaart, op Vandaag en bij Taken.'
export const CONTACTEN_LEEG = 'Nog geen contactpersonen. Wie beslist er mee, en wie heeft invloed op de beslissing?'
export const ACTIEPLAN_LEEG = 'Nog geen acties. Een strategie zonder acties met een datum blijft een voornemen.'

/**
 * De zes stappen van de methode zoals het aanmaakformulier ze toont (opzet van DealDrive): stap 3 bundelt
 * kansen en bedreigingen, stap 5 is het actieplan (een lijst en geen tekstveld, dus `velden` leeg).
 */
export const INHOUD_BLOKKEN: readonly { nr: number; titel: string; toelichting: string; velden: readonly AccountplanSectie[] }[] = [
  { nr: 1, titel: 'Informatie verzamelen', toelichting: 'Branche, grootte, kernactiviteiten en beslissers.', velden: ['klantinformatie'] },
  { nr: 2, titel: 'Doelen SMART maken', toelichting: 'Specifiek, meetbaar, haalbaar, relevant en met een termijn.', velden: ['doelstellingen'] },
  { nr: 3, titel: 'Kansen en bedreigingen', toelichting: 'Waar zit groei, en wat staat in de weg.', velden: ['kansen', 'bedreigingen'] },
  { nr: 4, titel: 'Strategie bepalen', toelichting: 'Hoe je die doelen gaat halen.', velden: ['strategieen'] },
  { nr: 5, titel: 'Actieplan', toelichting: 'Acties met een datum en een contactpersoon. Elke actie wordt een taak op het account.', velden: [] },
  { nr: 6, titel: 'Evalueren en bijstellen', toelichting: 'Wat kwam ervan terecht. Vul dit in als de periode afloopt.', velden: ['evaluatie'] },
]
export const sectieTitel = (s: AccountplanSectie) => ACCOUNTPLAN_SECTIES.find((x) => x.sleutel === s)?.titel ?? s
export const sectieUitleg = (s: AccountplanSectie) => ACCOUNTPLAN_SECTIES.find((x) => x.sleutel === s)?.uitleg ?? ''

/** De statusfilter op het overzicht (enkelvoudig, zoals in DealDrive). */
export type PlanFilter = 'alle' | AccountplanWeergave
export const PLAN_FILTERS: readonly { id: PlanFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' }, { id: 'actueel', label: 'Actueel' }, { id: 'verlopen', label: 'Verlopen' }, { id: 'afgerond', label: 'Afgerond' },
]
export const filterPlannen = <T extends { weergave: string }>(plannen: T[], f: PlanFilter): T[] => (f === 'alle' ? plannen : plannen.filter((p) => p.weergave === f))

/** Afronden zonder evaluatie is een gemiste les: het scherm vraagt eerst of het toch mag. */
export function afrondVraag(plan: { status: string; secties?: Partial<Record<AccountplanSectie, string>> }): string | null {
  if (plan.status === 'afgerond') return null
  return plan.secties?.evaluatie?.trim() ? null : 'De evaluatie is nog leeg. Een plan afronden zonder te noteren wat ervan terechtkwam, maakt de volgende periode niet wijzer.'
}

/** Waarschuwing bij een tweede actueel plan voor hetzelfde account (wel toegestaan, bijna altijd een vergissing). */
export function bestaandPlanWaarschuwing(accountNaam: string, actueel: number): string | null {
  return actueel > 0 ? `${accountNaam} heeft al een actueel accountplan. Een plan voor een volgende periode kan gewoon. Zet het oude daarna op afgerond, anders staan er twee actuele plannen naast elkaar.` : null
}

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
  eigenaarId?: unknown
  velden?: unknown
  acties?: unknown
}
export interface ActieInvoer { titel: string; datum: string | null; contactId: string | null }
export interface PlanPatch {
  titel?: string
  geldigVan?: string | null
  geldigTot?: string | null
  status?: AccountplanStatus
  secties?: Partial<Record<AccountplanSectie, string>>
  contactIds?: string[]
  eigenaarId?: string
  /** Eigen velden (object accountplan): sleutel naar waarde; null wist. Gecontroleerd tegen de definities op de server. */
  velden?: Record<string, unknown>
  /** Alleen bij aanmaken: acties die meteen een taak worden. */
  acties?: ActieInvoer[]
}

/** Eén actie uit het aanmaakformulier: titel van minstens 3 tekens, datum leeg of yyyy-mm-dd. */
export function controleerActie(a: unknown): { actie: ActieInvoer | null; fout: string | null } {
  if (!a || typeof a !== 'object') return { actie: null, fout: 'Een actie is ongeldig' }
  const r = a as Record<string, unknown>
  const titel = typeof r.titel === 'string' ? r.titel.trim() : ''
  if (titel.length < 3) return { actie: null, fout: 'Geef elke actie een titel van minstens 3 tekens' }
  const datum = typeof r.datum === 'string' && r.datum ? r.datum : null
  if (datum && (!DAG.test(datum) || Number.isNaN(Date.parse(datum)))) return { actie: null, fout: `De datum van "${titel}" is ongeldig` }
  const contactId = typeof r.contactId === 'string' && r.contactId ? r.contactId : null
  return { actie: { titel: titel.slice(0, 200), datum, contactId }, fout: null }
}

export interface PlanNotitie { id: string; tekst: string; door: string | null; doorNaam: string | null; op: string }
/** Een notitie bij het plan: 1 tot 4000 tekens. */
export function controleerNotitie(t: unknown): { tekst: string | null; fout: string | null } {
  const tekst = typeof t === 'string' ? t.trim() : ''
  if (!tekst) return { tekst: null, fout: 'Schrijf eerst een notitie' }
  return { tekst: tekst.slice(0, 4000), fout: null }
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
  if (b.eigenaarId !== undefined && b.eigenaarId !== null && b.eigenaarId !== '') {
    if (typeof b.eigenaarId !== 'string') fouten.push('Eigenaar is ongeldig')
    else patch.eigenaarId = b.eigenaarId
  }
  if (b.velden !== undefined) {
    if (!b.velden || typeof b.velden !== 'object' || Array.isArray(b.velden)) fouten.push('Eigen velden zijn ongeldig')
    else patch.velden = { ...(b.velden as Record<string, unknown>) }
  }
  if (b.acties !== undefined) {
    if (!nieuw) fouten.push('Acties voeg je los toe aan een bestaand plan')
    else if (!Array.isArray(b.acties)) fouten.push('Acties zijn ongeldig')
    else {
      const lijst: ActieInvoer[] = []
      for (const a of b.acties.slice(0, 30)) { const c = controleerActie(a); if (c.fout) fouten.push(c.fout); else lijst.push(c.actie!) }
      patch.acties = lijst
    }
  }
  return { patch, fouten }
}

/** Een plan zonder tekst in een blok en zonder acties: wel aangemaakt, nog niet geschreven. */
export function isLeegPlan(secties: Partial<Record<AccountplanSectie, string>> | undefined, acties: number): boolean {
  return acties === 0 && SECTIE_SLEUTELS.every((s) => !secties?.[s]?.trim())
}

/** Een tekst met de eerste letter als hoofdletter (meta in de kop: "Geen periode vastgelegd"). */
export const metHoofdletter = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : t)

// AI-voorzet per blok (de Pitstop, soort concept): altijd een voorstel dat de gebruiker overneemt of laat
// liggen. Alleen feiten uit het meegegeven materiaal; ontbreekt iets, dan een vraag in plaats van verzinnen.
export type VoorzetDoel = AccountplanSectie | 'actieplan'
export const VOORZET_DOELEN: readonly VoorzetDoel[] = [...SECTIE_SLEUTELS, 'actieplan']
export interface PlanVoorzet { tekst: string; acties: { titel: string; dagen: number }[]; vragen: string[] }
export const VOORZET_SCHEMA = {
  type: 'object',
  required: ['tekst', 'acties', 'vragen'],
  additionalProperties: false,
  properties: {
    tekst: { type: 'string', maxLength: 2000 },
    acties: { type: 'array', items: { type: 'object', required: ['titel', 'dagen'], additionalProperties: false, properties: { titel: { type: 'string', maxLength: 200 }, dagen: { type: 'integer' } } } },
    vragen: { type: 'array', items: { type: 'string', maxLength: 300 } },
  },
} as const
export const VOORZET_PROMPT = [
  'Je bent de Pitstop van Dealtrace en schrijft een voorzet voor één blok van een accountplan voor een topprospect.',
  'Gebruik alleen feiten uit het materiaal (account, contactpersonen met rol, recente taken, afspraken en notities, de andere blokken van het plan).',
  'Verzin geen namen, cijfers of feiten. Ontbreekt iets, zet dan een korte vraag in vragen.',
  'Schrijf in het Nederlands, in de je-vorm, kort en concreet, zonder gedachtestreepjes.',
  'Voor het blok actieplan: geef in acties hooguit vijf acties die met een werkwoord beginnen, met het aantal dagen vanaf vandaag; tekst mag dan leeg zijn.',
  'Voor de andere blokken: schrijf de tekst voor dat blok in tekst en laat acties leeg.',
].join(' ')

/** Haalt gedachtestreepjes en lege regels uit een voorzet en begrenst de acties (vijf, 1 tot 365 dagen). */
export function schoonVoorzet(v: PlanVoorzet, doel: VoorzetDoel): PlanVoorzet {
  const zonder = (t: string) => t.replace(/\s*[\u2013\u2014]\s*/g, ': ').trim()
  return {
    tekst: doel === 'actieplan' ? '' : zonder(String(v.tekst ?? '')).slice(0, 2000),
    acties: doel === 'actieplan' ? (v.acties ?? []).filter((a) => String(a.titel ?? '').trim().length >= 3).slice(0, 5).map((a) => ({ titel: zonder(a.titel).slice(0, 200), dagen: Math.min(365, Math.max(1, Math.round(Number.isFinite(Number(a.dagen)) ? Number(a.dagen) : 7))) })) : [],
    vragen: (v.vragen ?? []).map((q) => zonder(String(q))).filter(Boolean).slice(0, 3),
  }
}
