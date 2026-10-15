// PUT /api/platform/klanten/:id/contract: status, seats, prijs, looptijd, opzegtermijn, proefTot.
import { eq } from 'drizzle-orm'
import { schema } from '../../../../utils/db'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<Partial<schema.Contract>>(event)
  if (b.status && !['proef', 'actief', 'opgezegd'].includes(b.status)) throw createError({ statusCode: 400, statusMessage: 'Onbekende status' })
  if (b.seats !== undefined && !(Number.isInteger(b.seats) && b.seats > 0)) throw createError({ statusCode: 400, statusMessage: 'Seats moet een positief geheel getal zijn' })
  if (b.status === 'proef' && !b.proefTot) throw createError({ statusCode: 400, statusMessage: 'Een proef heeft een einddatum' })
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const toegestaan = ['status', 'seats', 'prijs', 'start', 'looptijdMaanden', 'opzegtermijnMaanden', 'proefTot'] as const
    const contract = { ...(o.contract ?? {}) } as schema.Contract
    for (const k of toegestaan) if (b[k] !== undefined) (contract as any)[k] = b[k]
    if (contract.status !== 'proef') delete contract.proefTot
    await tx.update(schema.organisations).set({ contract, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'contract.wijzigen', object: id, voor: o.contract, na: contract })
    return contract
  })
})
