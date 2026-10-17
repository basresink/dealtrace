// GET /api/instellingen/facturen/:id/pdf: de factuur als pdf, met de factuurgegevens van de organisatie.
// Alleen de beheerder en alleen een factuur van de eigen organisatie (RLS en een eigen filter; anders 404).
import { sql } from 'drizzle-orm'
import { vereisBeheerder } from '../../../../utils/beheerder'
import { metOrganisatie } from '../../../../utils/db'
import { leesFactuurInstelling } from '../../../../utils/facturatie'
import { factuurPdf } from '../../../../utils/factuurPdf'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'instellingen.abonnement')
  const id = getRouterParam(event, 'id') ?? ''
  const { f, g } = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [f] = (await tx.execute(sql`select nummer, bedrag_cent, btw_cent, status, op, vervalt_op::text as vervalt_op, betaald_op, regels from facturen
      where id = ${id} and organisation_id = ${ctx.organisatie.id}`)).rows as any[]
    return { f, g: f ? await leesFactuurInstelling(tx) : null }
  })
  if (!f) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  const pdf = factuurPdf({
    nummer: f.nummer, bedragCent: f.bedrag_cent, btwCent: f.btw_cent, status: f.status, op: new Date(f.op).toISOString(),
    vervaltOp: f.vervalt_op, betaaldOp: f.betaald_op ? new Date(f.betaald_op).toISOString() : null, regels: Array.isArray(f.regels) ? f.regels : [],
  }, g, ctx.organisatie.naam)
  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition', `attachment; filename="factuur-${String(f.nummer).replace(/[^A-Za-z0-9-]/g, '')}.pdf"`)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return pdf
})
