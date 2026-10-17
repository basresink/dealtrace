// PUT /api/teams/:id (beheerder): hernoemen, salesmanager(s) en gekoppelde teams. Managers zijn actieve
// salesmanagers of beheerders van de organisatie; gekoppelde teams bestaan en zijn niet het team zelf.
import { eq, inArray } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder beheert teams' })
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ naam?: string; managerIds?: string[]; gekoppeldeTeams?: string[] }>(event)
  return metOrganisatie(organisatie.id, async (tx) => {
    const [oud] = await tx.select().from(schema.teams).where(eq(schema.teams.id, id))
    if (!oud) throw createError({ statusCode: 404, statusMessage: 'Team onbekend' })
    const set: Partial<typeof schema.teams.$inferInsert> = {}
    if (b.naam !== undefined) {
      if (typeof b.naam !== 'string' || !b.naam.trim()) throw createError({ statusCode: 400, statusMessage: 'Naam is verplicht' })
      if (b.naam.trim() !== oud.naam) set.naam = b.naam.trim()
    }
    if (b.managerIds) {
      const ids = [...new Set(b.managerIds.filter((x) => typeof x === 'string'))]
      const geldig = ids.length ? await tx.select({ id: schema.users.id, role: schema.users.role, status: schema.users.status }).from(schema.users).where(inArray(schema.users.id, ids)) : []
      if (geldig.length !== ids.length || geldig.some((u) => u.status === 'gearchiveerd' || !['salesmanager', 'beheerder'].includes(u.role))) throw createError({ statusCode: 400, statusMessage: 'Kies alleen actieve salesmanagers' })
      set.managerIds = ids
    }
    if (b.gekoppeldeTeams) {
      const ids = [...new Set(b.gekoppeldeTeams.filter((x) => typeof x === 'string' && x !== id))]
      const geldig = ids.length ? await tx.select({ id: schema.teams.id }).from(schema.teams).where(inArray(schema.teams.id, ids)) : []
      if (geldig.length !== ids.length) throw createError({ statusCode: 400, statusMessage: 'Onbekend gekoppeld team' })
      set.gekoppeldeTeams = ids
    }
    if (!Object.keys(set).length) return { id: oud.id, naam: oud.naam, managerIds: oud.managerIds, gekoppeldeTeams: oud.gekoppeldeTeams }
    const [t] = await tx.update(schema.teams).set({ ...set, updatedAt: new Date().toISOString() }).where(eq(schema.teams.id, id)).returning()
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'team.wijzigen', resourceType: 'teams', resourceId: id, changes: set, metadata: set.naam ? { vorigeNaam: oud.naam } : undefined })
    return { id: t!.id, naam: t!.naam, managerIds: t!.managerIds, gekoppeldeTeams: t!.gekoppeldeTeams }
  })
})
