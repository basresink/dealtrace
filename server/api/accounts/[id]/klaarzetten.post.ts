// POST /api/accounts/:id/klaarzetten {voorGebruiker, regioId?, datum?, reden}: de binnendienst zet een
// prospect klaar voor de regiodag van een collega (F10). Zonder datum: de eerstvolgende regiodag in
// de regio van het account. 400 als de collega daar geen regiodag heeft.
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { klaarzetten } from '../../../utils/bezoeken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'bezoeken.klaarzetten')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ voorGebruiker?: string; regioId?: string | null; datum?: string | null; reden?: string }>(event)
  if (!b?.voorGebruiker) throw createError({ statusCode: 400, statusMessage: 'Kies een collega' })
  return metOrganisatie(ctx.organisatie.id, (tx) => klaarzetten(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam }, id, { voorGebruiker: b.voorGebruiker!, regioId: b.regioId ?? null, datum: b.datum ?? null, reden: String(b.reden ?? '').slice(0, 300) }))
})
