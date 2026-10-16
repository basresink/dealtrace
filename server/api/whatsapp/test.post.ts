// POST /api/whatsapp/test (beheerder): "Test verbinding" met de opgeslagen koppeling.
import { sql } from 'drizzle-orm'
import { whatsappAdapter } from '../../utils/bronnen/whatsapp'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { waKoppeling } from '../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.whatsapp')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const k = await waKoppeling(tx)
    if (!k || k.status !== 'actief') throw createError({ statusCode: 409, statusMessage: 'Koppel eerst WhatsApp Business' })
    const t = await whatsappAdapter(k.config).test()
    if (t.ok) await tx.execute(sql`update koppelingen set getest_op = now() where id = ${k.id}`)
    return t
  })
})
