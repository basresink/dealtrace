// POST /api/instellingen/logo {data (base64)}: het logo van de organisatie, png, jpg of svg tot 200 kB. De server
// kijkt naar de inhoud zelf (415 bij een ander type of een svg met script of externe verwijzing, 413 als hij te
// groot is). Een vorig logo verdwijnt. Alleen de beheerder; een auditregel.
import { rolMag } from '../../../shared/permissions'
import { LOGO_MAX_BYTES } from '../../../shared/organisatieLogo'
import { metOrganisatie } from '../../utils/db'
import { bewaarLogo, logoUrl } from '../../utils/organisatieLogo'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!rolMag(ctx.gebruiker.rol, 'instellingen', 'schrijven')) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder wijzigt het logo' })
  const b = await readBody<{ data?: string }>(event).catch(() => null)
  if (!b?.data || typeof b.data !== 'string') throw createError({ statusCode: 400, statusMessage: 'Kies een png, jpg of svg.' })
  if (b.data.length > Math.ceil(LOGO_MAX_BYTES * 1.4) + 8) throw createError({ statusCode: 413, statusMessage: 'Het logo is te groot. Kies een bestand van hooguit 200 kB.' })
  const inhoud = Buffer.from(b.data, 'base64')
  const logo = await metOrganisatie(ctx.organisatie.id, (tx) => bewaarLogo(tx, ctx.organisatie.id, ctx.gebruiker.id, inhoud))
  return { logo: logoUrl(logo), mime: logo.mime, grootte: logo.grootte }
})
