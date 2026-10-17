// POST /api/gebruikers/:id/archiveer {naar}: archiveren met overdracht (beheerder). Prospects, open taken en
// lopende reeksen gaan naar `naar` (verplicht zodra er iets is). Niet jezelf, niet de laatste beheerder (409).
import { metOrganisatie } from '../../../utils/db'
import { archiveerMetOverdracht } from '../../../utils/gebruikers'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder archiveert gebruikers' })
  const id = getRouterParam(event, 'id')!
  const b = (await readBody<{ naar?: string | null }>(event).catch(() => null)) ?? {}
  return metOrganisatie(organisatie.id, (tx) => archiveerMetOverdracht(tx, organisatie.id, { id: gebruiker.id, rol: gebruiker.rol }, id, b.naar ?? null))
})
