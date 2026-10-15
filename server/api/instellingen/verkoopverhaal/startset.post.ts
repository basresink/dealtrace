// POST /api/instellingen/verkoopverhaal/startset: "Kopieer uit startset" (Bijlage C) als concept;
// 409 als er al bevestigde inhoud is. Beheerder.
import voltvast from '../../../../seed/voltvast.json'
import { metOrganisatie } from '../../../utils/db'
import { kopieerStartset } from '../../../utils/vvProjectie'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'De beheerder kopieert de startset' })
  await metOrganisatie(ctx.organisatie.id, (tx) => kopieerStartset(tx, ctx.organisatie.id, (voltvast as any).verkoopverhaal, ctx.gebruiker.id))
  return { ok: true }
})
