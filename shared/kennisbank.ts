// De Kennisbank (opzet van DealDrive /kennisbank): de pure regels die server en scherm delen. Soorten
// documenten, het type raden uit de naam, labels voor het bestand, wat de preview kan tonen, de voorgestelde
// vragen per type, het filter van de lijst en het materiaal en de mock voor "Vraag de AI over dit document".
import type { JsonSchema } from './aiStap'

export const DOCUMENT_TYPES = ['offerte', 'case', 'presentatie', 'productinfo', 'contract', 'prijslijst', 'overig'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const TYPE_LABEL: Record<DocumentType, string> = {
  offerte: 'Offerte', case: 'Case', presentatie: 'Presentatie', productinfo: 'Productinfo', contract: 'Contract', prijslijst: 'Prijslijst', overig: 'Overig',
}
/** Meervoud voor de filterpillen. */
export const TYPE_MEERVOUD: Record<DocumentType, string> = {
  offerte: 'Offertes', case: 'Cases', presentatie: 'Presentaties', productinfo: 'Productinfo', contract: 'Contracten', prijslijst: 'Prijslijsten', overig: 'Overig',
}
/** Icoon per type (lucide, zie Icoon.vue). */
export const TYPE_ICOON: Record<DocumentType, string> = {
  offerte: 'FileText', case: 'Star', presentatie: 'ChartColumn', productinfo: 'Package', contract: 'ScrollText', prijslijst: 'Euro', overig: 'File',
}

export const isDocumentType = (t: unknown): t is DocumentType => typeof t === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(t)

/** PDF, Office, tekst (ook Markdown) en afbeeldingen tot 8 MB. */
export const TOEGESTANE_MIME = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/msword|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|text\/(plain|csv|markdown)|image\/(jpeg|png|webp))$/
export const MAX_GROOTTE = 8_000_000

/** Het mimetype, ook als de browser er geen meegeeft (Markdown heeft er vaak geen). */
export function mimeVoor(naam: string, mime?: string | null): string {
  const m = String(mime ?? '').split(';')[0]!.trim().toLowerCase()
  if (m && m !== 'application/octet-stream') return m
  const ext = /\.([a-z0-9]+)$/i.exec(naam)?.[1]?.toLowerCase()
  const per: Record<string, string> = {
    pdf: 'application/pdf', md: 'text/markdown', markdown: 'text/markdown', txt: 'text/plain', csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  }
  return (ext && per[ext]) || m || 'application/octet-stream'
}

/** Het type uit de naam (en het bestand); anders overig. */
export function raadType(naam: string, mime = ''): DocumentType {
  const n = naam.toLowerCase()
  if (/offerte|quote|aanbieding/.test(n)) return 'offerte'
  if (/contract|overeenkomst|voorwaarden|sla\b/.test(n)) return 'contract'
  if (/prijs|tarief|prijslijst/.test(n)) return 'prijslijst'
  if (/\bcase\b|case[-_ ]|referentie|klantverhaal|succesverhaal/.test(n)) return 'case'
  if (/presentatie|pitch|deck|slides/.test(n) || /presentation|powerpoint/.test(mime)) return 'presentatie'
  if (/product|brochure|specificatie|datasheet|folder/.test(n)) return 'productinfo'
  return 'overig'
}

/** Korte naam van het bestandsformaat ("PDF", "Word", ...). */
export function bestandSoort(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (/wordprocessingml|msword/.test(mime)) return 'Word'
  if (/spreadsheetml|ms-excel/.test(mime)) return 'Excel'
  if (/presentationml|ms-powerpoint/.test(mime)) return 'PowerPoint'
  if (mime === 'text/markdown') return 'Markdown'
  if (mime === 'text/csv') return 'CSV'
  if (mime.startsWith('text/')) return 'Tekst'
  if (mime.startsWith('image/')) return `Afbeelding (${mime.slice(6).toUpperCase().replace('JPEG', 'JPG')})`
  return 'Bestand'
}

export function grootteLabel(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} kB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Wat de preview kan tonen: een afbeelding, een pdf in een frame, de tekst, of niets. */
export function previewSoort(mime: string, heeftTekst: boolean): 'afbeelding' | 'pdf' | 'tekst' | 'geen' {
  if (mime.startsWith('image/')) return 'afbeelding'
  if (mime === 'application/pdf') return 'pdf'
  if (heeftTekst) return 'tekst'
  return 'geen'
}

/** Drie voorgestelde vragen per type; de derde is altijd de samenvatting of de vervolgvraag. */
export function voorgesteldeVragen(type: DocumentType): string[] {
  switch (type) {
    case 'offerte': return ['Wat zijn de prijs, de looptijd en de voorwaarden?', 'Welke bezwaren kan de klant hebben bij deze offerte?', 'Vat dit document samen in drie punten.']
    case 'case': return ['Wat is de belangrijkste les uit deze case?', 'Bij welke prospects kan ik deze case gebruiken?', 'Vat dit document samen in drie punten.']
    case 'contract': return ['Wat zijn de opzegtermijn en de verlenging?', 'Welke afwijkende voorwaarden staan erin?', 'Vat dit document samen in drie punten.']
    case 'productinfo':
    case 'prijslijst': return ['Wat zijn de belangrijkste specificaties of prijzen?', 'Voor welk soort klant past dit het best?', 'Vat dit document samen in drie punten.']
    case 'presentatie': return ['Vat de kernboodschap samen in drie punten.', 'Welke argumenten kan ik in een gesprek gebruiken?', 'Welke vragen kan ik de klant hierover stellen?']
    default: return ['Vat dit document samen in drie punten.', 'Welke vragen kan ik de klant stellen op basis hiervan?', 'Wat is het belangrijkste punt voor een gesprek?']
  }
}

/** Zoeken in de lijst: op naam, beschrijving, tekst en gekoppelde accounts en contacten (minstens 2 tekens). */
export function zoekTermGeldig(q: string | null | undefined): string | null {
  const t = String(q ?? '').trim()
  return t.length >= 2 ? t.slice(0, 100) : null
}

/** De tekst die de AI meekrijgt is begrensd; de rest staat er niet in en dat staat in het materiaal. */
export const MAX_TEKST_AI = 12_000

export interface DocumentMateriaal {
  document: {
    naam: string; type: string; versie: string; bestand: string; bijgewerkt: string; geuploadDoor: string | null
    beschrijving: string | null; klanten: string[]; contacten: string[]
    inhoud: string | null; inhoudIngekort: boolean; inhoudGelezen: boolean
  }
  vraag: string
}

export function documentMateriaal(d: {
  naam: string; type: DocumentType; versie: string; mime: string; grootte: number; bijgewerktOp: string; door: string | null
  beschrijving: string | null; klanten: string[]; contacten: string[]; tekst: string | null
}, vraag: string): DocumentMateriaal {
  const tekst = d.tekst?.trim() || null
  return {
    document: {
      naam: d.naam, type: TYPE_LABEL[d.type], versie: d.versie, bestand: `${grootteLabel(d.grootte)} · ${bestandSoort(d.mime)}`, bijgewerkt: d.bijgewerktOp, geuploadDoor: d.door,
      beschrijving: d.beschrijving, klanten: d.klanten, contacten: d.contacten,
      inhoud: tekst ? tekst.slice(0, MAX_TEKST_AI) : null, inhoudIngekort: !!tekst && tekst.length > MAX_TEKST_AI, inhoudGelezen: !!tekst,
    },
    vraag,
  }
}

export const DOCUMENT_PROMPT = `Je beantwoordt een vraag over één document uit de kennisbank van de organisatie.
Gebruik alleen het meegegeven materiaal: de datavelden en, als die er is, de inhoud van het document.
Staat de inhoud er niet bij (een afbeelding, of een bestand dat niet gelezen kon worden), zeg dan dat je alleen titel, type en koppelingen kent en verzin niets over de inhoud.
Citaten staan letterlijk in het materiaal. Schrijf kort, in de je-vorm, zonder gedachtestreepjes.`

/** De zinnen van een tekst, zonder lege regels. */
function zinnen(t: string): string[] {
  return t.replace(/\r/g, '').split(/(?<=[.!?])\s+|\n+/).map((z) => z.replace(/^[#>*\-\s]+/, '').trim()).filter((z) => z.length > 3)
}

/**
 * De mock voor een vraag over een document: zonder inhoud het eerlijke antwoord dat alleen de velden bekend
 * zijn; met inhoud de zinnen die het best bij de vraag passen (of de eerste drie), met een letterlijk citaat.
 */
export function mockDocumentAntwoord(m: DocumentMateriaal): { tekst: string; bronnen: { soort: 'document'; label: string; citaat?: string }[]; acties: never[] } {
  const d = m.document
  const label = `Document: ${d.naam}`
  if (!d.inhoud) {
    const koppeling = d.klanten.length ? ` Het hoort bij ${d.klanten.join(', ')}.` : ''
    const waarom = /^Afbeelding/.test(d.bestand.split(' · ')[1] ?? '') ? 'Het is een afbeelding zonder leesbare tekst.' : 'Het lezen van het bestand is mislukt.'
    return { tekst: `Ik ken van dit document alleen de gegevens, niet de inhoud. ${waarom} ${d.naam} is een ${d.type.toLowerCase()} (versie ${d.versie}).${koppeling} Open het bestand om de inhoud zelf te lezen.`, bronnen: [{ soort: 'document', label }], acties: [] }
  }
  const alle = zinnen(d.inhoud)
  const woorden = m.vraag.toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter((w) => w.length > 3)
  const score = (z: string) => woorden.filter((w) => z.toLowerCase().includes(w)).length
  const passend = [...alle].map((z, i) => ({ z, i, s: score(z) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 3).sort((a, b) => a.i - b.i).map((x) => x.z)
  const gekozen = passend.length ? passend : alle.slice(0, 3)
  if (!gekozen.length) return { tekst: `In ${d.naam} staat geen leesbare tekst over deze vraag.`, bronnen: [{ soort: 'document', label }], acties: [] }
  return {
    tekst: `Uit ${d.naam}:\n${gekozen.map((z) => `• ${z}`).join('\n')}`,
    bronnen: [{ soort: 'document', label, citaat: gekozen[0] }],
    acties: [],
  }
}

export interface DocumentAntwoord { tekst: string; bronnen: { soort: 'document'; label: string; citaat?: string | null }[]; acties: unknown[] }

export const DOCUMENT_SCHEMA: JsonSchema = {
  type: 'object', required: ['tekst', 'bronnen', 'acties'], additionalProperties: false,
  properties: {
    tekst: { type: 'string', maxLength: 4000 },
    bronnen: { type: 'array', items: { type: 'object', required: ['soort', 'label'], additionalProperties: false, properties: { soort: { type: 'string', enum: ['document'] }, label: { type: 'string' }, citaat: { type: 'string' } } } },
    acties: { type: 'array' },
  },
}

/** Bewijsplicht: een citaat dat niet letterlijk in de inhoud of de velden staat, valt weg. */
export function controleerDocumentAntwoord(m: DocumentMateriaal, a: DocumentAntwoord): DocumentAntwoord {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase()
  const d = m.document
  const alles = [d.inhoud, d.naam, d.beschrijving, d.type, ...d.klanten, ...d.contacten].filter(Boolean).map((t) => norm(String(t)))
  const bronnen = (a.bronnen ?? []).filter((b) => !b.citaat || alles.some((t) => t.includes(norm(b.citaat!))))
  return { tekst: String(a.tekst ?? '').trim(), bronnen, acties: [] }
}
