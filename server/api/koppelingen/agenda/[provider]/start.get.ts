// GET /api/koppelingen/agenda/:provider/start: begin van de OAuth-stroom. Zonder echte sleutels gaat de
// mock direct terug met een code; de state staat in een cookie zodat de terugweg te controleren is.
import { kan } from '../../../../utils/accounts'
import { koppelingAan, type Provider } from '../../../../utils/agenda'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie, weigerFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const p = getRouterParam(event, 'provider') as Provider
  if (!['microsoft', 'google'].includes(p)) throw createError({ statusCode: 404, statusMessage: 'Onbekende agenda' })
  if (!kan(ctx, 'agenda.koppeling')) weigerFunctie('agenda.koppeling', 'niveau')
  if (!(await metOrganisatie(ctx.organisatie.id, koppelingAan))) throw createError({ statusCode: 403, statusMessage: 'Je beheerder heeft de agendakoppeling nog niet aangezet' })
  const state = crypto.randomUUID()
  setCookie(event, 'dt_agenda_state', `${p}:${state}`, { httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, maxAge: 600, path: '/' })
  return sendRedirect(event, `/api/koppelingen/agenda/${p}/terug?code=mock-${state.slice(0, 8)}&state=${state}`)
})
