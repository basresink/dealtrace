// GET /api/funnel/export?...filters: precies wat op het scherm staat als CSV (Expert of salesmanager).
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { filtersUitQuery, funnelCsv, laadFunnel } from '../../utils/funnel'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'funnel.eigen')
  if (!kan(ctx, 'funnel.export') && !kan(ctx, 'funnel.team')) throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar', data: { functie: 'funnel.export', reden: 'niveau' } })
  const q = getQuery(event)
  const csv = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const { f } = await filtersUitQuery(tx, { gebruiker: ctx.gebruiker, kan: (x) => kan(ctx, x) }, q)
    return funnelCsv(await laadFunnel(tx, f, { details: true }))
  })
  const naam = ['funnel', ...['periode', 'doelgroep', 'reis', 'campagne', 'gebruiker', 'team', 'kanaal'].filter((k) => typeof q[k] === 'string' && q[k]).map((k) => `${k}-${String(q[k]).replace(/[^a-z0-9-]/gi, '')}`)].join('_')
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${naam}.csv"`)
  return `﻿${csv}`
})
