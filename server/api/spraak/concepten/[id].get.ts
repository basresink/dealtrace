// GET /api/spraak/concepten/:id: een opdracht die offline is ingesproken en nu klaarstaat.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'spraak.opdracht')
  const id = getRouterParam(event, 'id')!
  const [c] = await metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.execute(sql`select id, uitkomst, status, op from spraak_concepten where id = ${id} and gebruiker_id = ${ctx.gebruiker.id}`)).rows as any[])
  if (!c) throw createError({ statusCode: 404, statusMessage: 'Opdracht niet gevonden' })
  return c
})
