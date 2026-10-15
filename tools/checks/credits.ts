// Bouwcheck (P33): elke AI-aanroep loopt via de creditslaag. De provider (kiesProvider, voerAiKern)
// mag alleen in server/utils/llm-provider.ts worden aangeroepen, en daar alleen binnen
// voerAiStapUit (reserveer en boek) of voerAiStapMetCredits (metCredits). De prijs per handeling
// staat alleen in shared/credits.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

function bestanden(map: string): string[] {
  return readdirSync(map).flatMap((n) => { const p = join(map, n); return statSync(p).isDirectory() ? bestanden(p) : /\.(ts|vue)$/.test(n) ? [p] : [] })
}
export function controleerCredits(root: string): string[] {
  const fouten: string[] = []
  for (const f of [...bestanden(join(root, 'server')), ...bestanden(join(root, 'app'))]) {
    const r = relative(root, f)
    const t = readFileSync(f, 'utf8')
    if (r !== 'server/utils/llm-provider.ts' && /\b(voerAiKern|kiesProvider|mockProvider)\s*\(/.test(t)) fouten.push(`${r}: roept de AI-provider aan buiten de creditslaag`)
    if (/credits:\s*\d+\s*,\s*pakketten:/.test(t)) fouten.push(`${r}: prijs per handeling buiten shared/credits.ts`)
  }
  const p = readFileSync(join(root, 'server/utils/llm-provider.ts'), 'utf8')
  const functies = p.split(/\nexport (?:async )?function /).slice(1)
  for (const fn of functies) {
    const naam = fn.slice(0, fn.indexOf('('))
    if (/\bvoerAiKern\s*\(/.test(fn) && !/\b(reserveer|metCredits)\s*\(/.test(fn)) fouten.push(`server/utils/llm-provider.ts: ${naam} roept voerAiKern aan zonder reserveer of metCredits`)
  }
  return fouten
}
