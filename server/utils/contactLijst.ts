// Laden voor de contactlijst (/contacten en /contacten/alle) en de export. Vaste aantallen
// queries, ongeacht het aantal rijen: contacten, accounts, en voor de zichtbare rijen
// één gegroepeerde query voor open inzichten en één voor de laatste activiteit.
import { and, count, inArray, lte, max, notInArray } from 'drizzle-orm'
import { contactUit } from './accounts'
import { schema } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

/** Activiteiten van het systeem tellen niet als laatste activiteit (zelfde regel als de accountlijst). */
const SYSTEEM_SOORTEN = ['import', 'reis']

export async function contactRijen(tx: Tx, velden: { sleutel: string }[]) {
  const accounts = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, kind: schema.accounts.accountKind, owner: schema.accounts.ownerId, lc: schema.accounts.laatsteContactOp, score: schema.accounts.score, klasse: schema.accounts.klasse }).from(schema.accounts)
  const acc = new Map(accounts.map((a) => [a.id, a]))
  return (await tx.select().from(schema.contacts)).map((c) => {
    const a = acc.get(c.accountId)
    return {
      ...contactUit(c, velden),
      jarenInRol: typeof c.data?.jarenInRol === 'number' ? c.data.jarenInRol : null,
      bedrijf: a?.naam ?? '', soort: a?.kind ?? null, eigenaarId: a?.owner ?? null, accountKlasse: a?.klasse ?? null,
      laatsteContactOp: a?.lc ?? null, score: a?.score ?? 0,
    }
  })
}

export type ContactRij = Awaited<ReturnType<typeof contactRijen>>[number]

/** Open inzichten en laatste activiteit per account, voor de gegeven accounts in twee queries. */
export async function contactExtra(tx: Tx, accountIds: string[], nu = new Date()) {
  const uit = { inzichten: new Map<string, number>(), activiteit: new Map<string, string>() }
  const ids = [...new Set(accountIds)]
  if (!ids.length) return uit
  const inz = await tx.select({ id: schema.signals.accountId, n: count() }).from(schema.signals)
    .where(and(inArray(schema.signals.accountId, ids), inArray(schema.signals.status, ['nieuw', 'gelezen']))).groupBy(schema.signals.accountId)
  const act = await tx.select({ id: schema.activiteiten.accountId, op: max(schema.activiteiten.op) }).from(schema.activiteiten)
    .where(and(inArray(schema.activiteiten.accountId, ids), notInArray(schema.activiteiten.soort, SYSTEEM_SOORTEN), lte(schema.activiteiten.op, nu.toISOString()))).groupBy(schema.activiteiten.accountId)
  for (const r of inz) if (r.id) uit.inzichten.set(r.id, Number(r.n))
  for (const r of act) if (r.id && r.op) uit.activiteit.set(r.id, new Date(r.op).toISOString())
  return uit
}

/** Laatste activiteit: de recentste van activiteit en laatste contact van het account. */
export function laatsteActiviteit(activiteit: string | undefined, laatsteContactOp: string | null): string | null {
  return [activiteit, laatsteContactOp].filter((t): t is string => !!t).map((t) => new Date(t).toISOString()).sort().at(-1) ?? null
}
