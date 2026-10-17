// DELETE /api/instellingen/logo: het logo weghalen; de zijbalk toont dan alleen Dealtrace. Alleen de beheerder.
import { rolMag } from '../../../shared/permissions'
import { metOrganisatie } from '../../utils/db'
import { verwijderLogo } from '../../utils/organisatieLogo'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!rolMag(ctx.gebruiker.rol, 'instellingen', 'schrijven')) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder wijzigt het logo' })
  await metOrganisatie(ctx.organisatie.id, (tx) => verwijderLogo(tx, ctx.organisatie.id, ctx.gebruiker.id))
  return { logo: null }
})
