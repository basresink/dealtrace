// GET /api/team/cel?gebruiker=&metriek=&periode=: de records achter één cel van de teamtabel; het
// aantal is precies het getal in de cel (P21, acceptatie 2).
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { celRecords, METRIEKEN, ruw, vereisTeamlid, type Metriek } from '../../utils/team'
import { periodeUitQuery } from '../../utils/teamApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.team')
  const q = getQuery(event)
  const m = String(q.metriek ?? '') as Metriek
  if (!METRIEKEN.includes(m)) throw createError({ statusCode: 400, statusMessage: 'Onbekende metriek' })
  const p = periodeUitQuery(q, 'vandaag')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const u = await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, String(q.gebruiker ?? ''))
    return { naam: u.name, metriek: m, records: celRecords(await ruw(tx, [u.id], p), u.id, m) }
  })
})
