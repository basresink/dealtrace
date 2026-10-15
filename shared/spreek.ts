// Voorlezen (P32, 8.9): de dag als tekst voor het oor. Hele zinnen, getallen tot twintig in
// woorden, bedragen uitgeschreven, geen opsommingstekens, hooguit 60 seconden (150 woorden).
import type { Dag } from './dag'
import type { Focus } from './dagritme'
import type { Recap } from './recap'

export const MAX_WOORDEN = 150
const WOORD = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien', 'twintig']
export const getal = (n: number) => (n >= 0 && n <= 20 && Number.isInteger(n) ? WOORD[n]! : String(n))
const meer = (n: number, een: string, veel: string) => `${getal(n)} ${n === 1 ? een : veel}`

/** "€ 1.250" wordt "1250 euro"; tijden blijven staan; opsommingstekens en pijlen gaan weg. */
export function voorHetOor(t: string): string {
  return t
    .replace(/€\s?([\d.]+)(?:,(\d{2}))?/g, (_, e: string, c?: string) => `${e.replace(/\./g, '')} euro${c && c !== '00' ? ` en ${Number(c)} cent` : ''}`)
    .replace(/[•·→←*#]|^\s*-\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Zinnen toevoegen tot het woordenplafond; nooit een halve zin. */
function binnenPlafond(zinnen: string[]): string {
  const uit: string[] = []
  let woorden = 0
  for (const z of zinnen.map(voorHetOor).filter(Boolean)) {
    const n = z.split(/\s+/).length
    if (woorden + n > MAX_WOORDEN) break
    uit.push(/[.!?]$/.test(z) ? z : `${z}.`)
    woorden += n
  }
  return uit.join(' ')
}

export function spreekDag(dag: Dag, focus: Focus | null, groet: string, extra: { signaal?: { titel: string } | null; recap?: Recap | null } = {}): string {
  const s = dag.stapels
  const zinnen = [groet]
  if (focus) zinnen.push(`Je eerste zet: ${focus.knop.tekst}. ${focus.waarom}`)
  const delen: string[] = []
  if (s.afspraken.length) delen.push(meer(s.afspraken.length, 'afspraak', 'afspraken'))
  if (s.bellen.length) delen.push(meer(s.bellen.length, 'belactie', 'belacties'))
  if (s.acties.length) delen.push(meer(s.acties.length, 'andere actie', 'andere acties'))
  if (delen.length) zinnen.push(`Vandaag staan er ${delen.length > 1 ? `${delen.slice(0, -1).join(', ')} en ${delen.at(-1)}` : delen[0]} voor je klaar`)
  else zinnen.push('Er staat vandaag niets dringends klaar')
  if (dag.achterstand) zinnen.push(`Daarvan ${dag.achterstand === 1 ? 'is er één' : `zijn er ${getal(dag.achterstand)}`} achterstallig`)
  const eerste = s.afspraken.find((a) => a.tijd && !a.zonderVerslag)
  if (eerste) zinnen.push(`Je eerste afspraak is om ${eerste.tijd} bij ${eerste.accountNaam ?? 'een prospect'}`)
  if (extra.signaal) zinnen.push(`Let op: ${extra.signaal.titel}`)
  if (extra.recap) zinnen.push(spreekRecap(extra.recap))
  return binnenPlafond(zinnen)
}

export function spreekRecap(r: Recap): string {
  return binnenPlafond([`${r.titel}`, ...r.regels, ...r.risicos.map((x) => `Let op: ${x}`), ...(r.week ? [r.week] : [])])
}
