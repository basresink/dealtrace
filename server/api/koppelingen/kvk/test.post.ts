// POST /api/koppelingen/kvk/test {sleutel?}: test een nieuwe sleutel, of de bewaarde. Uitleg in gewone taal.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { testSleutel } from '../../../utils/bronnen/kvk'
import { ontsleutel } from '../../../utils/geheimen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.kvk')
  const b = await readBody<{ sleutel?: string }>(event).catch(() => ({} as { sleutel?: string }))
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'kvk'))
    const sleutel = b?.sleutel?.trim() || ontsleutel(k?.geheimen)?.sleutel
    if (!sleutel) throw createError({ statusCode: 400, statusMessage: 'Plak eerst de KvK-sleutel' })
    const fout = await testSleutel(sleutel)
    if (!b?.sleutel && k) await tx.update(schema.koppelingen).set({ status: fout ? 'fout' : 'actief', getestOp: new Date().toISOString(), instellingen: { ...k.instellingen, laatsteFout: fout } }).where(eq(schema.koppelingen.id, k.id))
    if (fout) throw createError({ statusCode: 400, statusMessage: fout })
    return { ok: true, tekst: 'De verbinding met KvK werkt.' }
  })
})
