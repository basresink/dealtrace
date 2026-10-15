// Bouwcheck voor de platformscheiding (P02, risico "Founder-functies lekken"):
// 1. elk endpoint onder server/api/platform roept zelf requireFounder() aan;
// 2. geen gewoon scherm roept een platformroute aan (alleen de platformschermen
//    en de gele werk-in-balk mogen dat).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

function bestanden(map: string): string[] {
  let uit: string[] = []
  let items: string[] = []
  try { items = readdirSync(map) } catch { return [] }
  for (const n of items) {
    const p = join(map, n)
    if (statSync(p).isDirectory()) uit = uit.concat(bestanden(p))
    else if (/\.(ts|vue)$/.test(n)) uit.push(p)
  }
  return uit
}

const MAG_PLATFORM_AANROEPEN = [
  `app${sep}pages${sep}platform${sep}`,
  `app${sep}components${sep}platform${sep}`,
  `app${sep}components${sep}schil${sep}WerkInBalk.vue`,
]

export function controleerPlatform(root: string): string[] {
  const fouten: string[] = []
  for (const f of bestanden(join(root, 'server', 'api', 'platform'))) {
    const tekst = readFileSync(f, 'utf8')
    if (!/\brequireFounder\(\s*event\s*\)/.test(tekst)) fouten.push(`${relative(root, f)}: roept requireFounder(event) niet aan`)
  }
  for (const f of bestanden(join(root, 'app'))) {
    const rel = relative(root, f)
    if (MAG_PLATFORM_AANROEPEN.some((m) => rel.startsWith(m) || rel === m)) continue
    if (readFileSync(f, 'utf8').includes('/api/platform')) fouten.push(`${rel}: een gewoon scherm roept een platformroute aan`)
  }
  return fouten
}
