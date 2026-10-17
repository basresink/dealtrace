// PUT /api/gebruikers/:id: naam, e-mail, rol, team, werkplek en eigen portefeuille wijzigen (beheerder).
// E-mail is uniek over heel Dealtrace (409).
// Vangrails: de founderrol is niet uit te delen; de laatste beheerder blijft beheerder.
import { eq } from 'drizzle-orm'
import { WERKPLEKKEN } from '../../../../shared/types'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { andereBeheerders, gebruikerRij, persoonWijziging } from '../../../utils/gebruikers'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder wijzigt gebruikers' })
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ naam?: string; email?: string; eigenPortefeuille?: boolean; rol?: string; teamId?: string | null; werkplek?: string }>(event)

  return metOrganisatie(organisatie.id, async (tx) => {
    const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, id))
    if (!doel) throw createError({ statusCode: 404, statusMessage: 'Gebruiker onbekend' })
    const wijziging: Partial<typeof schema.users.$inferInsert> = persoonWijziging(doel, b, b.rol ?? doel.role)
    if (b.rol !== undefined && b.rol !== doel.role) {
      if (!['accountmanager', 'salesmanager', 'beheerder'].includes(b.rol)) throw createError({ statusCode: 400, statusMessage: 'Onbekende rol' })
      if (doel.role === 'beheerder' && (await andereBeheerders(tx, doel.id)) === 0) {
        throw createError({ statusCode: 409, statusMessage: 'De laatste beheerder blijft beheerder' })
      }
      wijziging.role = b.rol
      if (b.rol === 'salesmanager' && doel.niveau === 'beginner') wijziging.niveau = 'expert'
    }
    if (b.teamId !== undefined && b.teamId !== doel.teamId) {
      if (b.teamId) {
        const [t] = await tx.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.id, b.teamId))
        if (!t) throw createError({ statusCode: 400, statusMessage: 'Team onbekend' })
      }
      wijziging.teamId = b.teamId
    }
    if (b.werkplek !== undefined) {
      if (!(WERKPLEKKEN as readonly string[]).includes(b.werkplek)) throw createError({ statusCode: 400, statusMessage: 'Onbekend werkplekprofiel' })
      wijziging.werkplek = b.werkplek
    }
    if (!Object.keys(wijziging).length) return gebruikerRij(doel)
    wijziging.updatedAt = new Date().toISOString()
    let nieuw: typeof schema.users.$inferSelect | undefined
    try {
      [nieuw] = await tx.update(schema.users).set(wijziging).where(eq(schema.users.id, id)).returning()
    } catch (e: any) {
      if (e?.cause?.code === '23505' || e?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Dit e-mailadres is al in gebruik' })
      throw e
    }
    const { data, ...rest } = wijziging
    const changes = data ? { ...rest, eigenPortefeuille: data.eigenPortefeuille === true } : rest
    await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'gebruiker.wijzigen', resourceType: 'users', resourceId: id, changes, metadata: wijziging.email ? { vorigeEmail: doel.email } : undefined })
    return gebruikerRij(nieuw!)
  })
})
