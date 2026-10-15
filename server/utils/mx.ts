// MX-controle voor e-mailadressen (15.1), achter een adapter met mock. In tests en
// lokaal draait de mock (geen netwerk). Een time-out telt als "onbekend", niet als fout.
// Gereserveerde domeinen (.test, .example, .invalid, .localhost) zijn altijd onbekend.
import { promises as dns } from 'node:dns'

const cache = new Map<string, boolean | null>()

export function mxModus(): 'mock' | 'dns' {
  return (process.env.MX_MODUS as any) || (process.env.NETLIFY === 'true' ? 'dns' : 'mock')
}

/** true: ontvangt mail; false: geen MX; null: onbekend. */
export async function heeftMx(domein: string): Promise<boolean | null> {
  const d = domein.toLowerCase()
  if (cache.has(d)) return cache.get(d)!
  let uit: boolean | null
  if (mxModus() === 'mock') uit = !/(^|\.)geenmx\.test$/.test(d)
  else if (/\.(test|example|invalid|localhost)$/.test(d)) uit = null
  else {
    uit = await Promise.race([
      dns.resolveMx(d).then((r) => r.length > 0).catch((e) => (['ENOTFOUND', 'ENODATA'].includes(e?.code) ? false : null)),
      new Promise<null>((res) => setTimeout(() => res(null), 2000)),
    ])
  }
  cache.set(d, uit)
  return uit
}
