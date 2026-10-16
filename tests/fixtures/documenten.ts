// Kleine fictieve testbestanden voor de kennisbank: een PDF met een tekstlaag en een OLE-bestand (het oude
// Office-formaat) met één stroom. Alleen voor tests; de inhoud is verzonnen.

/** Een geldige PDF van één pagina per regel-lijst, met Helvetica-tekst. */
export function maakPdf(paginas: string[][]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (m) => `\\${m}`)
  const objecten: string[] = []
  const n = paginas.length
  // 1 catalogus, 2 paginaboom, 3 lettertype, dan per pagina een pagina en een inhoud
  objecten.push('<< /Type /Catalog /Pages 2 0 R >>')
  objecten.push(`<< /Type /Pages /Kids [${paginas.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`)
  objecten.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  for (const [i, regels] of paginas.entries()) {
    const stroom = `BT /F1 12 Tf 14 TL 72 760 Td ${regels.map((r) => `(${esc(r)}) Tj T*`).join(' ')} ET`
    objecten.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`)
    objecten.push(`<< /Length ${Buffer.byteLength(stroom, 'latin1')} >>\nstream\n${stroom}\nendstream`)
  }
  let pdf = '%PDF-1.4\n'
  const posities: number[] = []
  for (const [i, o] of objecten.entries()) {
    posities.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objecten.length + 1}\n0000000000 65535 f \n${posities.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objecten.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

/** Een OLE-bestand (Compound File, versie 3) met één stroom. De stroom wordt tot 4096 bytes aangevuld, zodat er geen ministroom nodig is. */
export function maakOle(stroomNaam: string, inhoud: Buffer): Buffer {
  const SECTOR = 512
  const EIND = 0xfffffffe
  const VRIJ = 0xffffffff
  const data = Buffer.concat([inhoud, Buffer.alloc(Math.max(0, 4096 - inhoud.length))])
  const dataSectoren = Math.ceil(data.length / SECTOR)
  const kop = Buffer.alloc(SECTOR, 0)
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(kop, 0)
  kop.writeUInt16LE(0x3e, 24); kop.writeUInt16LE(3, 26); kop.writeUInt16LE(0xfffe, 28); kop.writeUInt16LE(9, 30); kop.writeUInt16LE(6, 32)
  kop.writeUInt32LE(1, 44) // aantal FAT-sectoren
  kop.writeUInt32LE(1, 48) // eerste directorysector
  kop.writeUInt32LE(4096, 56)
  kop.writeUInt32LE(EIND, 60); kop.writeUInt32LE(0, 64) // geen mini-FAT
  kop.writeUInt32LE(EIND, 68); kop.writeUInt32LE(0, 72) // geen extra DIFAT
  for (let i = 0; i < 109; i++) kop.writeUInt32LE(i === 0 ? 0 : VRIJ, 76 + i * 4)
  const fat = Buffer.alloc(SECTOR, 0xff)
  fat.writeUInt32LE(0xfffffffd, 0) // de FAT zelf
  fat.writeUInt32LE(EIND, 4) // directory
  for (let i = 0; i < dataSectoren; i++) fat.writeUInt32LE(i === dataSectoren - 1 ? EIND : 3 + i, (2 + i) * 4)
  const map = Buffer.alloc(SECTOR, 0)
  const ingang = (i: number, naam: string, soort: number, kind: number, start: number, grootte: number) => {
    const o = i * 128
    const n = Buffer.from(`${naam}\u0000`, 'utf16le')
    n.copy(map, o)
    map.writeUInt16LE(n.length, o + 64)
    map[o + 66] = soort
    map[o + 67] = 1
    map.writeUInt32LE(VRIJ, o + 68); map.writeUInt32LE(VRIJ, o + 72); map.writeUInt32LE(kind, o + 76)
    map.writeUInt32LE(start, o + 116); map.writeUInt32LE(grootte, o + 120)
  }
  ingang(0, 'Root Entry', 5, 1, EIND, 0)
  ingang(1, stroomNaam, 2, VRIJ, 2, data.length)
  for (const i of [2, 3]) { map.writeUInt32LE(VRIJ, i * 128 + 68); map.writeUInt32LE(VRIJ, i * 128 + 72); map.writeUInt32LE(VRIJ, i * 128 + 76) }
  return Buffer.concat([kop, fat, map, data, Buffer.alloc(dataSectoren * SECTOR - data.length)])
}

/** Een record uit PowerPoint (oud formaat): versie/instantie, soort en lengte, dan de inhoud. */
export function pptRecord(soort: number, inhoud: Buffer, container = false): Buffer {
  const kop = Buffer.alloc(8)
  kop.writeUInt16LE(container ? 0x000f : 0, 0); kop.writeUInt16LE(soort, 2); kop.writeUInt32LE(inhoud.length, 4)
  return Buffer.concat([kop, inhoud])
}

/** Een BIFF-record uit Excel (oud formaat). */
export function biffRecord(soort: number, inhoud: Buffer): Buffer {
  const kop = Buffer.alloc(4)
  kop.writeUInt16LE(soort, 0); kop.writeUInt16LE(inhoud.length, 2)
  return Buffer.concat([kop, inhoud])
}
