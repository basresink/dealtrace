// De tekst uit een document halen voor de kennisbank en de AI. Tekst en Markdown direct; Word, PowerPoint en
// Excel (docx, pptx, xlsx) zijn zip-bestanden met XML, die lezen we met zlib uit Node zelf. PDF lezen we met
// unpdf (de serverloze bouw van pdf.js, puur JavaScript, dus ook in een Netlify-functie). De oude Office-formaten
// zijn OLE-bestanden: doc met word-extractor, ppt (tekstatomen) en xls (de gedeelde tekstentabel) met de
// OLE-lezer uit hetzelfde pakket. Lukt het lezen niet (een scan zonder tekstlaag, een kapot of versleuteld
// bestand), dan is de status niet-gelezen en zegt de flyout dat de AI alleen titel, type en koppelingen kent.
// Afbeeldingen hebben geen tekst.
import { inflateRawSync } from 'node:zlib'
import { Readable } from 'node:stream'
import WordExtractor from 'word-extractor'
import OleCompoundDoc from 'word-extractor/lib/ole-compound-doc.js'
import BufferReader from 'word-extractor/lib/buffer-reader.js'

export type TekstStatus = 'gelezen' | 'niet-gelezen' | 'geen'
const MAX_TEKST = 200_000

/** De bestanden in een zip (naam en inhoud), via de centrale map aan het eind. Leeg als het geen zip is. */
export function leesZip(buf: Buffer, filter: (naam: string) => boolean = () => true): Map<string, Buffer> {
  const uit = new Map<string, Buffer>()
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return uit
  const aantal = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < aantal && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const methode = buf.readUInt16LE(p + 10)
    const gecomprimeerd = buf.readUInt32LE(p + 20)
    const naamLengte = buf.readUInt16LE(p + 28)
    const extraLengte = buf.readUInt16LE(p + 30)
    const commentaarLengte = buf.readUInt16LE(p + 32)
    const lokaal = buf.readUInt32LE(p + 42)
    const naam = buf.subarray(p + 46, p + 46 + naamLengte).toString('utf8')
    p += 46 + naamLengte + extraLengte + commentaarLengte
    if (!filter(naam) || lokaal + 30 > buf.length || buf.readUInt32LE(lokaal) !== 0x04034b50) continue
    const start = lokaal + 30 + buf.readUInt16LE(lokaal + 26) + buf.readUInt16LE(lokaal + 28)
    const data = buf.subarray(start, start + gecomprimeerd)
    try {
      if (methode === 0) uit.set(naam, Buffer.from(data))
      else if (methode === 8) uit.set(naam, inflateRawSync(data))
    } catch { /* een kapot onderdeel slaan we over */ }
  }
  return uit
}

const ENTITEITEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function ontsnap(t: string) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const c = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : m }
    return ENTITEITEN[e.toLowerCase()] ?? m
  })
}

/** Tekst uit Office-XML: alleen de tekstknopen (w:t, a:t, t), een regel per alinea. */
export function tekstUitXml(xml: string, alinea: RegExp, knoop: RegExp): string {
  return xml.split(alinea).map((deel) => {
    let regel = ''
    for (const m of deel.matchAll(knoop)) regel += ontsnap(m[1] ?? '')
    return regel.trim()
  }).filter(Boolean).join('\n')
}

const nummer = (naam: string) => Number(/(\d+)\.xml$/.exec(naam)?.[1] ?? 0)

/** De tekst van een docx, pptx of xlsx; leeg als er niets te lezen is. */
export function officeTekst(mime: string, buf: Buffer): string {
  if (/wordprocessingml/.test(mime)) {
    const z = leesZip(buf, (n) => n === 'word/document.xml')
    const xml = z.get('word/document.xml')?.toString('utf8') ?? ''
    return tekstUitXml(xml, /<\/w:p>/, /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)
  }
  if (/presentationml/.test(mime)) {
    const z = leesZip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    return [...z.entries()].sort((a, b) => nummer(a[0]) - nummer(b[0]))
      .map(([, x]) => tekstUitXml(x.toString('utf8'), /<\/a:p>/, /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)).filter(Boolean).join('\n\n')
  }
  if (/spreadsheetml/.test(mime)) {
    const z = leesZip(buf, (n) => n === 'xl/sharedStrings.xml')
    return tekstUitXml(z.get('xl/sharedStrings.xml')?.toString('utf8') ?? '', /<\/si>/, /<t(?:\s[^>]*)?>([^<]*)<\/t>/g)
  }
  return ''
}

/** De tekst van een PDF, pagina's gescheiden door een witregel. Leeg bij een scan zonder tekstlaag. */
export async function pdfTekst(buf: Buffer): Promise<string> {
  const { getDocumentProxy, extractText } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  try {
    const { text } = await extractText(pdf, { mergePages: false })
    return (Array.isArray(text) ? text : [text]).map((t) => t.replace(/[ \t]+\n/g, '\n').trim()).filter(Boolean).join('\n\n')
  } finally { await pdf.cleanup?.().catch(() => {}) }
}

/** Een stroom uit een OLE-bestand (oud Office-formaat) als buffer; leeg als die er niet is. */
async function oleStroom(buf: Buffer, namen: string[]): Promise<Buffer> {
  const doc = await new OleCompoundDoc(new BufferReader(buf)).read()
  for (const naam of namen) {
    const stroom = doc.stream(naam) as Readable
    const delen: Buffer[] = []
    await new Promise<void>((klaar, fout) => {
      stroom.on('data', (d: Buffer) => delen.push(d)).on('error', fout).on('end', () => klaar())
    })
    const uit = Buffer.concat(delen)
    if (uit.length) return uit
  }
  return Buffer.alloc(0)
}

/** De tekst van een oude PowerPoint: de tekstatomen (TextChars en TextBytes) uit de stroom PowerPoint Document. */
export function pptTekstUitStroom(s: Buffer): string {
  const uit: string[] = []
  const loop = (van: number, tot: number, diepte: number) => {
    let p = van
    while (p + 8 <= tot) {
      const versie = s.readUInt16LE(p) & 0x0f
      const soort = s.readUInt16LE(p + 2)
      const lengte = s.readUInt32LE(p + 4)
      const eind = Math.min(tot, p + 8 + lengte)
      if (versie === 0x0f && diepte < 32) loop(p + 8, eind, diepte + 1)
      else if (soort === 0x0fa0) uit.push(s.subarray(p + 8, eind).toString('utf16le'))
      else if (soort === 0x0fa8) uit.push(s.subarray(p + 8, eind).toString('latin1'))
      p = eind
    }
  }
  loop(0, s.length, 0)
  return uit.map((t) => t.replace(/\r|\v/g, '\n').trim()).filter(Boolean).join('\n')
}

/** De tekst van een oude Excel (BIFF8): de gedeelde tekstentabel (SST) met de vervolgrecords (CONTINUE). */
export function xlsTekstUitStroom(s: Buffer): string {
  const blokken: Buffer[] = []
  let p = 0
  let inSst = false
  while (p + 4 <= s.length) {
    const soort = s.readUInt16LE(p)
    const lengte = s.readUInt16LE(p + 2)
    const data = s.subarray(p + 4, p + 4 + lengte)
    if (soort === 0x00fc) { inSst = true; blokken.push(data) }
    else if (soort === 0x003c && inSst) blokken.push(data)
    else if (inSst) break
    p += 4 + lengte
  }
  if (!blokken.length) return ''
  let b = 0
  let q = 8
  const beschikbaar = () => { while (b < blokken.length && q >= blokken[b]!.length) { b++; q = 0 } return b < blokken.length }
  const byte = () => (beschikbaar() ? blokken[b]![q++]! : 0)
  const u16 = () => byte() | (byte() << 8)
  const u32 = () => (u16() | (u16() << 16)) >>> 0
  const sla = (n: number) => { for (let i = 0; i < n && beschikbaar(); i++) q++ }
  const teksten: string[] = []
  const aantal = blokken[0]!.length >= 8 ? blokken[0]!.readUInt32LE(4) : 0
  for (let n = 0; n < aantal && beschikbaar(); n++) {
    const tekens = u16()
    const vlag = byte()
    let breed = (vlag & 1) === 1
    const runs = vlag & 8 ? u16() : 0
    const ext = vlag & 4 ? u32() : 0
    let t = ''
    for (let i = 0; i < tekens; i++) {
      if (!beschikbaar()) break
      if (q === 0 && b > 0) breed = (byte() & 1) === 1 // een vervolgrecord begint midden in een tekst met een nieuwe vlag
      t += String.fromCharCode(breed ? u16() : byte())
    }
    sla(runs * 4 + ext)
    if (t.trim()) teksten.push(t.trim())
  }
  return teksten.join('\n')
}

/** De tekst van een doc, ppt of xls (oude Office-formaten). */
export async function oudOfficeTekst(mime: string, buf: Buffer): Promise<string> {
  if (buf.length < 512 || buf.readUInt32BE(0) !== 0xd0cf11e0) return ''
  if (/msword/.test(mime)) {
    const doc = await new WordExtractor().extract(buf)
    return [doc.getBody(), doc.getFootnotes(), doc.getTextboxes?.({ includeHeadersAndFooters: false })].filter(Boolean).join('\n').replace(/\r/g, '\n')
  }
  if (/ms-powerpoint/.test(mime)) return pptTekstUitStroom(await oleStroom(buf, ['PowerPoint Document']))
  if (/ms-excel/.test(mime)) return xlsTekstUitStroom(await oleStroom(buf, ['Workbook', 'Book']))
  return ''
}

/** De tekst van een document en of dat lukte. */
export async function leesDocumentTekst(mime: string, inhoud: Buffer | null | undefined): Promise<{ tekst: string | null; status: TekstStatus }> {
  if (mime.startsWith('image/')) return { tekst: null, status: 'geen' }
  if (!inhoud?.length) return { tekst: null, status: 'niet-gelezen' }
  let tekst = ''
  try {
    if (mime.startsWith('text/')) tekst = inhoud.toString('utf8').replace(/^﻿/, '').replace(/\u0000/g, '')
    else if (/openxmlformats/.test(mime)) tekst = officeTekst(mime, inhoud)
    else if (mime === 'application/pdf') tekst = await pdfTekst(inhoud)
    else if (/msword|ms-excel|ms-powerpoint/.test(mime)) tekst = await oudOfficeTekst(mime, inhoud)
  } catch { tekst = '' }
  tekst = tekst.replace(/\u0000/g, '').replace(/\n{3,}/g, '\n\n').trim()
  return tekst ? { tekst: tekst.slice(0, MAX_TEKST), status: 'gelezen' } : { tekst: null, status: 'niet-gelezen' }
}
