// DELETE /api/accounts/:id: alleen salesmanager (eigen teams) en beheerder; contacten
// gaan mee op de server (cascade); de activiteitenlog blijft met "account verwijderd".
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { eigenTeams } from '../../../utils/gebruikers'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.verwijderen')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    if (ctx.gebruiker.rol === 'salesmanager') {
      const [eig] = a.ownerId ? await tx.select({ teamId: schema.users.teamId }).from(schema.users).where(eq(schema.users.id, a.ownerId)) : []
      const teams = await eigenTeams(tx, ctx.gebruiker.id)
      if (!(eig?.teamId && teams.includes(eig.teamId)) && a.ownerId !== ctx.gebruiker.id) throw createError({ statusCode: 403, statusMessage: 'Dit account hoort niet bij een van je teams' })
    }
    await tx.delete(schema.accounts).where(eq(schema.accounts.id, id))
    await tx.insert(schema.activiteiten).values({ organisationId: ctx.organisatie.id, accountId: id, soort: 'account verwijderd', door: ctx.gebruiker.id, data: { naam: a.name } })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'account.verwijderen', resourceType: 'accounts', resourceId: id, changes: { naam: a.name } })
    setResponseStatus(event, 204)
    return null
  })
})
