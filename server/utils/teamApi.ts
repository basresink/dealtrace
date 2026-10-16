// Gedeeld door de team-, coaching- en analyse-endpoints (P21): de periode uit de URL.
import { nlMoment } from '../../shared/datum'
import { periodeVoor, PERIODE_LABEL, type Periode, type PeriodeSleutel } from '../../shared/team'

export function periodeUitQuery(q: Record<string, unknown>, standaard: PeriodeSleutel = 'week', nu = new Date()): Periode & { sleutel: string; label: string } {
  const vandaag = nlMoment(nu).datum
  const van = typeof q.van === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.van) ? q.van : null
  const tot = typeof q.tot === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.tot) ? q.tot : null
  if (van && tot && van <= tot) return { van, tot, sleutel: 'eigen', label: `${van} tot ${tot}` }
  const s = (typeof q.periode === 'string' && q.periode in PERIODE_LABEL ? q.periode : standaard) as PeriodeSleutel
  return { ...periodeVoor(s, vandaag), sleutel: s, label: PERIODE_LABEL[s] }
}
