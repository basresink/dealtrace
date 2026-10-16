// PUT /api/accounts/:id/volgbronnen {bronnen: [{soort: 'url'|'trefwoord', waarde}]}: "Bronnen om te volgen" (P19, Expert).
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { magAccount } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'account.bronnenVolgen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ bronnen?: { soort?: string; waarde?: string; label?: string; op?: string; door?: string }[] }>(event)
  if (!Array.isArray(b?.bronnen) || b.bronnen.length > 20) throw createError({ statusCode: 422, statusMessage: 'Hooguit 20 bronnen per account' })
  const nu = new Date().toISOString()
  const bronnen = b.bronnen.map((x) => {
    const waarde = String(x.waarde ?? '').trim()
    if (x.soort !== 'url' && x.soort !== 'trefwoord') throw createError({ statusCode: 422, statusMessage: 'Een bron is een URL of een trefwoord' })
    if (!waarde || waarde.length > 300) throw createError({ statusCode: 422, statusMessage: 'Vul de bron in' })
    if (x.soort === 'url' && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(waarde)) throw createError({ statusCode: 422, statusMessage: 'Een URL begint met http:// of https://' })
    // Het label komt uit Extra bronnen in het Info-venster; het blijft bewaard.
    return { soort: x.soort, waarde, ...(x.label?.trim() ? { label: x.label.trim().slice(0, 80) } : {}), door: x.door ?? ctx.gebruiker.id, op: x.op ?? nu }
  })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is niet van jou' })
    await tx.execute(sql`update accounts set data = jsonb_set(data, '{volgBronnen}', ${JSON.stringify(bronnen)}::jsonb), updated_at = now() where id = ${id}`)
    return { bronnen }
  })
})
