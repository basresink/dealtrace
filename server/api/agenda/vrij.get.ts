// GET /api/agenda/vrij?gebruiker=&dag=&duur=: vrije momenten van jezelf of een collega (binnendienst plant
// voor buitendienst), met bezet uit de gekoppelde agenda, afspraken en belblokken meegeteld (gat 37).
import { nlMoment, nlTijdstip, plusDagen } from '../../../shared/datum'
import { vrijeMomentenAgenda } from '../../../shared/agenda'
import { kan } from '../../utils/accounts'
import { bezetVoor } from '../../utils/agenda'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const q = getQuery(event)
  const gebruiker = typeof q.gebruiker === 'string' && q.gebruiker ? q.gebruiker : ctx.gebruiker.id
  if (gebruiker !== ctx.gebruiker.id && !kan(ctx, 'agenda.voorCollega')) throw createError({ statusCode: 403, statusMessage: 'Plannen voor een collega staat voor jou nog niet aan' })
  const dag = typeof q.dag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.dag) ? q.dag : nlMoment(new Date()).datum
  const duur = Math.max(5, Math.min(480, Number(q.duur) || 30))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const bezet = await bezetVoor(tx, gebruiker, nlTijdstip(dag, 0), nlTijdstip(plusDagen(dag, 1), 0))
    const nu = Date.now()
    return { dag, gebruiker, vrij: vrijeMomentenAgenda(bezet, dag, duur).filter((v) => Date.parse(v.start) > nu), bezet, regiodag: null }
  })
})
