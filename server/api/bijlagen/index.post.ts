// POST /api/bijlagen {id, recordSoort, recordId, soort, mime, data (base64)}: een foto, opname of
// visitekaartje uit de uploadwachtrij. Idempotent op het id dat de telefoon maakte; 413 boven 8 MB.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const b = await readBody<{ id?: string; recordSoort?: string; recordId?: string; soort?: string; mime?: string; data?: string }>(event)
  if (!b?.id || !/^[0-9a-f-]{36}$/i.test(b.id) || !b.data || !['foto', 'opname', 'visitekaartje'].includes(b.soort ?? '')) throw createError({ statusCode: 400, statusMessage: 'Bijlage onvolledig' })
  if (!/^(image\/(jpeg|png|webp)|audio\/(webm|ogg|mp4))(;.*)?$/.test(b.mime ?? '')) throw createError({ statusCode: 415, statusMessage: 'Alleen foto\'s en opnames' })
  const inhoud = Buffer.from(b.data, 'base64')
  if (inhoud.length > 8_000_000) throw createError({ statusCode: 413, statusMessage: 'De bijlage is te groot' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud) values (${b.id}, ${ctx.organisatie!.id}, ${ctx.gebruiker.id}, ${b.recordSoort ?? 'appointments'}, ${b.recordId ?? ''}, ${b.soort}, ${b.mime}, ${inhoud.length}, ${inhoud})
      on conflict (id) do nothing`)
    return { id: b.id, status: 'verstuurd' }
  })
})
