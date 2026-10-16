// GET /api/platform/motor: per organisatie de laatste run, fouten per stap, taken en inzichten, en de runs
// en fouten van de laatste 7 dagen. Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => ({
    klanten: ((await tx.execute(sql`select * from dealtrace_platform_motor()`)).rows as any[]).map((r) => ({
      id: r.organisation_id, naam: r.naam, laatste: r.laatste ? new Date(r.laatste).toISOString() : null, soort: r.soort, taken: r.taken ?? 0, inzichten: r.inzichten ?? 0,
      fouten: (r.fouten ?? []).slice(0, 5), stappen: (r.stappen ?? []).map((s: any) => ({ stap: s.stap, status: s.status, toelichting: s.toelichting ?? null })), runs7d: Number(r.runs_7d), fouten7d: Number(r.fouten_7d),
    })),
  }))
})
