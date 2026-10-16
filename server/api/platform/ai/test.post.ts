// POST /api/platform/ai/test {organisatieId?}: Test verbinding met een kleine vraag aan de provider. Zonder
// sleutel of met AI_PROVIDER=mock antwoordt de mock. Nooit de sleutel in de respons.
import { sql } from 'drizzle-orm'
import { claudeProvider } from '../../../utils/aiKoppeling'
import { ontsleutel } from '../../../utils/geheimen'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const b = await readBody<{ organisatieId?: string | null }>(event).catch(() => ({} as any))
  const org = b?.organisatieId || null
  return alsPlatform(async (tx) => {
    const [k] = (await tx.execute(org ? sql`select id, sleutel, modellen from llm_connections where organisation_id = ${org}` : sql`select id, sleutel, modellen from llm_connections where organisation_id is null`)).rows as any[]
    const sleutel = ontsleutel(k?.sleutel, 'llm')?.sleutel ?? process.env.ANTHROPIC_API_KEY ?? null
    if ((process.env.AI_PROVIDER ?? 'mock') === 'mock' || !sleutel) return { ok: true, melding: 'De mock antwoordt. Zet AI_PROVIDER op claude en bewaar een sleutel voor de echte koppeling.' }
    try {
      await claudeProvider(sleutel, k?.modellen ?? {})({ soort: 'assistent', prompt: 'Antwoord met ok.', materiaal: {}, schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }, poging: 1 })
      if (k) await tx.execute(sql`update llm_connections set getest_op = now() where id = ${k.id}`)
      return { ok: true, melding: 'Claude antwoordt. De koppeling werkt.' }
    } catch (e: any) { return { ok: false, melding: String(e?.message ?? 'De AI-provider is niet bereikbaar') } }
  })
})
