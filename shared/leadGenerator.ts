// Import (F02 tabblad Importeren): kolomherkenning, validatie per rij, dubbelen in
// het bestand, terugdraaien en veroudering. Ontdubbelen tegen het bestand staat
// in shared/ontdubbelen.ts (één plek, ook voor "+ Prospect").
import { geldigEmail, geldigePostcode, normaliseerTelefoon } from './contactgegevens'
import { valideerWaarde, type VeldDefinitie } from './eigenVelden'
import { dice, normaliseerDomein, normaliseerNaam } from './ontdubbelen'

export const IMPORT_DOELEN = {
  naam: 'Bedrijfsnaam', kvk: 'KvK-nummer', website: 'Website of domein', adres: 'Adres', postcode: 'Postcode', plaats: 'Plaats',
  sbi: 'SBI-code', medewerkers: 'Medewerkers', telefoon: 'Telefoon', email: 'E-mail bedrijf',
  contactVoornaam: 'Contact voornaam', contactAchternaam: 'Contact achternaam', contactFunctie: 'Contact functie',
  contactEmail: 'Contact e-mail', contactTelefoon: 'Contact telefoon', contactMobiel: 'Contact mobiel',
} as const
export type ImportDoel = keyof typeof IMPORT_DOELEN | `cf:${string}` | ''

const SYNONIEMEN: Record<keyof typeof IMPORT_DOELEN, string[]> = {
  naam: ['bedrijfsnaam', 'bedrijf', 'naam', 'organisatie', 'firma', 'company', 'handelsnaam', 'account'],
  kvk: ['kvk', 'kvknummer', 'kvk-nummer', 'kvk nummer', 'kamer van koophandel', 'coc'],
  website: ['website', 'domein', 'url', 'site', 'web', 'www'],
  adres: ['adres', 'straat', 'straat en huisnummer', 'address', 'bezoekadres'],
  postcode: ['postcode', 'zip', 'postal code', 'pc'],
  plaats: ['plaats', 'woonplaats', 'stad', 'vestigingsplaats', 'city', 'gemeente'],
  sbi: ['sbi', 'sbi-code', 'sbi code', 'sbicode'],
  medewerkers: ['medewerkers', 'aantal medewerkers', 'werknemers', 'fte', 'employees'],
  telefoon: ['telefoon', 'telefoonnummer', 'tel', 'phone', 'algemeen nummer'],
  email: ['e-mail bedrijf', 'email bedrijf', 'algemeen e-mailadres', 'info e-mail'],
  contactVoornaam: ['voornaam', 'contact voornaam', 'first name', 'firstname'],
  contactAchternaam: ['achternaam', 'contact achternaam', 'last name', 'lastname', 'contactpersoon', 'naam contactpersoon'],
  contactFunctie: ['functie', 'contact functie', 'title', 'job title', 'rol'],
  contactEmail: ['e-mail', 'email', 'e-mailadres', 'emailadres', 'contact e-mail', 'mail'],
  contactTelefoon: ['contact telefoon', 'direct nummer', 'doorkiesnummer'],
  contactMobiel: ['mobiel', 'mobiel nummer', '06', 'gsm', 'mobile'],
}

const schoon = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_.:]/g, ' ').replace(/\s+/g, ' ').trim()

/** Voorstel per kolom. Een kolom "cf:sleutel" of met de naam van een eigen veld gaat naar dat veld. */
export function importKoppeling(kolommen: string[], eigenVelden: Pick<VeldDefinitie, 'sleutel' | 'naam'>[] = []): ImportDoel[] {
  const gebruikt = new Set<string>()
  return kolommen.map((k) => {
    const s = schoon(k)
    if (!s) return ''
    const cf = /^cf\s*(.+)$/.exec(s.replace(/^cf\s/, 'cf '))
    const kandidaatCf = s.startsWith('cf ') ? s.slice(3).replace(/\s/g, '_') : null
    for (const v of eigenVelden) {
      if (kandidaatCf === v.sleutel || s === schoon(v.naam) || s.replace(/\s/g, '_') === v.sleutel) {
        if (!gebruikt.has(`cf:${v.sleutel}`)) { gebruikt.add(`cf:${v.sleutel}`); return `cf:${v.sleutel}` as const }
      }
    }
    void cf
    for (const [doel, woorden] of Object.entries(SYNONIEMEN)) {
      if (gebruikt.has(doel)) continue
      if (woorden.includes(s)) { gebruikt.add(doel); return doel as ImportDoel }
    }
    return ''
  })
}

export interface Fout { veld: string; reden: string }
export interface ImportRij {
  rij: number
  account: { naam: string; kvk?: string; website?: string; domein?: string | null; adres?: string; postcode?: string; plaats?: string; sbi?: string[]; medewerkers?: number; telefoon?: string; email?: string; customFields: Record<string, unknown> }
  contact?: { voornaam?: string; achternaam: string; functie?: string; email?: string; telefoon?: string; mobiel?: string }
  fouten: Fout[]
}

/** Leest één rij volgens de koppeling: normaliseert en verzamelt fouten in gewone taal. Vult niets aan dat niet in het bestand staat. */
export function valideerImportRij(rij: string[], rijnummer: number, koppeling: ImportDoel[], eigenVelden: (Pick<VeldDefinitie, 'sleutel' | 'naam' | 'type' | 'data'>)[] = []): ImportRij {
  const fouten: Fout[] = []
  const waarde = (doel: string) => { const i = koppeling.indexOf(doel as ImportDoel); return i >= 0 ? (rij[i] ?? '').trim() : '' }
  const account: ImportRij['account'] = { naam: waarde('naam'), customFields: {} }
  if (!account.naam) fouten.push({ veld: 'Bedrijfsnaam', reden: 'Bedrijfsnaam ontbreekt' })
  const kvk = waarde('kvk').replace(/\s/g, '')
  if (kvk) { if (/^\d{8}$/.test(kvk)) account.kvk = kvk; else fouten.push({ veld: 'KvK-nummer', reden: `KvK-nummer ${kvk} klopt niet: acht cijfers` }) }
  const web = waarde('website')
  if (web) { account.website = /^https?:\/\//.test(web) ? web : `https://${web.replace(/^www\./, 'www.')}`; account.domein = normaliseerDomein(web) }
  if (waarde('adres')) account.adres = waarde('adres')
  const pc = waarde('postcode')
  if (pc) {
    if (geldigePostcode(pc)) account.postcode = pc.replace(/\s/g, '').toUpperCase().replace(/^(\d{4})/, '$1 ')
    else fouten.push({ veld: 'Postcode', reden: `Postcode ${pc} klopt niet: vier cijfers en twee letters` })
  }
  if (waarde('plaats')) account.plaats = waarde('plaats')
  if (waarde('sbi')) account.sbi = waarde('sbi').split(/[;, ]+/).filter(Boolean)
  const mw = waarde('medewerkers')
  if (mw) { const n = Number(mw.replace(/\./g, '')); if (Number.isFinite(n)) account.medewerkers = n; else fouten.push({ veld: 'Medewerkers', reden: `Medewerkers "${mw}" is geen getal` }) }
  const tel = (v: string, veld: string) => { if (!v) return undefined; const t = normaliseerTelefoon(v); if (t.ok) return t.e164; fouten.push({ veld, reden: `${veld} ${v}: ${t.fout.toLowerCase()}` }); return undefined }
  account.telefoon = tel(waarde('telefoon'), 'Telefoon')
  const em = waarde('email')
  if (em) { if (geldigEmail(em)) account.email = em.toLowerCase(); else fouten.push({ veld: 'E-mail bedrijf', reden: `E-mailadres ${em} klopt niet` }) }
  koppeling.forEach((doel, i) => {
    if (!doel.startsWith('cf:')) return
    const sleutel = doel.slice(3)
    const v = eigenVelden.find((x) => x.sleutel === sleutel)
    const ruw = (rij[i] ?? '').trim()
    if (!v || !ruw) return
    const r = valideerWaarde(v, ruw)
    if (r.ok) account.customFields[sleutel] = r.waarde
    else fouten.push({ veld: v.naam, reden: r.fout })
  })
  let contact: ImportRij['contact']
  const achternaam = waarde('contactAchternaam')
  if (achternaam || waarde('contactEmail')) {
    contact = { achternaam: achternaam || waarde('contactEmail').split('@')[0]!, voornaam: waarde('contactVoornaam') || undefined, functie: waarde('contactFunctie') || undefined }
    if (!achternaam) fouten.push({ veld: 'Contact achternaam', reden: 'Achternaam van de contactpersoon ontbreekt' })
    const ce = waarde('contactEmail')
    if (ce) { if (geldigEmail(ce)) contact.email = ce.toLowerCase(); else fouten.push({ veld: 'Contact e-mail', reden: `E-mailadres ${ce} klopt niet` }) }
    contact.telefoon = tel(waarde('contactTelefoon'), 'Contact telefoon')
    contact.mobiel = tel(waarde('contactMobiel'), 'Contact mobiel')
  }
  return { rij: rijnummer, account, contact, fouten }
}

/** Groepen van rijen die binnen het bestand hetzelfde bedrijf zijn: KvK, domein, of naam plus postcode. */
export function dubbelInBestand(rijen: Pick<ImportRij, 'rij' | 'account'>[]): number[][] {
  const groep = new Map<number, number>()
  const sleutels = new Map<string, number>()
  const vind = (r: number): number => (groep.get(r) === r || groep.get(r) === undefined ? r : vind(groep.get(r)!))
  for (const r of rijen) {
    groep.set(r.rij, r.rij)
    const keys = [
      r.account.kvk ? `kvk:${r.account.kvk}` : '',
      r.account.domein ? `dom:${r.account.domein}` : '',
      r.account.naam ? `naam:${normaliseerNaam(r.account.naam)}|${(r.account.postcode ?? '').replace(/\s/g, '')}` : '',
    ].filter(Boolean)
    for (const k of keys) {
      const eerder = sleutels.get(k)
      if (eerder === undefined) sleutels.set(k, r.rij)
      else groep.set(vind(r.rij), vind(eerder))
    }
  }
  const per = new Map<number, number[]>()
  for (const r of rijen) { const g = vind(r.rij); (per.get(g) ?? per.set(g, []).get(g)!).push(r.rij) }
  return [...per.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a - b))
}

/** Terugdraaien mag alleen zonder activiteit; de importregel zelf telt niet. */
export function magTerugdraaien(account: { updatedAt?: string; data?: { importBatchId?: string; herkomst?: Record<string, { bron: string; op: string }> } }, activiteiten: { soort: string; data?: any }[], batch: { id: string; verwerktOp: string | null }): boolean {
  if (account.data?.importBatchId !== batch.id) return false
  if (activiteiten.some((a) => !(a.soort === 'import' && a.data?.batchId === batch.id))) return false
  // Een wijziging met de hand na de import telt als activiteit.
  const verwerkt = batch.verwerktOp ? Date.parse(batch.verwerktOp) : 0
  return !Object.values(account.data?.herkomst ?? {}).some((h) => h.bron === 'hand' && Date.parse(h.op) > verwerkt)
}

/** Een contact zonder bevestiging in 12 maanden krijgt "controleren" (15.1). */
export function moetControleren(contact: { bevestigdOp?: string | null; aangemaaktOp: string }, nu: Date): boolean {
  const basis = new Date(contact.bevestigdOp ?? contact.aangemaaktOp)
  const grens = new Date(basis); grens.setMonth(grens.getMonth() + 12)
  return nu.getTime() >= grens.getTime()
}

export { dice as sorensenDice, normaliseerNaam }
