// Controleert de functiecatalogus: elke functie heeft een unieke sleutel, een naam,
// een pakket, een recht, een helpartikel en uitleg voor de flyout "Nog niet aangezet".
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { FUNCTIES, startindeling } from '../../shared/functies'
import { NIVEAUS, PAKKETTEN } from '../../shared/types'

const fouten: string[] = []
const start = startindeling()
const gezien = new Set<string>()
for (const f of FUNCTIES) {
  if (gezien.has(f.sleutel)) fouten.push(`${f.sleutel}: dubbele sleutel`)
  gezien.add(f.sleutel)
  if (!f.naam?.trim()) fouten.push(`${f.sleutel}: naam ontbreekt`)
  if (!(PAKKETTEN as readonly string[]).includes(f.pakket)) fouten.push(`${f.sleutel}: onbekend pakket`)
  if (f.rollen !== 'iedereen' && !f.rollen.length) fouten.push(`${f.sleutel}: geen rol`)
  const alleenFounder = f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')
  if (!alleenFounder && !f.helpartikel?.trim()) fouten.push(`${f.sleutel}: helpartikel ontbreekt`)
  if (!alleenFounder && f.helpartikel && !existsSync(join(process.cwd(), 'content', 'help', `${f.helpartikel}.md`))) fouten.push(`${f.sleutel}: helpartikel ${f.helpartikel} staat niet in content/help`)
  if (!alleenFounder && start.filter((r) => r.functie === f.sleutel).length !== 3) fouten.push(`${f.sleutel}: geen drie rijen in de startindeling`)
  if (!(NIVEAUS as readonly string[]).includes(f.startNiveau)) fouten.push(`${f.sleutel}: onbekend startniveau`)
  if (!f.uitleg?.watHetDoet || !f.uitleg?.totDieTijd) fouten.push(`${f.sleutel}: uitleg ontbreekt`)
  if (f.zijbalk && !f.zijbalk.route.startsWith('/')) fouten.push(`${f.sleutel}: route begint niet met /`)
}
if (fouten.length) {
  console.error(fouten.join('\n'))
  process.exit(1)
}
console.log(`check:functies: ${FUNCTIES.length} functies in orde.`)
