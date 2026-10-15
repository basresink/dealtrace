import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder beheert teams' })
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ naam?: string; managerIds?: string[]; gekoppeldeTeams?: string[] }>(event)
  return metOrganisatie(organisatie.id, async (tx) => {
    const set: Partial<typeof schema.teams.$inferInsert> = { updatedAt: new Date().toISOString() }
    if (b.naam !== undefined) set.naam = b.naam.trim()
    if (b.managerIds) set.managerIds = b.managerIds
    if (b.gekoppeldeTeams) set.gekoppeldeTeams = b.gekoppeldeTeams
    const [t] = await tx.update(schema.teams).set(set).where(eq(schema.teams.id, id)).returning()
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Team onbekend' })
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'team.wijzigen', resourceType: 'teams', resourceId: id, changes: set })
    return { id: t.id, naam: t.naam, managerIds: t.managerIds, gekoppeldeTeams: t.gekoppeldeTeams }
  })
})
