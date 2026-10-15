// POST /api/koppelingen/datacollectief/test {sleutel?}: test een nieuwe of de bewaarde sleutel; de fout in gewone taal.
import { eq } from 'drizzle-orm'
import { testSleutel } from '../../../utils/bronnen/datacollectief'
import { metOrganisatie, schema } from '../../../utils/db'
import { ontsleutel } from '../../../utils/geheimen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.datacollectief')
  const b = await readBody<{ sleutel?: string }>(event).catch(() => ({} as { sleutel?: string }))
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'datacollectief'))
    const sleutel = b?.sleutel?.trim() || ontsleutel(k?.geheimen)?.sleutel
    if (!sleutel) throw createError({ statusCode: 400, statusMessage: 'Plak eerst de Datacollectief-sleutel' })
    const t = await testSleutel(sleutel)
    if (!b?.sleutel && k) await tx.update(schema.koppelingen).set({ status: t.fout ? 'fout' : 'actief', getestOp: new Date().toISOString(), instellingen: { ...k.instellingen, laatsteFout: t.fout, ...(t.tegoed != null ? { tegoed: t.tegoed } : {}) } }).where(eq(schema.koppelingen.id, k.id))
    if (t.fout) throw createError({ statusCode: t.fout.includes('tegoed') ? 402 : 400, statusMessage: t.fout })
    return { ok: true, tegoed: t.tegoed ?? null, tekst: 'De verbinding met Datacollectief werkt.' }
  })
})
