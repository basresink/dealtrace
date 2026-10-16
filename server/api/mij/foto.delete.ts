// DELETE /api/mij/foto: je profielfoto weg; in het menu staan dan weer je initialen.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Je werkt in een organisatie: je eigen account wijzig je daarbuiten.' })
  const oud = (ctx.gebruiker.data as any)?.fotoId as string | undefined
  await metOrganisatie(ctx.organisatie!.id, async (tx) => {
    await tx.execute(sql`update users set data = data - 'fotoId', updated_at = now() where id = ${ctx.gebruiker.id}`)
    if (oud) await tx.execute(sql`delete from bijlagen where id = ${oud} and eigenaar_id = ${ctx.gebruiker.id} and record_soort = 'gebruiker'`)
  })
  return { fotoUrl: null }
})
