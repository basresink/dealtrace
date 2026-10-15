// POST /api/leads/:id/overnemen {eigenaar, reisId, eersteStap}: in één transactie het account
// (klasse in accounts.klasse, gat 2), contacten, herkomst, bewijs als notitie, instap met
// `lead-overgenomen` en de eerste taak. 409 als de lead al is overgenomen; 422 bij een klant.
import { metOrganisatie } from '../../../utils/db'
import { neemOver, type EersteStap } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.overnemen')
  const b = await readBody<{ eigenaar?: string; reisId?: string; eersteStap?: string }>(event)
  const stap = (['belblok', 'bellen', 'bezoek'] as const).find((s) => s === b?.eersteStap) as EersteStap | undefined
  return metOrganisatie(ctx.organisatie!.id, (tx) => neemOver(tx, ctx.organisatie!.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, getRouterParam(event, 'id')!, { eigenaar: b?.eigenaar ?? null, reisId: b?.reisId ?? null, eersteStap: stap ?? null }))
})
