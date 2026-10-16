// Extra bronnen (Info-venster van account en contact): eigen webadressen met een label. Bij een account staan
// ze als URL-bron in data.volgBronnen, zodat de agents ze als volgbron meekrijgen (P19); trefwoorden daar
// blijven staan. Bij een contact staan ze in data.extraBronnen.

export interface ExtraBron { label: string; url: string }
export const MAX_EXTRA_BRONNEN = 20

/** De URL-bronnen uit volgBronnen, als label en url. */
export function extraBronnenUit(volg: unknown): ExtraBron[] {
  if (!Array.isArray(volg)) return []
  return volg.filter((b: any) => b?.soort === 'url' && typeof b.waarde === 'string').map((b: any) => ({ label: String(b.label ?? '').trim() || String(b.waarde).replace(/^https?:\/\//i, '').split('/')[0]!, url: String(b.waarde) }))
}

/** Controleert de invoer; gooit 422 bij een ongeldige bron. */
export function controleerExtraBronnen(invoer: unknown): ExtraBron[] {
  if (!Array.isArray(invoer)) throw createError({ statusCode: 422, statusMessage: 'Geef een lijst met bronnen' })
  if (invoer.length > MAX_EXTRA_BRONNEN) throw createError({ statusCode: 422, statusMessage: `Hooguit ${MAX_EXTRA_BRONNEN} bronnen` })
  return invoer.map((x: any) => {
    let url = String(x?.url ?? '').trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url) || url.length > 300) throw createError({ statusCode: 422, statusMessage: 'Een bron is een webadres dat begint met http:// of https://' })
    const label = String(x?.label ?? '').trim().slice(0, 80) || url.replace(/^https?:\/\//i, '').split('/')[0]!
    return { label, url }
  })
}

/** Zet de extra bronnen als URL-bronnen in volgBronnen; trefwoorden en bestaande metadata blijven. */
export function zetInVolgBronnen(volg: unknown, bronnen: ExtraBron[], door: string, nu = new Date().toISOString()) {
  const oud = Array.isArray(volg) ? volg as any[] : []
  const trefwoorden = oud.filter((b) => b?.soort !== 'url')
  const urls = bronnen.map((b) => {
    const was = oud.find((o) => o?.soort === 'url' && o.waarde === b.url)
    return { soort: 'url', waarde: b.url, label: b.label, door: was?.door ?? door, op: was?.op ?? nu }
  })
  return [...trefwoorden, ...urls]
}
