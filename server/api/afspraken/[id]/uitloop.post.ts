// POST /api/afspraken/:id/uitloop {minuten}: de afspraak loopt uit (15 tot 120 minuten). Het einde schuift
// op, ook in de gekoppelde agenda; heeft de eigenaar vandaag een dagplanning, dan plant de Dagplanner de
// rest van de dag opnieuw en meldt wat er schoof.
import { sql } from 'drizzle-orm'
import { verplaatsAfspraak } from '../../../utils/agenda'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ minuten?: number }>(event).catch(() => ({} as { minuten?: number }))
  const minuten = Number(b?.minuten)
  if (!Number.isInteger(minuten) || minuten < 5 || minuten > 120) throw createError({ statusCode: 422, statusMessage: 'Kies hoeveel minuten de afspraak uitloopt (5 tot 120)' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    await vereisAfspraak(tx, ctx, id)
    const [ap] = (await tx.execute(sql`select start_at, end_at from appointments where id = ${id}`)).rows as { start_at: string; end_at: string }[]
    const duur = Math.round((new Date(ap!.end_at).getTime() - new Date(ap!.start_at).getTime()) / 60_000) + minuten
    const r = await verplaatsAfspraak(tx, ctx.organisatie!.id, id, ctx.gebruiker.id, { start: new Date(ap!.start_at).toISOString(), duurMin: duur })
    return { ...r, tekst: `De afspraak loopt ${minuten} minuten uit.` }
  })
})
