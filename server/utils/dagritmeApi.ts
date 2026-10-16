// Kleine controles voor de endpoints van het dagritme.
import { nlMoment, plusDagen } from '../../shared/datum'
import { maandagVan } from '../../shared/weekreview'

/** De week van een review: deze week of de vorige (maandag), anders 400. */
export function reviewWeekUit(week: unknown, nu = new Date()): string {
  const deze = maandagVan(nlMoment(nu).datum)
  if (week === undefined || week === null || week === '') return deze
  if (typeof week !== 'string' || (week !== deze && week !== plusDagen(deze, -7))) throw Object.assign(new Error('Kies deze of vorige week'), { statusCode: 400, statusMessage: 'Kies deze of vorige week' })
  return week
}
