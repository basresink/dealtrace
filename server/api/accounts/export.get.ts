// GET /api/accounts/export?...filters: CSV van de gefilterde lijst (Expert).
import { filtersUitQuery, pasFiltersToe, sorteer } from '../../../shared/accountFilters'
import { accountRijen, effectiefNiveau, eigenVeldenVoor } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const csv = (v: unknown) => { const t = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.export')
  const q = getQuery(event) as Record<string, any>
  const soort = q.soort === 'klant' ? 'klant' : 'prospect'
  const rijen = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    const alle = await accountRijen(tx, soort, velden)
    return { rijen: sorteer(pasFiltersToe(alle, filtersUitQuery(q), { gebruikerId: ctx.gebruiker.id, teamIds: ctx.gebruiker.teamId ? [ctx.gebruiker.teamId] : [], nu: new Date() }), 'naam'), velden }
  })
  const kop = ['naam', 'plaats', 'klasse', 'status', 'score', 'laatste_contact', 'telefoon', ...rijen.velden.map((v) => `cf:${v.sleutel}`)]
  const regels = rijen.rijen.map((r) => [r.name, r.city, r.klasse, r.nbStatus, r.score, r.laatsteContactOp?.slice(0, 10), r.telefoon, ...rijen.velden.map((v) => r.cf[v.sleutel])].map(csv).join(';'))
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="dealtrace-${soort}s.csv"`)
  return '﻿' + [kop.join(';'), ...regels].join('\n')
})
