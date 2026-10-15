// GET /api/belblokken/resultaten?gebruiker=&dagen=30: gehouden blokken met bereik en
// afspraken; eigen resultaten, of voor de salesmanager een teamlid.
import { and, desc, eq, gte } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { magTaak } from '../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const q = getQuery(event)
  const wie = typeof q.gebruiker === 'string' && q.gebruiker ? q.gebruiker : ctx.gebruiker.id
  const dagen = Math.min(365, Math.max(1, Number(q.dagen) || 30))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (wie !== ctx.gebruiker.id && !(await magTaak(tx, ctx, wie))) throw createError({ statusCode: 403, statusMessage: 'Alleen je eigen blokken of die van je team' })
    const rijen = await tx.select().from(schema.belblokSessies).where(and(eq(schema.belblokSessies.gebruikerId, wie), eq(schema.belblokSessies.status, 'klaar'), gte(schema.belblokSessies.startOp, new Date(Date.now() - dagen * 864e5).toISOString()))).orderBy(desc(schema.belblokSessies.startOp)).limit(100)
    return rijen.map((s) => ({ id: s.id, start: s.startOp, eind: s.eindOp, soort: s.data.soort, resultaat: s.data.resultaat }))
  })
})
