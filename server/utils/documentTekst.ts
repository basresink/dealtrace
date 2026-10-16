// De tekst uit een document halen voor de kennisbank en de AI. Tekst en Markdown direct; Word, PowerPoint en
// Excel (docx, pptx, xlsx) zijn zip-bestanden met XML, die lezen we met zlib uit Node zelf. Voor PDF en de
// oude Office-formaten zit er geen bibliotheek in het project: die krijgen de status niet-gelezen, en de
// flyout zegt dan dat de AI alleen titel, type en koppelingen kent. Afbeeldingen hebben geen tekst.
import { inflateRawSync } from 'node:zlib'

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

/** De tekst van een document en of dat lukte. */
export function leesDocumentTekst(mime: string, inhoud: Buffer | null | undefined): { tekst: string | null; status: TekstStatus } {
  if (mime.startsWith('image/')) return { tekst: null, status: 'geen' }
  if (!inhoud?.length) return { tekst: null, status: 'niet-gelezen' }
  let tekst = ''
  try {
    if (mime.startsWith('text/')) tekst = inhoud.toString('utf8').replace(/^﻿/, '').replace(/\u0000/g, '')
    else if (/openxmlformats/.test(mime)) tekst = officeTekst(mime, inhoud)
  } catch { tekst = '' }
  tekst = tekst.trim()
  return tekst ? { tekst: tekst.slice(0, MAX_TEKST), status: 'gelezen' } : { tekst: null, status: 'niet-gelezen' }
}
