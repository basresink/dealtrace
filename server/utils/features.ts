// Features per niveau voor de founder (4.2, F23): het raster en één cel zetten.
// Alles via de platformrol; elke wijziging is een regel in platform_audit.
import { and, eq, isNull, sql } from 'drizzle-orm'
import { FUNCTIES, functie, featureGroep } from '../../shared/functies'
import { NIVEAUS, type Niveau } from '../../shared/types'
import { schema } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export const isNiveaucel = (f: string, n: string) => {
  const d = functie(f)
  return !!d && !(d.rollen !== 'iedereen' && d.rollen.every((r) => r === 'founder')) && (NIVEAUS as readonly string[]).includes(n)
}
export const celObject = (f: string, n: string, org: string | null) => `${f}|${n}|${org ?? 'alle'}`

/** De huidige waarde van een cel: { aan } of null als de rij er niet is. */
export async function leesCel(tx: Tx, f: string, n: Niveau, org: string | null) {
  const [r] = await tx.select().from(schema.functiesPerNiveau).where(and(eq(schema.functiesPerNiveau.functie, f), eq(schema.functiesPerNiveau.niveau, n), org ? eq(schema.functiesPerNiveau.organisationId, org) : isNull(schema.functiesPerNiveau.organisationId)))
  return r ? { aan: r.aan } : null
}

/** Zet of verwijdert een cel (aan: null = afwijking weg). */
export async function zetCel(tx: Tx, f: string, n: Niveau, org: string | null, aan: boolean | null, door: string) {
  const voorwaarde = sql`functie = ${f} and niveau = ${n} and ${org ? sql`organisation_id = ${org}` : sql`organisation_id is null`}`
  if (aan === null) {
    await tx.execute(sql`delete from functies_per_niveau where ${voorwaarde}`)
    return
  }
  const bijgewerkt = await tx.execute(sql`update functies_per_niveau set aan = ${aan}, gewijzigd_door = ${door}, gewijzigd_op = now() where ${voorwaarde}`)
  if (!bijgewerkt.rowCount) await tx.insert(schema.functiesPerNiveau).values({ id: crypto.randomUUID(), functie: f, niveau: n, aan, organisationId: org, gewijzigdDoor: door, gewijzigdOp: new Date().toISOString() })
}

export async function raster(tx: Tx, org: string | null) {
  const rijen = await tx.select().from(schema.functiesPerNiveau)
  const functies = FUNCTIES.filter((f) => !(f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder'))).map((f) => {
    const cellen = Object.fromEntries(NIVEAUS.map((n) => {
      const alle = rijen.find((r) => r.functie === f.sleutel && r.niveau === n && !r.organisationId)
      const eigen = org ? rijen.find((r) => r.functie === f.sleutel && r.niveau === n && r.organisationId === org) : undefined
      return [n, { aan: eigen ? eigen.aan : !!alle?.aan, standaard: !!alle?.aan, afwijking: !!eigen }]
    }))
    return { sleutel: f.sleutel, naam: f.naam, groep: featureGroep(f.sleutel), pakket: f.pakket, rollen: f.rollen, cellen }
  })
  return functies
}
