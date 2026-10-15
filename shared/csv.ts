// CSV lezen (F02 import): komma of puntkomma (automatisch), aanhalingstekens,
// regeleinden binnen aanhalingstekens, BOM. Eén plek voor server en tests.
export function leesCsv(tekst: string): string[][] {
  const t = tekst.replace(/^﻿/, '')
  const eersteRegel = t.split(/\r?\n/, 1)[0] ?? ''
  const scheiding = (eersteRegel.match(/;/g)?.length ?? 0) > (eersteRegel.match(/,/g)?.length ?? 0) ? ';' : eersteRegel.includes('\t') && !eersteRegel.includes(',') ? '\t' : ','
  const rijen: string[][] = []
  let rij: string[] = []
  let veld = ''
  let inQuote = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!
    if (inQuote) {
      if (c === '"') { if (t[i + 1] === '"') { veld += '"'; i++ } else inQuote = false }
      else veld += c
    } else if (c === '"') inQuote = true
    else if (c === scheiding) { rij.push(veld); veld = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      rij.push(veld); veld = ''
      if (rij.some((v) => v.trim() !== '')) rijen.push(rij)
      rij = []
    } else veld += c
  }
  rij.push(veld)
  if (rij.some((v) => v.trim() !== '')) rijen.push(rij)
  return rijen.map((r) => r.map((v) => v.trim()))
}

export function schrijfCsv(rijen: unknown[][]): string {
  const cel = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return '﻿' + rijen.map((r) => r.map(cel).join(';')).join('\n')
}
