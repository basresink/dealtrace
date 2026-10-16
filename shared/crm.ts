// CRM-koppeling (P20, F02, hoofdstuk 12): veldtoewijzing, conflictregel, eigenaarsregel, het
// schrijfplan en de overdracht naar het CRM. Pure functies; de adapters staan in server/utils/bronnen/crm.
// Dealtrace schrijft geen deals of offertes; die maakt het CRM zelf (B17, ADR-021).
import { BRONNEN, type Bron } from './herkomst'
import type { LeadContact, LeadFeiten } from './leadGenerator'

export const CRM_SOORTEN = ['hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas'] as const
export type CrmSoort = typeof CRM_SOORTEN[number]
export const CRM_LABEL: Record<CrmSoort, string> = { hubspot: 'HubSpot', salesforce: 'Salesforce', dynamics: 'Microsoft Dynamics', pipedrive: 'Pipedrive', afas: 'AFAS' }
/** Alleen HubSpot is beschikbaar; de rest volgt via dezelfde interface (open vraag 8). */
export const CRM_BESCHIKBAAR: CrmSoort[] = ['hubspot']

export const CRM_OBJECTEN = ['bedrijven', 'contacten', 'activiteiten'] as const
export type CrmObject = typeof CRM_OBJECTEN[number]
export const OBJECT_LABEL: Record<CrmObject, string> = { bedrijven: 'Bedrijven', contacten: 'Contacten', activiteiten: 'Activiteiten' }
export type Richting = 'lezen' | 'schrijven' | 'beide'
export const RICHTING_LABEL: Record<Richting, string> = { lezen: 'Lezen', schrijven: 'Schrijven', beide: 'Beide' }
/** Eerst lezen, dan schrijven (risico 21): een nieuwe koppeling leest alleen. */
export const RICHTING_STANDAARD: Record<CrmObject, Richting> = { bedrijven: 'lezen', contacten: 'lezen', activiteiten: 'lezen' }
export const magLezen = (r: Richting | undefined) => r !== 'schrijven'
export const magSchrijven = (r: Richting | undefined) => r === 'schrijven' || r === 'beide'

/** Velden in Dealtrace waar een CRM-veld op kan landen; eigen velden als cf:<sleutel>. */
export const DEALTRACE_VELDEN: Record<'bedrijven' | 'contacten', Record<string, string>> = {
  bedrijven: {
    naam: 'Naam', kvk: 'KvK-nummer', domein: 'Website', telefoon: 'Telefoon', plaats: 'Plaats', postcode: 'Postcode', adres: 'Adres',
    medewerkers: 'Aantal medewerkers', soort: 'Klant of prospect', laatsteOrder: 'Laatste order', dealstatus: 'Dealstatus', omzet: 'Omzet (centen)',
  },
  contacten: { voornaam: 'Voornaam', achternaam: 'Achternaam', email: 'E-mail', telefoon: 'Telefoon', functie: 'Functie' },
}
export interface Toewijzing { crmVeld: string; veld: string }
export const TOEWIJZING_STANDAARD: Record<'bedrijven' | 'contacten', Toewijzing[]> = {
  bedrijven: [
    { crmVeld: 'name', veld: 'naam' }, { crmVeld: 'kvk_nummer', veld: 'kvk' }, { crmVeld: 'domain', veld: 'domein' }, { crmVeld: 'phone', veld: 'telefoon' },
    { crmVeld: 'city', veld: 'plaats' }, { crmVeld: 'zip', veld: 'postcode' }, { crmVeld: 'address', veld: 'adres' }, { crmVeld: 'numberofemployees', veld: 'medewerkers' },
    { crmVeld: 'lifecyclestage', veld: 'soort' }, { crmVeld: 'laatste_order', veld: 'laatsteOrder' }, { crmVeld: 'dealstatus', veld: 'dealstatus' },
  ],
  contacten: [
    { crmVeld: 'firstname', veld: 'voornaam' }, { crmVeld: 'lastname', veld: 'achternaam' }, { crmVeld: 'email', veld: 'email' }, { crmVeld: 'phone', veld: 'telefoon' }, { crmVeld: 'jobtitle', veld: 'functie' },
  ],
}
export const toewijzingFouten = (object: 'bedrijven' | 'contacten', t: Toewijzing[], eigenVelden: string[] = []) =>
  t.filter((x) => !(x.veld in DEALTRACE_VELDEN[object]) && !(x.veld.startsWith('cf:') && eigenVelden.includes(x.veld.slice(3)))).map((x) => `Onbekend Dealtrace-veld: ${x.veld}`)

const leeg = (v: unknown) => v == null || (typeof v === 'string' && !v.trim())
/** Geld naar centen: "1.250,50", "1250.5" of een getal. */
export function naarCenten(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : undefined
  const s = String(v ?? '').replace(/[€\s]/g, '')
  if (!s) return undefined
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : undefined
}
/** Lifecyclestage naar soort: customer wordt klant, de rest prospect (instelbaar via de toewijzing). */
export const soortUitLifecycle = (v: unknown): 'klant' | 'prospect' => (String(v ?? '').toLowerCase() === 'customer' ? 'klant' : 'prospect')

/**
 * Een CRM-record naar velden van Dealtrace met herkomst crm. Een lege CRM-waarde wordt undefined
 * (niet wissen); geld naar centen; onbekende velden worden genegeerd.
 */
export function pasToewijzingToe(record: Record<string, unknown>, toewijzing: Toewijzing[], object: 'bedrijven' | 'contacten', op: string): { velden: Record<string, unknown>; herkomst: Record<string, { bron: 'crm'; op: string }> } {
  const velden: Record<string, unknown> = {}
  const herkomst: Record<string, { bron: 'crm'; op: string }> = {}
  for (const t of toewijzing) {
    if (!(t.veld in DEALTRACE_VELDEN[object]) && !t.veld.startsWith('cf:')) continue
    const v = record[t.crmVeld]
    if (leeg(v)) continue
    let w: unknown = typeof v === 'string' ? v.trim() : v
    if (t.veld === 'omzet') w = naarCenten(v)
    else if (t.veld === 'medewerkers') { const n = Number(v); w = Number.isFinite(n) ? Math.round(n) : undefined }
    else if (t.veld === 'soort') w = soortUitLifecycle(v)
    else if (t.veld === 'domein') w = String(v).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    if (w === undefined) continue
    velden[t.veld] = w
    herkomst[t.veld] = { bron: 'crm', op }
  }
  return { velden, herkomst }
}

/**
 * De conflictregel (10.1): hand boven kvk boven datacollectief boven crm boven salesdna boven web boven
 * ai boven import. Gelijke bron: de nieuwste wint. Ontbrekende herkomst telt als import. Wat niet mag,
 * gaat naar de lijst afgewezen (het log), nooit stil.
 */
export function losConflictOp(huidig: Record<string, { waarde: unknown; herkomst?: { bron?: string; op?: string } | null }>, patch: { velden: Record<string, unknown>; herkomst: Record<string, { bron: string; op: string }> }): { toepassen: Record<string, unknown>; afgewezen: { veld: string; huidig: unknown; crm: unknown; bron: string }[] } {
  const toepassen: Record<string, unknown> = {}
  const afgewezen: { veld: string; huidig: unknown; crm: unknown; bron: string }[] = []
  for (const [veld, nieuw] of Object.entries(patch.velden)) {
    const h = huidig[veld]
    const nb = patch.herkomst[veld]?.bron ?? 'crm'
    if (!h || leeg(h.waarde)) { toepassen[veld] = nieuw; continue }
    if (h.waarde === nieuw) continue
    const oud = (h.herkomst?.bron ?? 'import') as Bron
    const io = BRONNEN.indexOf(oud)
    const inw = BRONNEN.indexOf(nb as Bron)
    const wint = nb === 'hand' || inw < io || (inw === io && (patch.herkomst[veld]?.op ?? '') >= (h.herkomst?.op ?? ''))
    if (wint && oud !== 'hand') toepassen[veld] = nieuw
    else afgewezen.push({ veld, huidig: h.waarde, crm: nieuw, bron: oud })
  }
  return { toepassen, afgewezen }
}

/** De eigenaarsregel: CRM-eigenaar naar gebruiker op e-mailadres, zonder hoofdlettergevoeligheid. */
export function eigenaarVoor(crmEmail: string | null | undefined, gebruikers: { id: string; email: string | null }[], terugval: string | null): { id: string | null; gevonden: boolean } {
  const e = String(crmEmail ?? '').trim().toLowerCase()
  const g = e ? gebruikers.find((u) => (u.email ?? '').trim().toLowerCase() === e) : undefined
  return g ? { id: g.id, gevonden: true } : { id: terugval, gevonden: false }
}

export interface CrmBedrijf { id: string; eigenaar?: string | null; velden: Record<string, unknown> }
export interface CrmContact { id: string; bedrijfId?: string | null; velden: Record<string, unknown> }

/** Een CRM-bedrijf als lead in de leadstroom (F02): zelfde structuur als de andere bronnen. */
export function crmNaarLead(b: CrmBedrijf, contacten: CrmContact[], toewijzing: { bedrijven: Toewijzing[]; contacten: Toewijzing[] }, op: string): LeadFeiten {
  const { velden: v, herkomst } = pasToewijzingToe(b.velden, toewijzing.bedrijven, 'bedrijven', op)
  const domeinen = String(v.domein ?? '').split(/[;,\s]+/).filter(Boolean)
  const domein = domeinen[0] ?? null
  const cs: LeadContact[] = contacten.filter((c) => c.bedrijfId === b.id).map((c) => {
    const x = pasToewijzingToe(c.velden, toewijzing.contacten, 'contacten', op).velden
    return { naam: [x.voornaam, x.achternaam].filter(Boolean).join(' ') || String(x.email ?? 'Onbekend'), functie: (x.functie as string) ?? null, email: (x.email as string) ?? null, telefoon: (x.telefoon as string) ?? null, linkedin: null, bron: 'crm' } as LeadContact
  })
  const h = Object.fromEntries(Object.entries(herkomst).map(([k, w]) => [k === 'domein' ? 'website' : k, w]))
  return {
    naam: String(v.naam ?? 'Onbekend bedrijf'), kvk: (v.kvk as string) ?? null, domein, website: domein ? `https://${domein}` : null,
    plaats: (v.plaats as string) ?? null, postcode: (v.postcode as string) ?? null, adres: (v.adres as string) ?? null, medewerkers: (v.medewerkers as number) ?? null, sbi: [],
    contacten: cs, herkomst: h,
  }
}

const DAG = 864e5
/** Slapend: geen order in 3, 6 of 12 maanden. Op de grensdag nog niet; zonder datum niet te beoordelen. */
export function isSlapend(laatsteOrder: string | null | undefined, nu: Date, maanden: 3 | 6 | 12): boolean {
  if (!laatsteOrder || Number.isNaN(Date.parse(laatsteOrder))) return false
  const grens = new Date(nu.getTime())
  grens.setUTCMonth(grens.getUTCMonth() - maanden)
  return Math.floor(Date.parse(laatsteOrder) / DAG) < Math.floor(grens.getTime() / DAG)
}

export interface CrmGebeurtenis { soort: 'bedrijf' | 'contact' | 'activiteit'; id: string; accountId: string; externBedrijf?: string | null; extern?: string | null }
export interface Schrijfactie { soort: CrmGebeurtenis['soort']; id: string; accountId: string }
/** Wat er naar het CRM moet: alleen met schrijfrecht per object, elk record één keer, en niets wat al een extern id heeft. */
export function schrijfplan(gebeurtenissen: CrmGebeurtenis[], richting: Partial<Record<CrmObject, Richting>>): Schrijfactie[] {
  const object: Record<CrmGebeurtenis['soort'], CrmObject> = { bedrijf: 'bedrijven', contact: 'contacten', activiteit: 'activiteiten' }
  const gezien = new Set<string>()
  const uit: Schrijfactie[] = []
  const volgorde = { bedrijf: 0, contact: 1, activiteit: 2 }
  for (const g of [...gebeurtenissen].sort((a, b) => volgorde[a.soort] - volgorde[b.soort])) {
    if (!magSchrijven(richting[object[g.soort]]) || g.extern) continue
    // Een contact of activiteit kan pas als het bedrijf in het CRM staat of in dit plan meegaat.
    if (g.soort !== 'bedrijf' && !g.externBedrijf && !uit.some((u) => u.soort === 'bedrijf' && u.accountId === g.accountId)) continue
    const k = `${g.soort}:${g.id}`
    if (gezien.has(k)) continue
    gezien.add(k)
    uit.push({ soort: g.soort, id: g.id, accountId: g.accountId })
  }
  return uit
}

/** De overdracht als CRM-activiteit met de briefing en een bedrijfspatch; geen deal (B17). Idempotent op het overdracht-id. */
export function overdrachtNaarCrm(pakket: Record<string, any>, opties: { bedrijfExtern: string | null; eigenaarEmail?: string | null }): { activiteit: { sleutel: string; onderwerp: string; tekst: string; datum: string }; bedrijf: Record<string, unknown> | null; eerstBedrijf: boolean } {
  const id = String(pakket.overdrachtId ?? pakket.id ?? '')
  if (!id) throw new Error('Het overdrachtspakket mist een id')
  const v = pakket.vervolgstap ?? {}
  const regels = [
    `Overdracht vanuit Dealtrace: ${pakket.account?.naam ?? ''}`.trim(),
    pakket.briefing ? `Briefing: ${pakket.briefing}` : null,
    v.omschrijving ? `Vervolgstap: ${v.omschrijving}${v.datum ? ` (${v.datum})` : ''}` : 'Vervolgstap: nog niet vastgelegd',
    pakket.afspraak?.verslag ? `Verslag eerste afspraak: ${pakket.afspraak.verslag}` : null,
  ].filter(Boolean)
  return {
    activiteit: { sleutel: `dealtrace-overdracht:${id}`, onderwerp: `Overdracht: ${pakket.account?.naam ?? 'account'}`, tekst: regels.join('\n'), datum: String(pakket.op ?? new Date().toISOString()) },
    bedrijf: opties.eigenaarEmail ? { eigenaar: opties.eigenaarEmail } : null,
    eerstBedrijf: !opties.bedrijfExtern,
  }
}
