// POST /api/mij/foto {data (base64)}: je profielfoto, jpg of png tot 1 MB (het scherm verkleint hem
// eerst tot 256 px). Bewaard als bijlage van de gebruiker; een vorige foto verdwijnt.
import { sql } from 'drizzle-orm'
import { FOTO_MAX_BYTES, isJpegOfPng } from '../../../shared/profiel'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Je werkt in een organisatie: je eigen account wijzig je daarbuiten.' })
  const b = await readBody<{ data?: string }>(event)
  if (!b?.data) throw createError({ statusCode: 400, statusMessage: 'Kies een jpg of png.' })
  const inhoud = Buffer.from(b.data, 'base64')
  if (inhoud.length > FOTO_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'De foto is te groot. Kies een jpg of png van hooguit 5 MB.' })
  const mime = isJpegOfPng(inhoud)
  if (!mime) throw createError({ statusCode: 415, statusMessage: 'Dit bestand is geen leesbare jpg of png. Kies een andere foto.' })
  const id = crypto.randomUUID()
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const oud = (ctx.gebruiker.data as any)?.fotoId as string | undefined
    await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud, bewaren_tot, naam)
      values (${id}, ${ctx.organisatie!.id}, ${ctx.gebruiker.id}, 'gebruiker', ${ctx.gebruiker.id}, 'foto', ${mime}, ${inhoud.length}, ${inhoud}, date '9999-12-31', 'profielfoto')`)
    await tx.execute(sql`update users set data = jsonb_set(data, '{fotoId}', to_jsonb(${id}::text)), updated_at = now() where id = ${ctx.gebruiker.id}`)
    if (oud) await tx.execute(sql`delete from bijlagen where id = ${oud} and eigenaar_id = ${ctx.gebruiker.id} and record_soort = 'gebruiker'`)
    return { fotoUrl: `/api/bijlagen/${id}` }
  })
})
