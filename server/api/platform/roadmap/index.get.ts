// GET /api/platform/roadmap?status=: het bord over alle klanten: per wens de organisatie, het aantal stemmen,
// het aantal organisaties (met samengevoegde wensen), prioriteit en issue. Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const status = getQuery(event).status
  return alsPlatform(async (tx) => {
    const alle = (await tx.execute(sql`select * from dealtrace_platform_roadmap()`)).rows as any[]
    const hoofd = alle.filter((w) => !w.samengevoegd_met)
    return {
      wensen: hoofd.filter((w) => !status || w.status === status).map((w) => {
        const groep = [w, ...alle.filter((x) => x.samengevoegd_met === w.id)]
        return { id: w.id, titel: w.titel, omschrijving: w.omschrijving, status: w.status, prioriteit: w.prioriteit, issue: w.github_issue_url, klant: w.naam, organisatieId: w.organisation_id,
          organisaties: new Set(groep.map((x) => x.organisation_id)).size, stemmen: groep.reduce((s, x) => s + Number(x.stemmen), 0), op: new Date(w.op).toISOString() }
      }).sort((a, b) => b.organisaties - a.organisaties || b.stemmen - a.stemmen),
    }
  })
})
