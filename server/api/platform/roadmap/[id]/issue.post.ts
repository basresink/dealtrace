// POST /api/platform/roadmap/:id/issue: "Maak issue" (regel 50). Eerst de status op gestart (kan maar één
// keer, anders 409), dan het issue in GitHub; de bouwketen opent een pull request, nooit een merge. Founder.
import { sql } from 'drizzle-orm'
import { maakGithubIssue } from '../../../../utils/platformBeheer'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const w = await alsPlatform(async (tx) => {
    const [r] = (await tx.execute(sql`select dealtrace_platform_roadmap_zet(${id}, 'gestart', ${null}, ${null}) as s`)).rows as any[]
    if (!r?.s) throw createError({ statusCode: 409, statusMessage: 'Voor deze wens is al een issue gestart' })
    const alle = (await tx.execute(sql`select * from dealtrace_platform_roadmap()`)).rows as any[]
    const x = alle.find((a) => a.id === id)!
    return { id, titel: x.titel, omschrijving: x.omschrijving, organisaties: new Set([x, ...alle.filter((a) => a.samengevoegd_met === id)].map((a) => a.organisation_id)).size }
  })
  const url = await maakGithubIssue(w)
  await alsPlatform(async (tx) => {
    await tx.execute(sql`select dealtrace_platform_roadmap_zet(${id}, ${null}, ${null}, ${url})`)
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'roadmap.issue', object: id, na: { url } })
  })
  return { status: 'gestart', issue: url, tekst: 'Het issue is aangemaakt. De bouwketen opent een pull request.' }
})
