// Een factuur als pdf (één pagina A4, Helvetica, WinAnsi) zonder extra pakket. De inhoud komt uit de
// factuurrij (nummer, bedragen, regels uit Stripe) en de factuurgegevens van de organisatie. Zolang de
// echte Stripe-koppeling er niet is, maakt Dealtrace de pdf zelf; daarna wint de pdf van Stripe.
import { factuurAdresRegels, FACTUUR_STATUS, type Factuurgegevens } from '../../shared/facturatie'

export interface FactuurVoorPdf {
  nummer: string
  bedragCent: number
  btwCent: number
  status: string
  op: string
  vervaltOp: string | null
  betaaldOp: string | null
  regels: { description?: string; amount?: number }[]
}

const euro = (c: number) => `€ ${(c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
const datum = (t: string | null) => (t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(t)) : '')

// WinAnsi: de tekens buiten Latin-1 die we gebruiken; de rest van Latin-1 is gelijk.
const WINANSI: Record<string, number> = { '€': 0x80, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85 }
function pdfTekst(t: string): string {
  let uit = ''
  for (const ch of t.replace(/[–—]/g, '-')) {
    const c = WINANSI[ch] ?? ch.charCodeAt(0)
    const b = c <= 0xff ? c : 0x3f
    const s = String.fromCharCode(b)
    uit += s === '(' || s === ')' || s === '\\' ? `\\${s}` : s
  }
  return uit
}

/** Breedte van een tekst in punten bij Helvetica, grof geschat (voor rechts uitlijnen van bedragen). */
function breedte(t: string, grootte: number): number {
  let w = 0
  for (const ch of t) w += /[0-9€.,]/.test(ch) ? 556 : ch === ' ' ? 278 : /[il.,:;'|]/.test(ch) ? 260 : /[A-Z]/.test(ch) ? 667 : 520
  return (w / 1000) * grootte
}

export function factuurPdf(f: FactuurVoorPdf, g: Factuurgegevens | null, organisatieNaam: string): Buffer {
  const regels: string[] = []
  const tekst = (x: number, y: number, t: string, grootte = 10, vet = false) => regels.push(`BT /${vet ? 'F2' : 'F1'} ${grootte} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfTekst(t)}) Tj ET`)
  const rechts = (xRechts: number, y: number, t: string, grootte = 10, vet = false) => tekst(xRechts - breedte(t, grootte), y, t, grootte, vet)
  const lijn = (y: number) => regels.push(`0.8 w 56 ${y} m 539 ${y} l S`)

  tekst(56, 780, 'Dealtrace', 18, true)
  rechts(539, 780, 'Factuur', 18, true)
  let y = 740
  const adres = g ? factuurAdresRegels(g) : [organisatieNaam]
  tekst(56, y, 'Aan', 9, true)
  for (const r of adres) { y -= 14; tekst(56, y, r, 10) }
  if (g?.email) { y -= 14; tekst(56, y, g.email, 10) }
  let yr = 740
  for (const [l, w] of [['Factuurnummer', f.nummer], ['Factuurdatum', datum(f.op)], ['Vervaldatum', datum(f.vervaltOp)], ['Status', FACTUUR_STATUS[f.status] ?? f.status]] as const) {
    if (!w) continue
    tekst(330, yr, l, 9, true)
    rechts(539, yr, w, 10)
    yr -= 14
  }
  y = Math.min(y, yr) - 36
  tekst(56, y, 'Omschrijving', 9, true)
  rechts(539, y, 'Bedrag', 9, true)
  y -= 8
  lijn(y)
  y -= 16
  const netto = f.bedragCent - f.btwCent
  const lijst = f.regels.length ? f.regels : [{ description: 'Abonnement Dealtrace', amount: netto }]
  for (const r of lijst.slice(0, 30)) {
    tekst(56, y, String(r.description ?? '').slice(0, 80), 10)
    rechts(539, y, euro(Number(r.amount ?? 0)), 10)
    y -= 16
  }
  lijn(y + 6)
  y -= 12
  for (const [l, c, vet] of [['Subtotaal', netto, false], ['Btw 21%', f.btwCent, false], ['Totaal', f.bedragCent, true]] as const) {
    tekst(330, y, l, 10, vet)
    rechts(539, y, euro(c), 10, vet)
    y -= 16
  }
  if (f.status === 'betaald' && f.betaaldOp) { y -= 10; tekst(56, y, `Betaald op ${datum(f.betaaldOp)}. Dank je wel.`, 10) }
  else if (f.status !== 'geannuleerd') { y -= 10; tekst(56, y, 'Betalen gaat via de betaallink in de mail van Dealtrace.', 10) }
  tekst(56, 56, `Dealtrace · factuur ${f.nummer}`, 8)

  const inhoud = regels.join('\n')
  const objecten = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(inhoud, 'latin1')} >>\nstream\n${inhoud}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const posities: number[] = []
  objecten.forEach((o, i) => { posities.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objecten.length + 1}\n0000000000 65535 f \n${posities.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objecten.length + 1} /Root 1 0 R /Info << /Title (${pdfTekst(`Factuur ${f.nummer}`)}) /Producer (Dealtrace) >> >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
