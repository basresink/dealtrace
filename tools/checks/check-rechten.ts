// Controleert dat elke syncbare tabel op een onderdeel van de rechtenmatrix wijst
// en dat elk onderdeel een rij heeft voor elke rol behalve de founder.
import { MATRIX, ONDERDELEN } from '../../shared/permissions'
import { SYNCBARE_TABELLEN } from '../../shared/syncTabellen'

const fouten: string[] = []
for (const [tabel, onderdeel] of Object.entries(SYNCBARE_TABELLEN)) {
  if (!(ONDERDELEN as readonly string[]).includes(onderdeel)) fouten.push(`${tabel}: onderdeel ${onderdeel} staat niet in de matrix`)
}
for (const o of ONDERDELEN) {
  const rij = (MATRIX as any)[o]
  if (!rij) { fouten.push(`${o}: geen rij in MATRIX`); continue }
  for (const rol of ['accountmanager', 'salesmanager', 'beheerder']) if (!rij[rol]) fouten.push(`${o}: geen rechten voor ${rol}`)
}
if (fouten.length) {
  console.error(fouten.join('\n'))
  process.exit(1)
}
console.log(`check:rechten: ${Object.keys(SYNCBARE_TABELLEN).length} syncbare tabellen en ${ONDERDELEN.length} onderdelen in orde.`)
