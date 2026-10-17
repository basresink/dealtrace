// POST /api/koppelingen/agenda/melding: een wijziging in de gekoppelde agenda (webhook van Microsoft 365
// of Google). Geen sessie: het token (clientState of X-Goog-Channel-Token, agendaMeldingToken) zegt van
// welke gebruiker de agenda is en is ondertekend met het agendageheim. Bij de aanmelding van een
// abonnement stuurt Microsoft ?validationToken=, dat gaat ongewijzigd terug. Heeft de gebruiker vandaag
// een dagplanning, dan kijkt de Dagplanner of de vaste punten veranderden en plant hij zo nodig opnieuw.
import { herplanBijWijziging } from '../../../utils/agents/dagplanner'
import { leesAgendaMeldingToken } from '../../../utils/dagplanning'
import { metOrganisatie } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const validatie = getQuery(event).validationToken
  if (typeof validatie === 'string' && validatie) {
    setHeader(event, 'content-type', 'text/plain')
    return validatie.slice(0, 2000)
  }
  const body = await readBody<{ value?: { clientState?: string }[] }>(event).catch(() => null)
  const tokens = [getHeader(event, 'x-goog-channel-token'), ...(Array.isArray(body?.value) ? body!.value.map((v) => v?.clientState) : [])].filter((t): t is string => typeof t === 'string' && !!t).slice(0, 50)
  const wie = new Map<string, { org: string; gebruikerId: string }>()
  for (const t of tokens) { const w = leesAgendaMeldingToken(t); if (w) wie.set(`${w.org}:${w.gebruikerId}`, w) }
  if (!wie.size) throw createError({ statusCode: 401, statusMessage: 'Onbekend of ongeldig token' })
  const nu = new Date()
  for (const w of wie.values()) await metOrganisatie(w.org, (tx) => herplanBijWijziging(tx, w.org, w.gebruikerId, nu, 'agenda')).catch((e) => console.error('agenda-melding', (e as Error).message))
  setResponseStatus(event, 202)
  return { ok: true, gebruikers: wie.size }
})
