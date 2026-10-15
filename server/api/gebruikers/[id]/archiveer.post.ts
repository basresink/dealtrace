// POST /api/gebruikers/:id/archiveer: niet jezelf, niet de laatste beheerder (409).
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { andereBeheerders } from '../../../utils/gebruikers'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder archiveert gebruikers' })
  const id = getRouterParam(event, 'id')!
  if (id === gebruiker.id) throw createError({ statusCode: 409, statusMessage: 'Je kunt jezelf niet archiveren' })
  return metOrganisatie(organisatie.id, async (tx) => {
    const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, id))
    if (!doel) throw createError({ statusCode: 404, statusMessage: 'Gebruiker onbekend' })
    if (doel.role === 'beheerder' && (await andereBeheerders(tx, id)) === 0) throw createError({ statusCode: 409, statusMessage: 'De laatste beheerder kun je niet archiveren' })
    await tx.update(schema.users).set({ status: 'gearchiveerd', updatedAt: new Date().toISOString() }).where(eq(schema.users.id, id))
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'gebruiker.archiveren', resourceType: 'users', resourceId: id })
    return { ok: true }
  })
})
