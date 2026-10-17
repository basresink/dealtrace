// DELETE /api/platform/klanten/:id/ai: de eigen AI-koppeling van een klant weghalen; daarna geldt die van het
// platform. Herbevestiging (de sleutel verdwijnt), platformaudit met de vingerafdruk, nooit de sleutel.
import { sql } from 'drizzle-orm'
import { ontsleutel } from '../../../../utils/geheimen'
import { alsPlatform, platformAudit, requireFounder, vereisHerbevestiging } from '../../../../utils/platform'
import { vingerafdruk } from '../../../../utils/salesdnaWebhook'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  vereisHerbevestiging(ctx)
  return alsPlatform(async (tx) => {
    const [k] = (await tx.execute(sql`select id, provider, sleutel from llm_connections where organisation_id = ${id}`)).rows as any[]
    if (!k) throw createError({ statusCode: 404, statusMessage: 'Deze klant heeft geen eigen koppeling' })
    try {
      await tx.execute(sql`delete from llm_connections where id = ${k.id}`)
    } catch (e: any) {
      if ((e?.cause?.code ?? e?.code) === '42501') throw createError({ statusCode: 409, statusMessage: 'Weghalen kan pas na migratie 0075' })
      throw e
    }
    const s = ontsleutel(k.sleutel, 'llm')?.sleutel
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'ai.eigenWeg', object: id, voor: { provider: k.provider, vingerafdruk: s ? vingerafdruk(s) : null }, na: { koppeling: 'platform' } })
    return { ok: true, tekst: 'De klant gebruikt weer de platformkoppeling.' }
  })
})
