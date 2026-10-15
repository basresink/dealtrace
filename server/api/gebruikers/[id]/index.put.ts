// PUT /api/gebruikers/:id: naam, rol, team en werkplek wijzigen (beheerder).
// Vangrails: de founderrol is niet uit te delen; de laatste beheerder blijft beheerder.
import { eq } from 'drizzle-orm'
import { WERKPLEKKEN } from '../../../../shared/types'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { andereBeheerders, gebruikerRij } from '../../../utils/gebruikers'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder wijzigt gebruikers' })
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ naam?: string; rol?: string; teamId?: string | null; werkplek?: string }>(event)

  return metOrganisatie(organisatie.id, async (tx) => {
    const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, id))
    if (!doel) throw createError({ statusCode: 404, statusMessage: 'Gebruiker onbekend' })
    const wijziging: Partial<typeof schema.users.$inferInsert> = {}
    if (b.naam !== undefined) {
      if (!b.naam.trim()) throw createError({ statusCode: 400, statusMessage: 'Naam is verplicht' })
      wijziging.name = b.naam.trim()
    }
    if (b.rol !== undefined && b.rol !== doel.role) {
      if (!['accountmanager', 'salesmanager', 'beheerder'].includes(b.rol)) throw createError({ statusCode: 400, statusMessage: 'Onbekende rol' })
      if (doel.role === 'beheerder' && (await andereBeheerders(tx, doel.id)) === 0) {
        throw createError({ statusCode: 409, statusMessage: 'De laatste beheerder blijft beheerder' })
      }
      wijziging.role = b.rol
      if (b.rol === 'salesmanager' && doel.niveau === 'beginner') wijziging.niveau = 'expert'
    }
    if (b.teamId !== undefined) wijziging.teamId = b.teamId
    if (b.werkplek !== undefined) {
      if (!(WERKPLEKKEN as readonly string[]).includes(b.werkplek)) throw createError({ statusCode: 400, statusMessage: 'Onbekend werkplekprofiel' })
      wijziging.werkplek = b.werkplek
    }
    if (!Object.keys(wijziging).length) return gebruikerRij(doel)
    wijziging.updatedAt = new Date().toISOString()
    const [nieuw] = await tx.update(schema.users).set(wijziging).where(eq(schema.users.id, id)).returning()
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'gebruiker.wijzigen', resourceType: 'users', resourceId: id, changes: wijziging })
    return gebruikerRij(nieuw!)
  })
})
