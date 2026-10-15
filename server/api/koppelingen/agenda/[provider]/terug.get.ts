// GET /api/koppelingen/agenda/:provider/terug?code=&state=: terug van de toestemming. De tokens worden
// met het eigen agendageheim versleuteld bewaard; daarna terug naar Mijn instellingen met een toast.
import { kan } from '../../../../utils/accounts'
import { koppel, koppelingAan, type Provider } from '../../../../utils/agenda'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie, weigerFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const p = getRouterParam(event, 'provider') as Provider
  if (!['microsoft', 'google'].includes(p)) throw createError({ statusCode: 404, statusMessage: 'Onbekende agenda' })
  if (!kan(ctx, 'agenda.koppeling')) weigerFunctie('agenda.koppeling', 'niveau')
  const q = getQuery(event)
  const cookie = getCookie(event, 'dt_agenda_state')
  deleteCookie(event, 'dt_agenda_state', { path: '/' })
  if (!q.code || !q.state || cookie !== `${p}:${q.state}`) return sendRedirect(event, '/mij?agenda=fout')
  await metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await koppelingAan(tx))) throw createError({ statusCode: 403, statusMessage: 'Je beheerder heeft de agendakoppeling nog niet aangezet' })
    await koppel(tx, ctx.organisatie.id, ctx.gebruiker.id, p, String(q.code))
  })
  return sendRedirect(event, '/mij?agenda=gekoppeld')
})
