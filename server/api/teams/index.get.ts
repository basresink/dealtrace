// GET /api/teams: de beheerder ziet alle teams, een salesmanager de teams die hij leidt plus zijn eigen
// team, een accountmanager alleen zijn eigen team.
import { asc } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { organisatie, gebruiker } = await vereisOrganisatie(event)
  const rijen = await metOrganisatie(organisatie.id, (tx) => tx.select().from(schema.teams).orderBy(asc(schema.teams.naam)))
  const zichtbaar = gebruiker.rol === 'beheerder' ? rijen : rijen.filter((t) => t.id === gebruiker.teamId || (gebruiker.rol === 'salesmanager' && t.managerIds.includes(gebruiker.id)))
  return zichtbaar.map((t) => ({ id: t.id, naam: t.naam, managerIds: t.managerIds, gekoppeldeTeams: t.gekoppeldeTeams }))
})
