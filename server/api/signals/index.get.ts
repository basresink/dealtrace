// GET /api/signals: inzichten met filters (gelezen, bron, periode, reis en fase, soort account).
import { and, eq, inArray } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const q = getQuery(event) as Record<string, string | undefined>
  const nu = Date.now()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const statussen = q.gelezen === 'alle' ? ['nieuw', 'gelezen'] : q.gelezen === 'gelezen' ? ['gelezen'] : ['nieuw']
    const rijen = await tx.select().from(schema.signals).where(and(eq(schema.signals.ownerId, ctx.gebruiker.id), inArray(schema.signals.status, ['nieuw', 'gelezen'])))
    const ids = [...new Set(rijen.map((s) => s.accountId).filter(Boolean))] as string[]
    const accounts = ids.length ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, kind: schema.accounts.accountKind, faseId: schema.accounts.faseId, klasse: schema.accounts.klasse }).from(schema.accounts).where(inArray(schema.accounts.id, ids)) : []
    const per = new Map(accounts.map((a) => [a.id, a]))
    const alle = rijen.map((s) => ({
      id: s.id, title: s.title, type: s.type, status: s.status, bron: s.bron, relevantie: s.relevanceScore, createdAt: s.createdAt, ruleId: s.ruleId,
      specifiekeBron: (s.data as any)?.bron?.naam ?? null, waarom: s.data?.waarom ?? null, bewijs: s.data?.bewijs ?? [], voorstel: s.data?.voorstel ?? null,
      account: s.accountId ? { id: s.accountId, naam: per.get(s.accountId)?.naam ?? null, soort: per.get(s.accountId)?.kind ?? null, faseId: per.get(s.accountId)?.faseId ?? null } : null,
    }))
    let lijst = alle.filter((s) => statussen.includes(s.status))
    if (q.soort === 'prospect' || q.soort === 'klant') lijst = lijst.filter((s) => s.account?.soort === q.soort)
    if (q.bron === 'intern' || q.bron === 'extern') lijst = lijst.filter((s) => s.bron === q.bron)
    if (q.periode === 'week') lijst = lijst.filter((s) => nu - Date.parse(s.createdAt) <= 7 * 864e5)
    if (q.fase) lijst = lijst.filter((s) => s.account?.faseId === q.fase)
    lijst.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      tellers: {
        nieuw: alle.filter((s) => s.status === 'nieuw' && nu - Date.parse(s.createdAt) <= 864e5).length,
        hot: alle.filter((s) => s.relevantie >= 75).length,
        week: alle.filter((s) => nu - Date.parse(s.createdAt) <= 7 * 864e5).length,
        open: alle.length,
      },
      inzichten: lijst.slice(0, 200),
    }
  })
})
