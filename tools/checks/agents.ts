// Bouwcheck voor de Bewaker (P08, 11.3): geen module in server/utils/agents/ schrijft
// zonder dat eerst de Bewaker heeft getoetst. Per functie op het hoogste niveau:
// - een geëxporteerde functie die schrijft, roept vóór de eerste schrijfactie toets(),
//   magHandelen(), voerUit() of voerGoedgekeurdUit() aan;
// - een interne hulpfunctie die schrijft, wordt alleen aangeroepen in een functie die
//   vóór die aanroep zo'n toets doet.
// Het logboek (agent_runs) en de agentinstellingen (org_settings) zijn geen agenthandeling.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const POORT = /\b(toets|magHandelen|voerUit|voerGoedgekeurdUit)\(/
const SCHRIJF = /\.(insert|update|delete)\(schema\.(\w+)|execute\(sql`\s*(insert|update|delete)\b/g
const VRIJ = new Set(['agentRuns', 'orgSettings'])
const DECL = /^(export\s+)?(async\s+)?(function\s+(\w+)|const\s+(\w+)\s*=)/gm

interface Fn { naam: string; geexporteerd: boolean; start: number; body: string }

function functies(bron: string): Fn[] {
  const uit: Fn[] = []
  const treffers = [...bron.matchAll(DECL)]
  treffers.forEach((m, i) => {
    const start = m.index!
    const eind = i + 1 < treffers.length ? treffers[i + 1]!.index! : bron.length
    uit.push({ naam: m[4] ?? m[5]!, geexporteerd: !!m[1], start, body: bron.slice(start, eind) })
  })
  return uit
}

function eersteSchrijf(body: string): number {
  for (const m of body.matchAll(SCHRIJF)) if (!m[2] || !VRIJ.has(m[2])) return m.index!
  return -1
}

/** Fouten voor één bronbestand. */
export function controleerBron(naam: string, bron: string): string[] {
  const fouten: string[] = []
  const fns = functies(bron)
  for (const f of fns) {
    const s = eersteSchrijf(f.body)
    if (s < 0) continue
    const poort = f.body.search(POORT)
    if (f.geexporteerd) {
      if (poort < 0 || poort > s) fouten.push(`${naam}: ${f.naam} schrijft zonder voorafgaande toets van de Bewaker`)
      continue
    }
    // Interne hulpfunctie: elke aanroep moet na een toets staan.
    const aanroep = new RegExp(`\\b${f.naam}\\(`, 'g')
    for (const g of fns) {
      if (g === f) continue
      for (const m of g.body.matchAll(aanroep)) {
        const p = g.body.search(POORT)
        if (p < 0 || p > m.index!) fouten.push(`${naam}: ${g.naam} roept ${f.naam} aan zonder voorafgaande toets van de Bewaker`)
      }
    }
  }
  return fouten
}

export function controleerAgents(root: string): string[] {
  const map = join(root, 'server', 'utils', 'agents')
  let namen: string[] = []
  try { namen = readdirSync(map).filter((n) => n.endsWith('.ts')) } catch { return [`${map} ontbreekt`] }
  return namen.flatMap((n) => controleerBron(`server/utils/agents/${n}`, readFileSync(join(map, n), 'utf8')))
}
