// POST /api/teams (beheerder): naam, salesmanager(s), gekoppelde buitendienstteams (3.2).
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder beheert teams' })
  const b = await readBody<{ naam?: string; managerIds?: string[]; gekoppeldeTeams?: string[] }>(event)
  if (!b.naam?.trim()) throw createError({ statusCode: 400, statusMessage: 'Naam is verplicht' })
  const nu = new Date().toISOString()
  return metOrganisatie(organisatie.id, async (tx) => {
    const [t] = await tx.insert(schema.teams).values({
      id: crypto.randomUUID(), organisationId: organisatie.id, naam: b.naam!.trim(),
      managerIds: b.managerIds ?? [], gekoppeldeTeams: b.gekoppeldeTeams ?? [], data: {}, createdAt: nu, updatedAt: nu,
    }).returning()
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'team.toevoegen', resourceType: 'teams', resourceId: t!.id, changes: { naam: t!.naam } })
    return { id: t!.id, naam: t!.naam, managerIds: t!.managerIds, gekoppeldeTeams: t!.gekoppeldeTeams }
  })
})
