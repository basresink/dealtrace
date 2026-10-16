// GET /api/analyse/:tabblad?team=&persoon=&periode=&formaat=csv: een analysetabblad (P21) voor de eigen teams.
// De CSV bevat precies de getoonde rijen.
import { naarCsv } from '../../../shared/team'
import { analyse, TABBLADEN, type Tabblad } from '../../utils/analyse'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { periodeUitQuery } from '../../utils/teamApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.analyse')
  const tab = getRouterParam(event, 'tabblad') as Tabblad
  if (!TABBLADEN.includes(tab)) throw createError({ statusCode: 404, statusMessage: 'Onbekend tabblad' })
  const q = getQuery(event)
  const periode = periodeUitQuery(q, 'maand')
  const uit = await metOrganisatie(ctx.organisatie.id, (tx) => analyse(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, tab, { periode, teamId: typeof q.team === 'string' && q.team ? q.team : null, gebruikerId: typeof q.persoon === 'string' && q.persoon ? q.persoon : null }))
  if (q.formaat === 'csv') {
    const t = uit.tabellen[Math.min(Number(q.tabel ?? 0) || 0, uit.tabellen.length - 1)]!
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(event, 'content-disposition', `attachment; filename="analyse-${tab}-${periode.van}.csv"`)
    return `﻿${naarCsv(t.kolommen, t.rijen)}`
  }
  return { ...uit, periode }
})
