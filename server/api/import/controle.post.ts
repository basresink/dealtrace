// POST /api/import/controle {batchId, koppeling}: het rapport met tellingen en per regel de standaardkeuze.
import { eq } from 'drizzle-orm'
import type { ImportDoel } from '../../../shared/leadGenerator'
import { effectiefNiveau, eigenVeldenVoor } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { controleer } from '../../utils/importer'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'import.uitvoeren')
  const { batchId, koppeling } = await readBody<{ batchId?: string; koppeling?: ImportDoel[] }>(event)
  if (!batchId || !Array.isArray(koppeling)) throw createError({ statusCode: 400, statusMessage: 'batchId en koppeling zijn verplicht' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [b] = await tx.select().from(schema.importBatches).where(eq(schema.importBatches.id, batchId))
    if (!b) throw createError({ statusCode: 404, statusMessage: 'Import onbekend' })
    if (b.status !== 'concept' || !b.rijen) throw createError({ statusCode: 409, statusMessage: 'Deze import is al verwerkt' })
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    const { regels, rapport } = await controleer(tx, b.rijen, koppeling, velden)
    await tx.update(schema.importBatches).set({ koppeling: Object.fromEntries(koppeling.map((k, i) => [String(i), k])), rapport: { ...rapport, regels } }).where(eq(schema.importBatches.id, batchId))
    return { ...rapport, regels: regels.filter((r) => r.categorie !== 'nieuw'), totaal: regels.length }
  })
})
