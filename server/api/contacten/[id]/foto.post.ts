// POST /api/contacten/:id/foto {data (base64)}: de foto van een contact (opzet uit DealDrive), jpg of png tot
// 1 MB; het scherm verkleint hem eerst tot 256 px. Bewaard als bijlage van het contact (record_soort 'contact');
// een vorige foto verdwijnt. Getoond in de kop van de contactkaart, de contactenlijst en het contactenvenster.
import { eq, sql } from 'drizzle-orm'
import { FOTO_MAX_BYTES, isJpegOfPng } from '../../../../shared/profiel'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ data?: string }>(event)
  if (!b?.data) throw createError({ statusCode: 400, statusMessage: 'Kies een jpg of png.' })
  const inhoud = Buffer.from(b.data, 'base64')
  if (inhoud.length > FOTO_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'De foto is te groot. Kies een jpg of png van hooguit 1 MB.' })
  const mime = isJpegOfPng(inhoud)
  if (!mime) throw createError({ statusCode: 415, statusMessage: 'Dit bestand is geen leesbare jpg of png. Kies een andere foto.' })
  const fotoId = crypto.randomUUID()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = await tx.select({ id: schema.contacts.id, data: schema.contacts.data }).from(schema.contacts).where(eq(schema.contacts.id, id))
    if (!c) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const oud = typeof c.data?.fotoId === 'string' ? c.data.fotoId : null
    await tx.execute(sql`insert into bijlagen (id, organisation_id, eigenaar_id, record_soort, record_id, soort, mime, grootte, inhoud, bewaren_tot, naam)
      values (${fotoId}, ${ctx.organisatie.id}, ${ctx.gebruiker.id}, 'contact', ${id}, 'foto', ${mime}, ${inhoud.length}, ${inhoud}, date '9999-12-31', 'contactfoto')`)
    await tx.execute(sql`update contacts set data = jsonb_set(data, '{fotoId}', to_jsonb(${fotoId}::text)), updated_at = now() where id = ${id}`)
    if (oud) await tx.execute(sql`delete from bijlagen where id = ${oud} and record_soort = 'contact' and record_id = ${id}`)
    return { fotoUrl: `/api/bijlagen/${fotoId}` }
  })
})
