import { asc } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisOrganisatie(event)
  const rijen = await metOrganisatie(organisatie.id, (tx) => tx.select().from(schema.teams).orderBy(asc(schema.teams.naam)))
  return rijen.map((t) => ({ id: t.id, naam: t.naam, managerIds: t.managerIds, gekoppeldeTeams: t.gekoppeldeTeams }))
})
