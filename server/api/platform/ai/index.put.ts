// PUT /api/platform/ai {organisatieId?, provider, sleutel?, modellen?, regio?, geenTraining?}: de AI-koppeling van
// het platform of van één klant. Een nieuwe sleutel vraagt herbevestiging en wordt versleuteld met een eigen
// geheim (LLM_KEY_SECRET); terug komt alleen de vingerafdruk van acht tekens. Founder, platformaudit.
import { sql } from 'drizzle-orm'
import { versleutel } from '../../../utils/geheimen'
import { vingerafdruk } from '../../../utils/salesdnaWebhook'
import { alsPlatform, platformAudit, requireFounder, vereisHerbevestiging } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ organisatieId?: string | null; provider?: string; sleutel?: string; modellen?: Record<string, string>; regio?: string; geenTraining?: boolean }>(event)
  if (b?.provider && !['claude', 'mock'].includes(b.provider)) throw createError({ statusCode: 422, statusMessage: 'Kies Claude of de mock' })
  const sleutel = typeof b?.sleutel === 'string' && b.sleutel.trim() ? b.sleutel.trim() : null
  if (sleutel) vereisHerbevestiging(ctx)
  const modellen = Object.fromEntries(Object.entries(b?.modellen ?? {}).filter(([, v]) => typeof v === 'string' && /^claude-[a-z0-9.-]+$/.test(v)).map(([k, v]) => [k, v]))
  const org = b?.organisatieId || null
  return alsPlatform(async (tx) => {
    const [al] = (await tx.execute(org ? sql`select id, sleutel from llm_connections where organisation_id = ${org}` : sql`select id, sleutel from llm_connections where organisation_id is null`)).rows as any[]
    const versleuteld = sleutel ? versleutel({ sleutel }, 'llm') : al?.sleutel ?? null
    // Een eigen Claude-koppeling zonder sleutel zou de platformkoppeling voor deze klant uitzetten.
    if (org && (b.provider ?? 'claude') === 'claude' && !versleuteld) throw createError({ statusCode: 422, statusMessage: 'Een eigen koppeling heeft een sleutel nodig' })
    if (al) await tx.execute(sql`update llm_connections set provider = ${b.provider ?? 'claude'}, sleutel = ${versleuteld}, modellen = ${JSON.stringify(modellen)}::jsonb, regio = ${b.regio ?? 'EU'}, geen_training = ${b.geenTraining ?? true}, door = ${ctx.gebruiker.id}, op = now() where id = ${al.id}`)
    else await tx.execute(sql`insert into llm_connections (organisation_id, provider, sleutel, modellen, regio, geen_training, door) values (${org}, ${b.provider ?? 'claude'}, ${versleuteld}, ${JSON.stringify(modellen)}::jsonb, ${b.regio ?? 'EU'}, ${b.geenTraining ?? true}, ${ctx.gebruiker.id})`)
    await platformAudit(tx, event, ctx, { organisatieId: org, handeling: sleutel ? 'ai.sleutel' : 'ai.instellingen', object: org ?? 'platform', na: { provider: b.provider ?? 'claude', modellen, sleutelGewijzigd: !!sleutel } })
    return { ok: true, vingerafdruk: sleutel ? vingerafdruk(sleutel) : null, tekst: sleutel ? 'De AI-sleutel is bewaard.' : 'De AI-koppeling is bewaard.' }
  })
})
