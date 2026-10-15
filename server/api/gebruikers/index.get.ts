// GET /api/gebruikers: beheerder ziet iedereen, salesmanager zijn teams en zichzelf.
import { asc } from 'drizzle-orm'
import { rolMag } from '../../../shared/permissions'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams, gebruikerRij } from '../../utils/gebruikers'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const { gebruiker, organisatie } = ctx
  if (!['beheerder', 'salesmanager'].includes(gebruiker.rol)) throw createError({ statusCode: 403, statusMessage: 'Geen toegang tot gebruikers' })
  return metOrganisatie(organisatie.id, async (tx) => {
    const alle = await tx.select().from(schema.users).orderBy(asc(schema.users.name))
    const teams = gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, gebruiker.id) : []
    const zichtbaar = alle.filter((u) =>
      rolMag(gebruiker.rol, 'gebruikers', 'lezen', { eigen: u.id === gebruiker.id, team: !!u.teamId && teams.includes(u.teamId) }))
    return zichtbaar.map(gebruikerRij)
  })
})
