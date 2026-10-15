// PUT /api/waarnemer/profielen {doelgroepId, profiel}: Expert en beheerder. 422 bij een cadans korter dan wekelijks.
import { sql } from 'drizzle-orm'
import { profielFouten, type WaarnemerProfiel } from '../../../shared/agents'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'waarnemer.profielen')
  const b = await readBody<{ doelgroepId?: string | null; profiel?: WaarnemerProfiel }>(event)
  const p = b?.profiel
  if (!p || !Array.isArray(p.signaalsoorten)) throw createError({ statusCode: 400, statusMessage: 'Profiel ontbreekt' })
  const fouten = profielFouten(p)
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0], data: { fouten } })
  const schoon: WaarnemerProfiel = {
    cadansDagen: Math.round(p.cadansDagen),
    signaalsoorten: p.signaalsoorten.map((r) => ({ soort: r.soort, aan: !!r.aan, trefwoorden: (r.trefwoorden ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20), minRelevantie: Math.round(r.minRelevantie), winpuntId: r.winpuntId || null })),
  }
  const doelgroepId = b.doelgroepId || null
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (doelgroepId) {
      const [d] = (await tx.execute(sql`select 1 from doelgroepen where id = ${doelgroepId}`)).rows
      if (!d) throw createError({ statusCode: 404, statusMessage: 'Doelgroep onbekend' })
    }
    const [oud] = (await tx.execute(sql`select id, data from waarnemer_profielen where doelgroep_id is not distinct from ${doelgroepId}`)).rows as any[]
    if (oud) await tx.execute(sql`update waarnemer_profielen set data = ${JSON.stringify(schoon)}::jsonb, versie = versie + 1, updated_at = now(), door = ${ctx.gebruiker.id} where id = ${oud.id}`)
    else await tx.execute(sql`insert into waarnemer_profielen (organisation_id, doelgroep_id, data, door) values (${ctx.organisatie.id}, ${doelgroepId}, ${JSON.stringify(schoon)}::jsonb, ${ctx.gebruiker.id})`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'waarnemer.profiel', resourceType: 'waarnemer_profielen', resourceId: doelgroepId ?? 'alle', changes: { van: oud?.data ?? null, naar: schoon } })
    return { doelgroepId, profiel: schoon }
  })
})
