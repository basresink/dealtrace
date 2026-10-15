// POST /api/import/:id/terugdraaien: verwijdert de accounts uit de batch zonder
// activiteit; samengevoegde accounts krijgen hun oude waarden terug.
import { and, eq, inArray, sql } from 'drizzle-orm'
import { magTerugdraaien } from '../../../../shared/leadGenerator'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'import.terugdraaien')
  const id = getRouterParam(event, 'id')!
  const proef = getQuery(event).proef === '1'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [batch] = await tx.select().from(schema.importBatches).where(eq(schema.importBatches.id, id))
    if (!batch) throw createError({ statusCode: 404, statusMessage: 'Import onbekend' })
    if (batch.gebruikerId !== ctx.gebruiker.id && !['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol)) throw createError({ statusCode: 403, statusMessage: 'Je draait alleen je eigen import terug' })
    if (batch.status === 'teruggedraaid') throw createError({ statusCode: 409, statusMessage: 'Deze import is al teruggedraaid' })
    if (batch.status !== 'verwerkt') throw createError({ statusCode: 409, statusMessage: 'Deze import is nog niet verwerkt' })
    const accounts = await tx.select().from(schema.accounts).where(sql`${schema.accounts.data}->>'importBatchId' = ${id}`)
    const acts = accounts.length ? await tx.select({ accountId: schema.activiteiten.accountId, soort: schema.activiteiten.soort, data: schema.activiteiten.data }).from(schema.activiteiten).where(inArray(schema.activiteiten.accountId, accounts.map((a) => a.id))) : []
    const weg: string[] = []
    let bleven = 0
    for (const a of accounts) {
      if (magTerugdraaien({ data: a.data as any }, acts.filter((x) => x.accountId === a.id), { id, verwerktOp: batch.verwerktOp })) weg.push(a.id)
      else bleven++
    }
    if (proef) return { verwijderd: weg.length, bleven }
    if (weg.length) await tx.delete(schema.accounts).where(and(inArray(schema.accounts.id, weg)))
    // Samengevoegde accounts: herstel de oude waarden, zolang de mens er niets aan veranderde.
    let hersteld = 0
    for (const r of (batch.rapport?.regels ?? []) as any[]) {
      if (r.keuze !== 'samenvoegen' || !r.accountId || !r.voor) continue
      const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, r.accountId))
      if (!a) continue
      const data: any = { ...a.data }
      const kolommen: any = {}
      for (const [veld, oud] of Object.entries(r.voor)) {
        if (data.herkomst?.[veld]?.batchId !== id) continue
        if (veld === 'kvk' || veld === 'domein' || veld === 'postcode') kolommen[veld] = oud
        else if (veld === 'plaats') kolommen.city = oud
        else if (veld.startsWith('cf.')) { if (oud === null) delete data.customFields?.[veld.slice(3)]; else data.customFields[veld.slice(3)] = oud }
        else if (oud === null) delete data[veld]; else data[veld] = oud
        delete data.herkomst[veld]
      }
      await tx.update(schema.accounts).set({ ...kolommen, data }).where(eq(schema.accounts.id, a.id))
      hersteld++
    }
    await tx.update(schema.importBatches).set({ status: 'teruggedraaid', rapport: { ...batch.rapport, teruggedraaid: { verwijderd: weg.length, bleven, hersteld, op: new Date().toISOString() } } }).where(eq(schema.importBatches.id, id))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'import.terugdraaien', resourceType: 'import_batches', resourceId: id, changes: { verwijderd: weg.length, bleven, hersteld } })
    return { verwijderd: weg.length, bleven, hersteld }
  })
})
