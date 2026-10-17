// Een eenvoudige zip (PKZIP 2.0, deflate) zonder extra pakket: genoeg voor de export van een organisatie.
// Bestandsnamen in UTF-8 (bit 11), geen zip64: één bestand en het geheel blijven onder 4 GB. Teruglezen kan
// met leesZip uit documentTekst.ts (via de centrale map).
import { crc32, deflateRawSync } from 'node:zlib'

export interface ZipBestand { naam: string; inhoud: string | Uint8Array }

function dosTijd(d: Date): { tijd: number; datum: number } {
  return {
    tijd: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export function maakZip(bestanden: readonly ZipBestand[], nu = new Date()): Buffer {
  const { tijd, datum } = dosTijd(nu)
  const delen: Buffer[] = []
  const centraal: Buffer[] = []
  let positie = 0
  for (const b of bestanden) {
    const naam = Buffer.from(b.naam, 'utf8')
    const ruw = typeof b.inhoud === 'string' ? Buffer.from(b.inhoud, 'utf8') : Buffer.from(b.inhoud)
    const ingepakt = deflateRawSync(ruw)
    const crc = crc32(ruw)
    const kop = Buffer.alloc(30)
    kop.writeUInt32LE(0x04034b50, 0)
    kop.writeUInt16LE(20, 4)
    kop.writeUInt16LE(0x0800, 6)
    kop.writeUInt16LE(8, 8)
    kop.writeUInt16LE(tijd, 10)
    kop.writeUInt16LE(datum, 12)
    kop.writeUInt32LE(crc, 14)
    kop.writeUInt32LE(ingepakt.length, 18)
    kop.writeUInt32LE(ruw.length, 22)
    kop.writeUInt16LE(naam.length, 26)
    kop.writeUInt16LE(0, 28)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(20, 4)
    c.writeUInt16LE(20, 6)
    c.writeUInt16LE(0x0800, 8)
    c.writeUInt16LE(8, 10)
    c.writeUInt16LE(tijd, 12)
    c.writeUInt16LE(datum, 14)
    c.writeUInt32LE(crc, 16)
    c.writeUInt32LE(ingepakt.length, 20)
    c.writeUInt32LE(ruw.length, 24)
    c.writeUInt16LE(naam.length, 28)
    c.writeUInt32LE(positie, 42)
    centraal.push(c, naam)
    delen.push(kop, naam, ingepakt)
    positie += kop.length + naam.length + ingepakt.length
  }
  const centraalBuf = Buffer.concat(centraal)
  const eind = Buffer.alloc(22)
  eind.writeUInt32LE(0x06054b50, 0)
  eind.writeUInt16LE(bestanden.length, 8)
  eind.writeUInt16LE(bestanden.length, 10)
  eind.writeUInt32LE(centraalBuf.length, 12)
  eind.writeUInt32LE(positie, 16)
  return Buffer.concat([...delen, centraalBuf, eind])
}
