// Leadgenerator (F02). Bovenaan het tabblad Importeren: kolomherkenning, validatie per
// rij, dubbelen in het bestand, terugdraaien en veroudering. Daaronder de leadstroom.
// Ontdubbelen tegen het bestand staat in shared/ontdubbelen.ts (één plek, ook voor "+ Prospect").
import { afstandKm } from './route'
import { geldigEmail, geldigePostcode, normaliseerTelefoon } from './contactgegevens'
import { valideerWaarde, type VeldDefinitie } from './eigenVelden'
import { dice, normaliseerDomein, normaliseerNaam } from './ontdubbelen'
import { creditsVoor, CREDITS_OP_TEKST, soortAanIn, type CreditsStand } from './credits'
import { klasseCode, klasseVoorOmvang, type Klasse } from './ritmematrix'
import type { Pakket } from './types'

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

// ── De leadstroom (F02, ADR-015): grenzen, criteria, groepen en ontdubbelen ─────
// Elke bron (AI-zoeker, KvK, import, Datacollectief, CRM) levert dezelfde lead;
// groepen, criteria en grenzen staan alleen hier (gat 16).

export const GRENZEN = {
  rondesPerDag: 10,
  bedrijvenPerRonde: 25,
  cacheUren: 24,
  /** Passend: minstens zoveel keer ja bij minstens zoveel beoordeelde criteria (instelbaar). */
  passendJa: 3,
  passendBeoordeeld: 4,
  /** Dossierhoudbaarheid (15.2): zacht wordt Verlopen, hard vervalt het bewijs. */
  zachtDagen: 30,
  hardDagen: 120,
  opruimenNietOvergenomen: 60,
  opruimenAfgewezen: 120,
  kvkCacheDagen: 30,
  zoekopdrachtenPerRonde: 3,
} as const
export const DOSSIER_GRENS = GRENZEN.zachtDagen

/** KvK-bevragingen per maand per pakket (11.4); KvK is geen AI en telt niet in de credits. */
export const KVK_PER_PAKKET: Record<Pakket, number> = { starter: 0, plus: 500, compleet: 2000 }
export const DAGGRENS_TEKST = `Je daggrens van ${GRENZEN.rondesPerDag} zoekrondes is bereikt.`
export const KVK_PLAFOND_TEKST = 'Het KvK-plafond van deze maand is bereikt.'
export const KVK_NIET_GEKOPPELD = 'KvK is nog niet gekoppeld. Je beheerder plakt de KvK-sleutel bij Koppelingen.'

export const LEAD_BRONNEN = ['ai', 'kvk', 'datacollectief', 'import', 'crm'] as const
export type LeadBron = typeof LEAD_BRONNEN[number]
export const BRON_LABEL: Record<LeadBron, string> = { ai: 'AI-zoeker', kvk: 'KvK', datacollectief: 'Datacollectief', import: 'Import', crm: 'CRM' }

export const CRITERIA = ['klasse', 'branche', 'werkgebied', 'aanleiding', 'groei', 'bereikbaar'] as const
export type Criterium = typeof CRITERIA[number]
export const CRITERIUM_LABEL: Record<Criterium, string> = {
  klasse: 'Klasse of omvang', branche: 'Branche', werkgebied: 'Werkgebied', aanleiding: 'Aanleiding', groei: 'Groeisignaal', bereikbaar: 'Bereikbaarheid',
}

/** Vaste volgorde; de eerste treffer wint, lege groepen zijn verborgen. */
export const GROEP_VOLGORDE = ['alBekend', 'valtAf', 'verlopen', 'onbeoordeeld', 'passend'] as const
export type LeadGroep = typeof GROEP_VOLGORDE[number]
/** Volgorde op het scherm: wat je kunt doen eerst. */
export const GROEP_WEERGAVE: LeadGroep[] = ['passend', 'onbeoordeeld', 'verlopen', 'valtAf', 'alBekend']
export const GROEP_LABEL: Record<LeadGroep, string> = {
  alBekend: 'Al in je bestand', valtAf: 'Valt af', verlopen: 'Verlopen', onbeoordeeld: 'Nog niet te beoordelen', passend: 'Passend',
}

export const AFWIJSREDENEN = ['Te klein', 'Verkeerde branche', 'Heeft al een leverancier', 'Buiten gebied', 'Geen budget', 'Anders'] as const

export type Oordeel = 'ja' | 'nee' | 'onbekend'
export interface Bewijs { criterium: Criterium; oordeel: Oordeel; zin: string; bron: string; url?: string | null; datum?: string | null }
export interface LeadContact { naam: string; functie?: string | null; email?: string | null; telefoon?: string | null; linkedin?: string | null; bron: string; aanname?: boolean }
export interface DossierZin { tekst: string; bron: string; url?: string | null; datum?: string | null }
export interface LeadFeiten {
  naam: string; kvk?: string | null; domein?: string | null; website?: string | null; plaats?: string | null; postcode?: string | null
  adres?: string | null; lat?: number | null; lng?: number | null; medewerkers?: number | null; sbi?: string[]
  contacten?: LeadContact[]
  /** Bewijszinnen uit de zoekronde of het dossier. */
  zinnen?: DossierZin[]
  /** Oordelen van de Zoeker uit het dossier (aanleiding, groei, bereikbaarheid). */
  dossierBewijs?: Bewijs[]
  dossierOp?: string | null
  herkomst?: Record<string, { bron: string; op: string; url?: string }>
}

export interface Werkgebied { postcodes?: string[]; straal?: { lat: number; lng: number; km: number } | null }
export interface Zoekopdracht {
  doelgroepId?: string | null; doelgroepNaam?: string | null; lijktOpKlanten?: boolean
  /** Klassecodes, bijvoorbeeld ['B', 'C']. */
  klassen?: string[]
  omvang?: { min?: number | null; max?: number | null }
  sbi?: string[]
  brancheId?: string | null
  werkgebied?: Werkgebied
  aanleiding?: string
  /** Zoeksjabloon "Overstappers van <concurrent>". */
  concurrentId?: string | null
}

const DAG_MS = 864e5
const dagenOud = (op: string | null | undefined, nu: Date) => (op ? (nu.getTime() - Date.parse(op)) / DAG_MS : 0)
const schoonTekst = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Klasse uit het aantal medewerkers met de klassen van de organisatie (één definitie met P06). */
export function klasseUitMedewerkers(n: number | null | undefined, klassen: Klasse[]): string | null {
  const eigen = klassen.filter((k) => k.tabblad !== 'Klanten')
  return klasseVoorOmvang(n, eigen.length ? eigen : undefined)
}
const codeVan = (id: string | null, klassen: Klasse[]) => (id ? klasseCode(klassen.find((k) => k.id === id) ?? { id, naam: id }) : null)

// De afstand (haversine) staat één keer, in shared/route.ts.
export { afstandKm }

const STOPWOORDEN = new Set(['voor', 'naar', 'met', 'zijn', 'heeft', 'van', 'een', 'het', 'die', 'dat', 'deze', 'door', 'werkt', 'bedrijf', 'bedrijven'])
/** Trefwoorden uit een aanleiding: woorden van vier letters of meer, als stam van zes letters. */
export function trefwoorden(aanleiding: string | null | undefined): string[] {
  return [...new Set(schoonTekst(aanleiding ?? '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOPWOORDEN.has(w)).map((w) => w.slice(0, 6)))]
}
const GROEI = /vacature|werft|zoekt (?:\w+ )?(?:monteur|collega|medewerker)|nieuwe vestiging|nieuw pand|uitbrei|groei|overname|opent/i

/**
 * Zes oordelen met bewijs (F02). Onbekend is geen nee; elk oordeel draagt een bron en,
 * waar het veroudert, een datum. Bewijs ouder dan de harde grens (120 dagen) vervalt.
 */
export function beoordeelLead(lead: LeadFeiten, z: Zoekopdracht, klassen: Klasse[], nu: Date): { bewijs: Bewijs[]; score: number; beoordeeld: number } {
  const b: Bewijs[] = []
  const bronVan = (veld: string, standaard: string) => lead.herkomst?.[veld]?.bron ?? standaard
  // Klasse of omvang: de klassen van de organisatie, geen vaste standaard (gat 46).
  if (lead.medewerkers == null) b.push({ criterium: 'klasse', oordeel: 'onbekend', zin: 'Aantal medewerkers onbekend', bron: bronVan('medewerkers', 'kvk') })
  else {
    const id = klasseUitMedewerkers(lead.medewerkers, klassen)
    const code = codeVan(id, klassen)
    const wil = (z.klassen ?? []).map((k) => k.toUpperCase())
    const min = z.omvang?.min ?? null
    const max = z.omvang?.max ?? null
    const ok = (!wil.length || (!!code && wil.includes(code))) && (min == null || lead.medewerkers >= min) && (max == null || lead.medewerkers <= max)
    b.push({ criterium: 'klasse', oordeel: ok ? 'ja' : 'nee', zin: `${lead.medewerkers} medewerkers${code ? `, klasse ${code}` : ''}${!ok && wil.length ? `; je zoekt klasse ${wil.join(' en ')}` : ''}`, bron: bronVan('medewerkers', 'kvk'), datum: lead.herkomst?.medewerkers?.op ?? null })
  }
  // Branche: SBI uit KvK tegen de doelgroep.
  const sbi = lead.sbi ?? []
  if (!sbi.length) b.push({ criterium: 'branche', oordeel: 'onbekend', zin: 'SBI-code onbekend', bron: bronVan('sbi', 'kvk') })
  else if (!z.sbi?.length) b.push({ criterium: 'branche', oordeel: 'ja', zin: `SBI ${sbi.join(', ')}; geen branche gekozen`, bron: bronVan('sbi', 'kvk') })
  else {
    const hit = sbi.find((s) => z.sbi!.some((w) => s.startsWith(w) || w.startsWith(s)))
    b.push({ criterium: 'branche', oordeel: hit ? 'ja' : 'nee', zin: hit ? `SBI ${hit} past bij je doelgroep` : `SBI ${sbi.join(', ')} valt buiten ${z.sbi.join(', ')}`, bron: bronVan('sbi', 'kvk') })
  }
  // Werkgebied: straal rond de thuisbasis of postcodegebieden (gat 46).
  const wg = z.werkgebied
  if (!wg?.straal && !wg?.postcodes?.length) b.push({ criterium: 'werkgebied', oordeel: 'onbekend', zin: 'Geen werkgebied gekozen', bron: 'zoekopdracht' })
  else if (wg.straal && lead.lat != null && lead.lng != null) {
    const km = Math.round(afstandKm(wg.straal, { lat: lead.lat, lng: lead.lng }))
    b.push({ criterium: 'werkgebied', oordeel: km <= wg.straal.km ? 'ja' : 'nee', zin: km <= wg.straal.km ? `Ligt ${km} km van je thuisbasis` : `Ligt ${km} km van je thuisbasis; je straal is ${wg.straal.km} km`, bron: bronVan('adres', 'kvk') })
  } else if (wg.postcodes?.length && lead.postcode) {
    const pc = lead.postcode.replace(/\s/g, '')
    const ok = wg.postcodes.some((p) => pc.startsWith(p.replace(/\s/g, '')))
    b.push({ criterium: 'werkgebied', oordeel: ok ? 'ja' : 'nee', zin: ok ? `Postcode ${lead.postcode} ligt in je werkgebied` : `Postcode ${lead.postcode} valt buiten ${wg.postcodes.join(', ')}`, bron: bronVan('adres', 'kvk') })
  } else b.push({ criterium: 'werkgebied', oordeel: 'onbekend', zin: 'Adres onbekend', bron: bronVan('adres', 'kvk') })

  const vers = (d?: string | null) => !d || dagenOud(d, nu) <= GRENZEN.hardDagen
  const dossierVers = vers(lead.dossierOp)
  const zinnen = dossierVers ? (lead.zinnen ?? []).filter((x) => vers(x.datum)) : []
  const vanDossier = (c: Criterium) => (dossierVers ? (lead.dossierBewijs ?? []).find((x) => x.criterium === c && vers(x.datum)) : undefined)
  // Aanleiding: trefwoorden in een bewijszin.
  const tw = trefwoorden(z.aanleiding)
  const dA = vanDossier('aanleiding')
  if (!tw.length) b.push({ criterium: 'aanleiding', oordeel: 'onbekend', zin: 'Geen aanleiding opgegeven', bron: 'zoekopdracht' })
  else {
    const zin = zinnen.find((x) => tw.some((w) => schoonTekst(x.tekst).includes(w)))
    if (zin) b.push({ criterium: 'aanleiding', oordeel: 'ja', zin: zin.tekst, bron: zin.bron, url: zin.url ?? null, datum: zin.datum ?? null })
    else if (dA) b.push(dA)
    else b.push({ criterium: 'aanleiding', oordeel: 'onbekend', zin: `Geen bewijs voor "${z.aanleiding}"`, bron: 'dossier' })
  }
  // Groeisignaal: vacatures, nieuws, nieuwe vestiging.
  const g = zinnen.find((x) => GROEI.test(x.tekst))
  const dG = vanDossier('groei')
  if (g) b.push({ criterium: 'groei', oordeel: 'ja', zin: g.tekst, bron: g.bron, url: g.url ?? null, datum: g.datum ?? null })
  else b.push(dG ?? { criterium: 'groei', oordeel: 'onbekend', zin: 'Geen groeisignaal gevonden', bron: 'dossier' })
  // Bereikbaarheid: een contactpersoon met functie en een nummer of e-mail (geen aanname).
  const c = (lead.contacten ?? []).find((x) => x.functie && (x.telefoon || (x.email && !x.aanname)))
  const dB = vanDossier('bereikbaar')
  if (c) b.push({ criterium: 'bereikbaar', oordeel: 'ja', zin: `${c.naam} · ${c.functie}`, bron: c.bron })
  else b.push(dB ?? { criterium: 'bereikbaar', oordeel: 'onbekend', zin: 'Nog geen contactpersoon met nummer of e-mail', bron: 'dossier' })

  const score = b.filter((x) => x.oordeel === 'ja').length
  return { bewijs: b, score, beoordeeld: b.filter((x) => x.oordeel !== 'onbekend').length }
}

/** Eén van de vijf groepen; de eerste treffer wint. */
export function groepeerLead(lead: { alBekend?: boolean; bewijs: Bewijs[]; dossierOp?: string | null }, nu: Date, grens: { ja?: number; beoordeeld?: number } = {}): LeadGroep {
  if (lead.alBekend) return 'alBekend'
  if (lead.bewijs.some((x) => x.oordeel === 'nee')) return 'valtAf'
  if (lead.dossierOp && dagenOud(lead.dossierOp, nu) > GRENZEN.zachtDagen) return 'verlopen'
  const ja = lead.bewijs.filter((x) => x.oordeel === 'ja').length
  const beoordeeld = lead.bewijs.filter((x) => x.oordeel !== 'onbekend').length
  if (beoordeeld < (grens.beoordeeld ?? GRENZEN.passendBeoordeeld)) return 'onbeoordeeld'
  return ja >= (grens.ja ?? GRENZEN.passendJa) ? 'passend' : 'onbeoordeeld'
}

/** "Dossier van vandaag", oranje na 30 dagen. */
export function dossierLabel(op: string | null | undefined, nu: Date): { tekst: string; oranje: boolean } | null {
  if (!op) return null
  const d = Math.floor(dagenOud(op, nu))
  return { tekst: d <= 0 ? 'Dossier van vandaag' : d === 1 ? 'Dossier van gisteren' : `Dossier van ${d} dagen geleden`, oranje: d > GRENZEN.zachtDagen }
}

/** Hash voor de 24-uursregel: volgorde van bronnen en SBI maakt niet uit. */
export function zoekopdrachtHash(z: Zoekopdracht, bronnen: string[]): string {
  const s = (a?: (string | null | undefined)[]) => [...new Set((a ?? []).filter(Boolean).map((x) => String(x).trim().toUpperCase()))].sort()
  const canon = JSON.stringify([
    z.doelgroepId ?? null, !!z.lijktOpKlanten, s(z.klassen), z.omvang?.min ?? null, z.omvang?.max ?? null, s(z.sbi), z.brancheId ?? null,
    s(z.werkgebied?.postcodes), z.werkgebied?.straal ? [z.werkgebied.straal.lat, z.werkgebied.straal.lng, z.werkgebied.straal.km] : null,
    schoonTekst(z.aanleiding ?? ''), z.concurrentId ?? null, s(bronnen),
  ])
  // cyrb53: klein en stabiel in browser en server.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < canon.length; i++) { const ch = canon.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

export interface BrancheMapping { brancheId: string; sbiCodes: string[]; trefwoorden: string[] }
/** SBI naar branche uit het verkoopverhaal; bij meer branches op één SBI beslist het trefwoord. */
export function brancheUitSbi(sbi: string[] | null | undefined, mapping: BrancheMapping[], tekst = ''): string | null {
  const codes = sbi ?? []
  const kandidaten = mapping.filter((m) => m.sbiCodes.some((c) => codes.some((s) => s.startsWith(c))))
  if (!kandidaten.length) return null
  const t = schoonTekst(tekst)
  return (kandidaten.find((m) => m.trefwoorden.some((w) => t.includes(schoonTekst(w))))
    ?? kandidaten.find((m) => !m.trefwoorden.length) ?? kandidaten[0]!).brancheId
}
/** De SBI-codes en trefwoorden van een branche, voor de KvK-zoekvraag. */
export function sbiVoorBranche(brancheId: string | null | undefined, mapping: BrancheMapping[]): { sbi: string[]; trefwoorden: string[] } {
  const m = mapping.find((x) => x.brancheId === brancheId)
  return { sbi: m?.sbiCodes ?? [], trefwoorden: m?.trefwoorden ?? [] }
}

/** Zoeksjabloon per concurrent van soort Direct (F25). */
export function zoeksjablonen(concurrenten: { id: string; naam: string; soort: string }[]): { id: string; naam: string; concurrentId: string; aanleiding: string }[] {
  return concurrenten.filter((c) => c.soort === 'Direct').map((c) => ({ id: `overstap-${c.id}`, naam: `Overstappers van ${c.naam}`, concurrentId: c.id, aanleiding: `klant van ${c.naam}` }))
}

/** "Lijkt op mijn klanten": top 3 SBI en top 6 postcodegebieden, alleen uit echte klanten (gat 46). */
export function leidZoekopdrachtAf(accounts: { accountKind?: string | null; sbi?: string[] | null; postcode?: string | null }[]): { sbi: { code: string; aantal: number }[]; postcodes: string[]; aantalKlanten: number } {
  const klanten = accounts.filter((a) => a.accountKind === 'klant')
  const tel = <T extends string>(lijst: T[]) => { const m = new Map<T, number>(); for (const x of lijst) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }
  return {
    sbi: tel(klanten.flatMap((k) => k.sbi ?? [])).slice(0, 3).map(([code, aantal]) => ({ code, aantal })),
    postcodes: tel(klanten.map((k) => (k.postcode ?? '').replace(/\s/g, '').slice(0, 2)).filter((p) => /^\d{2}$/.test(p))).slice(0, 6).map(([p]) => p),
    aantalKlanten: klanten.length,
  }
}

export interface RondeVerbruik { rondesVandaag: number; stand: CreditsStand | null; kvk: { gekoppeld: boolean; gebruikt: number; plafond: number }; dc?: { gekoppeld: boolean; gebruikt: number; plafond: number } }
/** Mag deze ronde? Op de server afgedwongen (429, 400, 403, 402). */
export function magRonde(v: RondeVerbruik, pakket: Pakket, bronnen: string[]): { mag: boolean; status?: 400 | 402 | 403 | 429; reden?: string } {
  if (v.rondesVandaag >= GRENZEN.rondesPerDag) return { mag: false, status: 429, reden: DAGGRENS_TEKST }
  if (!bronnen.length) return { mag: false, status: 400, reden: 'Kies minstens één bron' }
  if (bronnen.includes('kvk')) {
    if (!v.kvk.gekoppeld) return { mag: false, status: 400, reden: KVK_NIET_GEKOPPELD }
    if (v.kvk.gebruikt >= v.kvk.plafond) return { mag: false, status: 429, reden: KVK_PLAFOND_TEKST }
  }
  if (bronnen.includes('datacollectief')) {
    if (!DC_PER_PAKKET[pakket]) return { mag: false, status: 403, reden: 'Datacollectief is onderdeel van Compleet' }
    if (!v.dc?.gekoppeld) return { mag: false, status: 400, reden: DC_NIET_GEKOPPELD }
    if (v.dc.gebruikt >= v.dc.plafond) return { mag: false, status: 429, reden: DC_PLAFOND_TEKST }
  }
  if (bronnen.includes('ai')) {
    if (!soortAanIn('zoekronde', pakket)) return { mag: false, status: 403, reden: 'De AI-zoeker is onderdeel van Compleet' }
    if (!v.stand || v.stand.over < creditsVoor('zoekronde')) return { mag: false, status: 402, reden: CREDITS_OP_TEKST }
  }
  return { mag: true }
}

/** "Niet relevant" stuurt de volgende ronde bij: wat vaker om dezelfde reden is afgewezen, komt niet terug. */
export function bijsturing(afgewezen: { reden?: string | null; medewerkers?: number | null; sbi?: string[] | null; plaats?: string | null }[]): { maxTeKlein: number | null; sbiUit: string[]; plaatsenUit: string[] } {
  const teKlein = afgewezen.filter((a) => a.reden === 'Te klein' && a.medewerkers != null).map((a) => a.medewerkers!)
  const tel = (l: string[]) => { const m = new Map<string, number>(); for (const x of l) m.set(x, (m.get(x) ?? 0) + 1); return [...m].filter(([, n]) => n >= 2).map(([k]) => k) }
  return {
    maxTeKlein: teKlein.length >= 2 ? Math.max(...teKlein) : null,
    sbiUit: tel(afgewezen.filter((a) => a.reden === 'Verkeerde branche').flatMap((a) => a.sbi ?? [])),
    plaatsenUit: tel(afgewezen.filter((a) => a.reden === 'Buiten gebied' && a.plaats).map((a) => a.plaats!.toLowerCase())),
  }
}
export function pastNaBijsturing(l: Pick<LeadFeiten, 'medewerkers' | 'sbi' | 'plaats'>, b: ReturnType<typeof bijsturing>): boolean {
  if (b.maxTeKlein != null && l.medewerkers != null && l.medewerkers <= b.maxTeKlein) return false
  if ((l.sbi ?? []).length && (l.sbi ?? []).every((s) => b.sbiUit.includes(s))) return false
  if (l.plaats && b.plaatsenUit.includes(l.plaats.toLowerCase())) return false
  return true
}

/** Sleutels om een lead terug te vinden (afgewezen komt nooit terug, ook niet op een ander toestel). */
export function leadSleutels(l: Pick<LeadFeiten, 'naam' | 'kvk' | 'domein' | 'website' | 'postcode'>): string[] {
  const d = normaliseerDomein(l.domein ?? l.website)
  return [l.kvk ? `kvk:${l.kvk.replace(/\D/g, '')}` : '', d ? `dom:${d}` : '', `naam:${normaliseerNaam(l.naam)}|${(l.postcode ?? '').replace(/\s/g, '').toUpperCase()}`].filter(Boolean)
}

/** De Zoeker gebruikt alleen URL's uit de echte zoekresultaten. */
export function alleenEchteUrls<T extends { url?: string | null }>(bedrijven: T[], resultaten: { url: string }[]): T[] {
  const n = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase()
  const echt = new Set(resultaten.map((r) => n(r.url)))
  return bedrijven.filter((b) => !!b.url && echt.has(n(b.url)))
}

/** Bewijs telt alleen als het citaat letterlijk in het materiaal staat, met een URL uit het materiaal. */
export function controleerBewijs(bewijs: Bewijs[], materiaal: { url: string; tekst: string }[]): Bewijs[] {
  return bewijs.filter((b) => {
    const zin = schoonTekst(b.zin ?? '')
    if (zin.length < 8) return false
    const bron = b.url ? materiaal.filter((m) => m.url === b.url) : materiaal
    return bron.some((m) => schoonTekst(m.tekst).includes(zin))
  })
}

/** Geen verzonnen gegevens: een nummer of e-mail dat niet in het materiaal staat, vervalt; een patroon is een aanname (15.1). */
export function controleerContacten(contacten: LeadContact[], materiaal: string): LeadContact[] {
  const t = materiaal.toLowerCase()
  const cijfers = t.replace(/\D/g, '')
  return contacten.filter((c) => c.naam && t.includes(c.naam.toLowerCase().split(' ').at(-1)!)).map((c) => {
    const uit: LeadContact = { ...c }
    const tel = uit.telefoon?.replace(/\D/g, '') ?? ''
    if (tel && !cijfers.includes(tel) && !cijfers.includes(tel.replace(/^31/, '0'))) uit.telefoon = null
    if (uit.email && !t.includes(uit.email.toLowerCase())) { if (!uit.aanname) uit.email = null }
    return uit
  })
}

// ── Datacollectief (P15, F02) ─────────────────────────────────────────────────

/** Datacollectief-records zitten alleen in Compleet (11.4); het aantal volgt het contract. */
export const DC_PER_PAKKET: Record<Pakket, number> = { starter: 0, plus: 0, compleet: 500 }
export const DC_NIET_GEKOPPELD = 'Datacollectief is nog niet gekoppeld. Een beheerder plakt hier de sleutel van jullie contract.'
export const DC_PLAFOND_TEKST = 'Je maandplafond voor Datacollectief-records is op.'
export const DC_SLEUTEL_FOUT = 'De Datacollectief-sleutel werkt niet meer. Vraag een nieuwe aan bij Datacollectief en plak hem hier.'
export const DC_TEGOED_OP = 'Je tegoed bij Datacollectief is op. Vul het aan bij Datacollectief; tot die tijd is de bron uitgeschakeld.'
export const DC_KOSTEN_CENT = 25

export interface DcSelectie { sbi: string[]; trefwoorden: string[]; omvang: { min?: number | null; max?: number | null }; regio: string[]; functieniveaus: string[] }
/** Een selectie voor Datacollectief uit een doelgroep of zoekopdracht, met de SBI-codes van de branche als die er geen noemt. */
export function selectieUitDoelgroep(d: { sbi?: string[]; brancheId?: string | null; omvang?: { min?: number | null; max?: number | null }; gebieden?: string[]; postcodes?: string[]; functieniveaus?: string[] }, mapping: BrancheMapping[]): DcSelectie & { melding: string | null } {
  const b = sbiVoorBranche(d.brancheId ?? null, mapping)
  const sbi = d.sbi?.length ? d.sbi : b.sbi
  const regio = [...(d.postcodes ?? []).map((p) => p.replace(/\s/g, '').slice(0, 2)), ...(d.gebieden ?? [])].filter(Boolean)
  return {
    sbi, trefwoorden: b.trefwoorden, omvang: d.omvang ?? {}, regio: [...new Set(regio)], functieniveaus: d.functieniveaus?.length ? d.functieniveaus : ['eigenaar', 'directie', 'management'],
    melding: !sbi.length ? (d.brancheId ? 'Deze branche heeft nog geen SBI-koppeling; de selectie zoekt op trefwoorden.' : 'Geen branche of SBI-code; de selectie is breed.') : null,
  }
}

export interface DcContact { id: string; voornaam?: string | null; achternaam: string; functie?: string | null; functieniveau?: string | null; email?: string | null; telefoon?: string | null; linkedin?: string | null; prive?: boolean }
export interface DcRecord { id: string; naam: string; kvk?: string | null; website?: string | null; plaats?: string | null; postcode?: string | null; adres?: string | null; medewerkers?: number | null; sbi?: string[]; telefoon?: string | null; contacten: DcContact[] }

const PRIVE_DOMEINEN = /@(gmail|hotmail|outlook|live|icloud|yahoo|ziggo|kpnmail|planet|home)\./i
/** Een privé-ogend e-mailadres (11.2, 15.2): nooit overnemen. */
export const priveEmail = (e: string | null | undefined) => !!e && PRIVE_DOMEINEN.test(e)

/** Een record uit de adapter als lead in de gemeenschappelijke structuur; elk veld met herkomst datacollectief. */
export function datacollectiefNaarLead(r: DcRecord, op: string): LeadFeiten {
  const h = { bron: 'datacollectief', op }
  const herkomst: LeadFeiten['herkomst'] = { naam: h }
  const zet = <K extends keyof LeadFeiten>(k: K, v: LeadFeiten[K] | null | undefined) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) herkomst![k as string] = h; return v ?? null }
  const contacten: LeadContact[] = r.contacten.filter((c) => !c.prive).map((c) => ({
    naam: [c.voornaam, c.achternaam].filter(Boolean).join(' '), functie: c.functie ?? null,
    email: c.email && !priveEmail(c.email) ? c.email : null, telefoon: c.telefoon ?? null, linkedin: c.linkedin ?? null, bron: 'datacollectief',
  }))
  return {
    naam: r.naam, kvk: zet('kvk', r.kvk), website: zet('website', r.website), domein: r.website ? r.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') : null,
    plaats: zet('plaats', r.plaats), postcode: zet('postcode', r.postcode), adres: zet('adres', r.adres), medewerkers: zet('medewerkers', r.medewerkers), sbi: zet('sbi', r.sbi) ?? [],
    contacten, herkomst,
  }
}

/** Stand van een maandplafond: waarschuwen vanaf 80 procent, blokkeren op 100. Zonder plafond niets. */
export function plafondStand(verbruik: number, plafond: number | null | undefined): { rest: number | null; procent: number; geblokkeerd: boolean; waarschuwen: boolean } {
  if (plafond == null) return { rest: null, procent: 0, geblokkeerd: false, waarschuwen: false }
  const rest = Math.max(0, plafond - verbruik)
  const procent = plafond > 0 ? Math.min(100, Math.round((verbruik / plafond) * 100)) : 100
  return { rest, procent, geblokkeerd: verbruik >= plafond, waarschuwen: plafond <= 0 || verbruik >= plafond * 0.8 }
}
