// Het logo van de organisatie (F22): png, jpg of svg tot 200 kB. Een svg mag geen script, geen
// gebeurtenissen (onload en dergelijke), geen externe verwijzingen en geen ingesloten html bevatten.
// De server controleert de inhoud zelf; de extensie of het opgegeven type telt niet.

export const LOGO_MAX_BYTES = 200_000
export type LogoMime = 'image/png' | 'image/jpeg' | 'image/svg+xml'

export type LogoControle = { ok: true; mime: LogoMime } | { ok: false; fout: string }

const SVG_VERBODEN: readonly [RegExp, string][] = [
  [/<script/i, 'een script'],
  [/\son[a-z]+\s*=/i, 'een gebeurtenis (zoals onload)'],
  [/javascript:/i, 'een javascript-link'],
  [/<foreignObject/i, 'ingesloten html'],
  [/<(iframe|embed|object|audio|video)\b/i, 'ingesloten inhoud'],
  [/<!ENTITY/i, 'een entiteit'],
  [/(?:xlink:)?href\s*=\s*["']\s*(?!#)/i, 'een verwijzing naar een ander bestand'],
  [/url\(\s*["']?\s*(?!#)/i, 'een verwijzing naar een ander bestand'],
  [/@import/i, 'een verwijzing naar een ander bestand'],
]

export function controleerLogo(b: Uint8Array): LogoControle {
  if (!b.length) return { ok: false, fout: 'Het bestand is leeg.' }
  if (b.length > LOGO_MAX_BYTES) return { ok: false, fout: 'Het logo is te groot. Kies een bestand van hooguit 200 kB.' }
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ok: true, mime: 'image/png' }
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ok: true, mime: 'image/jpeg' }
  const tekst = new TextDecoder('utf-8', { fatal: false }).decode(b).replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(tekst)) {
    for (const [re, wat] of SVG_VERBODEN) if (re.test(tekst)) return { ok: false, fout: `Deze svg bevat ${wat}. Kies een svg zonder, of een png.` }
    return { ok: true, mime: 'image/svg+xml' }
  }
  return { ok: false, fout: 'Dit bestand is geen png, jpg of svg. Kies een ander bestand.' }
}
