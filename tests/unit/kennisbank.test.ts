// Kennisbank: type raden, mimetype, labels, preview, voorgestelde vragen, het materiaal voor de AI (met en zonder
// inhoud), de mock en de bewijsplicht, en de tekst uit tekst, Markdown, docx en pptx (zip met XML), PDF en de
// oude Office-formaten ppt en xls (OLE).
import { crc32, deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { bestandSoort, controleerDocumentAntwoord, documentMateriaal, grootteLabel, mimeVoor, mockDocumentAntwoord, previewSoort, raadType, TOEGESTANE_MIME, voorgesteldeVragen, zoekTermGeldig, MAX_TEKST_AI } from '../../shared/kennisbank'
import { leesDocumentTekst, leesZip, xlsTekstUitStroom } from '../../server/utils/documentTekst'
import { biffRecord, maakOle, maakPdf, pptRecord } from '../fixtures/documenten'
import { FUNCTIES, startindeling } from '../../shared/functies'

/** Een kleine zip met gedeflate bestanden, zoals Word en PowerPoint ze maken. */
function maakZip(bestanden: Record<string, string>): Buffer {
  const lokaal: Buffer[] = []
  const centraal: Buffer[] = []
  let offset = 0
  for (const [naam, tekst] of Object.entries(bestanden)) {
    const ruw = Buffer.from(tekst, 'utf8')
    const data = deflateRawSync(ruw)
    const n = Buffer.from(naam, 'utf8')
    const kop = Buffer.alloc(30)
    kop.writeUInt32LE(0x04034b50, 0); kop.writeUInt16LE(20, 4); kop.writeUInt16LE(8, 8)
    kop.writeUInt32LE(crc32(ruw), 14); kop.writeUInt32LE(data.length, 18); kop.writeUInt32LE(ruw.length, 22); kop.writeUInt16LE(n.length, 26)
    lokaal.push(kop, n, data)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10)
    c.writeUInt32LE(crc32(ruw), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(ruw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42)
    centraal.push(c, n)
    offset += 30 + n.length + data.length
  }
  const cd = Buffer.concat(centraal)
  const eind = Buffer.alloc(22)
  eind.writeUInt32LE(0x06054b50, 0); eind.writeUInt16LE(Object.keys(bestanden).length, 8); eind.writeUInt16LE(Object.keys(bestanden).length, 10)
  eind.writeUInt32LE(cd.length, 12); eind.writeUInt32LE(offset, 16)
  return Buffer.concat([...lokaal, cd, eind])
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

describe('kennisbank: regels', () => {
  it('raadt het type uit de naam', () => {
    expect(raadType('Offerte warmtepompen 2027.pdf')).toBe('offerte')
    expect(raadType('Raamovereenkomst onderhoud.docx')).toBe('contract')
    expect(raadType('Case Testbouw Zwolle.pdf')).toBe('case')
    expect(raadType('Prijslijst Q1.xlsx')).toBe('prijslijst')
    expect(raadType('kick-off.pptx', PPTX)).toBe('presentatie')
    expect(raadType('Productblad buffervat.pdf')).toBe('productinfo')
    expect(raadType('aantekeningen.txt')).toBe('overig')
  })

  it('mimetype uit de naam als de browser er geen geeft; alleen toegestane soorten', () => {
    expect(mimeVoor('notities.md', '')).toBe('text/markdown')
    expect(mimeVoor('x.pdf', 'application/octet-stream')).toBe('application/pdf')
    expect(mimeVoor('x.pdf', 'application/pdf; charset=binary')).toBe('application/pdf')
    expect(TOEGESTANE_MIME.test('text/markdown')).toBe(true)
    expect(TOEGESTANE_MIME.test('application/x-msdownload')).toBe(false)
    expect(TOEGESTANE_MIME.test('text/html')).toBe(false)
  })

  it('labels, preview en voorgestelde vragen', () => {
    expect(bestandSoort('application/pdf')).toBe('PDF')
    expect(bestandSoort(DOCX)).toBe('Word')
    expect(bestandSoort('image/jpeg')).toBe('Afbeelding (JPG)')
    expect(grootteLabel(512)).toBe('512 B')
    expect(grootteLabel(20_480)).toBe('20 kB')
    expect(grootteLabel(2_621_440)).toBe('2,5 MB')
    expect(previewSoort('image/png', false)).toBe('afbeelding')
    expect(previewSoort('application/pdf', false)).toBe('pdf')
    expect(previewSoort(DOCX, true)).toBe('tekst')
    expect(previewSoort(DOCX, false)).toBe('geen')
    for (const t of ['offerte', 'case', 'contract', 'presentatie', 'overig'] as const) expect(voorgesteldeVragen(t)).toHaveLength(3)
    expect(zoekTermGeldig(' a ')).toBeNull()
    expect(zoekTermGeldig(' case ')).toBe('case')
  })

  it('Kennisbank staat niet meer in de zijbalk (ingang via /helpcenter), vanaf Gevorderd, met een helpartikel', () => {
    const f = FUNCTIES.find((x) => x.sleutel === 'nav.kennisbank')!
    expect(f.zijbalk).toBeUndefined()
    expect(f.helpartikel).toBe('kennisbank')
    expect(startindeling().filter((r) => r.functie === 'nav.kennisbank').map((r) => [r.niveau, r.aan])).toEqual([['beginner', false], ['gevorderd', true], ['expert', true]])
  })
})

describe('kennisbank: AI over een document', () => {
  const basis = { naam: 'Case Testbouw Zwolle', type: 'case' as const, versie: '2', mime: 'text/plain', grootte: 2000, bijgewerktOp: '2026-10-01T10:00:00.000Z', door: 'Anouk', beschrijving: null, klanten: ['Testbouw Zwolle'], contacten: [] }

  it('zonder inhoud: alleen de velden, en de mock zegt dat eerlijk', () => {
    const m = documentMateriaal({ ...basis, tekst: null }, 'Wat is de les?')
    expect(m.document).toMatchObject({ inhoud: null, inhoudGelezen: false, type: 'Case', klanten: ['Testbouw Zwolle'] })
    const a = mockDocumentAntwoord(m)
    expect(a.tekst).toContain('alleen de gegevens, niet de inhoud')
    expect(a.tekst).toContain('Testbouw Zwolle')
    expect(a.tekst).toContain('Het lezen van het bestand is mislukt.')
    const foto = mockDocumentAntwoord(documentMateriaal({ ...basis, mime: 'image/png', tekst: null }, 'x'))
    expect(foto.tekst).toContain('afbeelding zonder leesbare tekst')
  })

  it('met inhoud: zinnen die bij de vraag passen, met een letterlijk citaat', () => {
    const tekst = 'De klant wilde minder storingen. Na de overstap daalden de storingen met veertig procent. De monteurs plannen nu per bouwfase.'
    const m = documentMateriaal({ ...basis, tekst }, 'Hoeveel daalden de storingen?')
    const a = mockDocumentAntwoord(m)
    expect(a.tekst).toContain('veertig procent')
    expect(controleerDocumentAntwoord(m, a).bronnen[0]!.citaat).toBe(a.bronnen[0]!.citaat)
  })

  it('een verzonnen citaat valt weg; lange tekst wordt ingekort', () => {
    const m = documentMateriaal({ ...basis, tekst: 'Korte inhoud.' }, 'x')
    const c = controleerDocumentAntwoord(m, { tekst: ' Antwoord ', bronnen: [{ soort: 'document', label: 'x', citaat: 'staat er niet in' }, { soort: 'document', label: 'y', citaat: 'korte  inhoud' }], acties: [{}] })
    expect(c).toEqual({ tekst: 'Antwoord', bronnen: [{ soort: 'document', label: 'y', citaat: 'korte  inhoud' }], acties: [] })
    const lang = documentMateriaal({ ...basis, tekst: 'a'.repeat(MAX_TEKST_AI + 10) }, 'x')
    expect(lang.document.inhoud).toHaveLength(MAX_TEKST_AI)
    expect(lang.document.inhoudIngekort).toBe(true)
  })
})

describe('kennisbank: tekst uitlezen', () => {
  it('tekst en Markdown direct, zonder BOM', async () => {
    expect(await leesDocumentTekst('text/markdown', Buffer.from('﻿# Kop\n\nInhoud.'))).toEqual({ tekst: '# Kop\n\nInhoud.', status: 'gelezen' })
    expect(await leesDocumentTekst('text/plain', Buffer.from('   '))).toEqual({ tekst: null, status: 'niet-gelezen' })
  })

  it('docx: de alinea\'s uit word/document.xml, met entiteiten', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Offerte voor</w:t></w:r><w:r><w:t xml:space="preserve"> Testbouw &amp; Zonen</w:t></w:r></w:p><w:p><w:r><w:t>Looptijd 36 maanden.</w:t></w:r></w:p></w:body></w:document>'
    const zip = maakZip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': xml })
    expect(leesZip(zip).size).toBe(2)
    expect(await leesDocumentTekst(DOCX, zip)).toEqual({ tekst: 'Offerte voor Testbouw & Zonen\nLooptijd 36 maanden.', status: 'gelezen' })
  })

  it('pptx: dia\'s op volgorde', async () => {
    const dia = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`
    const zip = maakZip({ 'ppt/slides/slide10.xml': dia('Tien'), 'ppt/slides/slide2.xml': dia('Twee'), 'ppt/slides/slide1.xml': dia('Een') })
    expect((await leesDocumentTekst(PPTX, zip)).tekst).toBe('Een\n\nTwee\n\nTien')
  })

  it('pdf: de tekstlaag per pagina, een witregel ertussen', async () => {
    const pdf = maakPdf([['Offerte onderhoud Testbouw (fictief)', 'Looptijd 36 maanden.'], ['Prijs per jaar 4.800 euro.']])
    const t = await leesDocumentTekst('application/pdf', pdf)
    expect(t.status).toBe('gelezen')
    expect(t.tekst).toContain('Offerte onderhoud Testbouw (fictief)')
    expect(t.tekst).toContain('Looptijd 36 maanden.')
    expect(t.tekst!.indexOf('Prijs per jaar')).toBeGreaterThan(t.tekst!.indexOf('Looptijd'))
    expect(t.tekst).toMatch(/maanden\.\n\nPrijs/)
  })

  it('pdf zonder tekstlaag (een scan) of kapot: niet gelezen', async () => {
    expect((await leesDocumentTekst('application/pdf', maakPdf([[]]))).status).toBe('niet-gelezen')
    expect((await leesDocumentTekst('application/pdf', Buffer.from('%PDF-1.4 test'))).status).toBe('niet-gelezen')
  })

  it('ppt (oud formaat): de tekstatomen uit PowerPoint Document', async () => {
    const dia = pptRecord(0x03ee, Buffer.concat([
      pptRecord(0x0fa0, Buffer.from('Waarom onderhoud loont', 'utf16le')),
      pptRecord(0x0fa8, Buffer.from('Minder storingen\rLagere kosten', 'latin1')),
    ]), true)
    const ppt = maakOle('PowerPoint Document', pptRecord(0x03e8, dia, true))
    expect(await leesDocumentTekst('application/vnd.ms-powerpoint', ppt)).toEqual({ tekst: 'Waarom onderhoud loont\nMinder storingen\nLagere kosten', status: 'gelezen' })
  })

  it('xls (oud formaat): de gedeelde teksten, ook over een vervolgrecord heen', async () => {
    const tekst = (t: string, breed = false) => Buffer.concat([Buffer.from([t.length & 0xff, t.length >> 8, breed ? 1 : 0]), Buffer.from(t, breed ? 'utf16le' : 'latin1')])
    const sstKop = Buffer.alloc(8); sstKop.writeUInt32LE(3, 0); sstKop.writeUInt32LE(3, 4)
    const derde = tekst('Prijslijst 2026')
    const stroom = Buffer.concat([
      biffRecord(0x0809, Buffer.alloc(16)),
      biffRecord(0x00fc, Buffer.concat([sstKop, tekst('Product'), tekst('Prijs', true), derde.subarray(0, 8)])),
      biffRecord(0x003c, Buffer.concat([Buffer.from([0]), derde.subarray(8)])),
      biffRecord(0x000a, Buffer.alloc(0)),
    ])
    expect(xlsTekstUitStroom(stroom)).toBe('Product\nPrijs\nPrijslijst 2026')
    expect((await leesDocumentTekst('application/vnd.ms-excel', maakOle('Workbook', stroom))).tekst).toBe('Product\nPrijs\nPrijslijst 2026')
  })

  it('kapotte bestanden: niet gelezen; afbeeldingen hebben geen tekst', async () => {
    expect((await leesDocumentTekst('application/msword', Buffer.from('xx'))).status).toBe('niet-gelezen')
    expect((await leesDocumentTekst('application/vnd.ms-excel', maakOle('Iets anders', Buffer.from('x')))).status).toBe('niet-gelezen')
    expect((await leesDocumentTekst(DOCX, Buffer.from('geen zip'))).status).toBe('niet-gelezen')
    expect(await leesDocumentTekst('image/png', Buffer.from('x'))).toEqual({ tekst: null, status: 'geen' })
  })
})
