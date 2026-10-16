// DELETE /api/contacten/:id/foto: de foto van het contact weg; daarna staan de initialen er weer.
import { eq, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = await tx.select({ id: schema.contacts.id, data: schema.contacts.data }).from(schema.contacts).where(eq(schema.contacts.id, id))
    if (!c) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const oud = typeof c.data?.fotoId === 'string' ? c.data.fotoId : null
    await tx.execute(sql`update contacts set data = data - 'fotoId', updated_at = now() where id = ${id}`)
    if (oud) await tx.execute(sql`delete from bijlagen where id = ${oud} and record_soort = 'contact' and record_id = ${id}`)
    return { fotoUrl: null }
  })
})
