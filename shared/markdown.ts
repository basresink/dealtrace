// Kleine, veilige Markdown-weergave voor helpartikelen: koppen, alinea's, lijsten,
// tabellen, vet, cursief en links. Alle tekst wordt eerst ge-escaped; links alleen
// naar interne paden of https.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(t: string): string {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, tekst, url) => (/^(\/|https:\/\/)/.test(url) ? `<a href="${url}">${tekst}</a>` : tekst))
}

export function markdownNaarHtml(md: string, opties: { zonderTitel?: string } = {}): string {
  let tekst = md.replace(/\r/g, '')
  // De titel staat al in de kop van de pagina of flyout.
  if (opties.zonderTitel) tekst = tekst.replace(new RegExp(`^#\\s+${opties.zonderTitel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\n`), '')
  const regels = tekst.split('\n')
  const uit: string[] = []
  let i = 0
  while (i < regels.length) {
    const r = regels[i]!
    if (!r.trim()) { i++; continue }
    const kop = /^(#{1,4})\s+(.*)$/.exec(r)
    if (kop) { const n = Math.min(4, kop[1]!.length + 1); uit.push(`<h${n}>${inline(kop[2]!)}</h${n}>`); i++; continue }
    if (/^\|/.test(r)) {
      const rij = (x: string) => x.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const kopRij = rij(r)
      i++
      if (i < regels.length && /^\|?\s*:?-+/.test(regels[i]!)) i++
      const body: string[][] = []
      while (i < regels.length && /^\|/.test(regels[i]!)) body.push(rij(regels[i++]!))
      uit.push(`<table><thead><tr>${kopRij.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((b) => `<tr>${b.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(r)) {
      const genummerd = /^\s*\d+\./.test(r)
      const items: string[] = []
      while (i < regels.length && /^\s*([-*]|\d+\.)\s+/.test(regels[i]!)) items.push(regels[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ''))
      const tag = genummerd ? 'ol' : 'ul'
      uit.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`)
      continue
    }
    const alinea: string[] = []
    while (i < regels.length && regels[i]!.trim() && !/^(#{1,4}\s|\||\s*([-*]|\d+\.)\s)/.test(regels[i]!)) alinea.push(regels[i++]!.trim())
    uit.push(`<p>${inline(alinea.join(' '))}</p>`)
  }
  return uit.join('\n')
}
