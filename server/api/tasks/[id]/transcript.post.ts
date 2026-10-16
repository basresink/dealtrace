// POST /api/tasks/:id/transcript {tekst, bestandsnaam?}: een geplakt of geüpload transcript bij een beltaak
// (.txt, .md, of een Teams- of Zoom-transcript als .vtt of .srt). Het vervangt een eerder transcript en staat
// op het tabblad Gespreksverslagen van de klant en het contact.
import { sql } from 'drizzle-orm'
import { TRANSCRIPT_MAX_TEKENS, telWoorden, transcriptUitBestand } from '../../../../shared/transcript'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeltaak } from '../../../utils/belverslag'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ tekst?: string; bestandsnaam?: string | null }>(event)
  const naam = b?.bestandsnaam ? String(b.bestandsnaam).slice(0, 200) : null
  const ruw = String(b?.tekst ?? '')
  if (ruw.length > TRANSCRIPT_MAX_TEKENS * 2) throw createError({ statusCode: 413, statusMessage: 'Het transcript is te lang' })
  const tekst = naam && /-->/.test(ruw) ? transcriptUitBestand(naam, ruw).tekst : ruw.trim().slice(0, TRANSCRIPT_MAX_TEKENS)
  if (tekst.length < 5) throw createError({ statusCode: 422, statusMessage: 'Plak of upload eerst een transcript' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisBeltaak(tx, ctx, id)
    await tx.execute(sql`delete from transcripten where record_soort = 'tasks' and record_id = ${id} and bijlage_id is null`)
    const [r] = (await tx.execute(sql`insert into transcripten (organisation_id, record_soort, record_id, tekst, dienst) values (${ctx.organisatie.id}, 'tasks', ${id}, ${tekst}, ${naam ? 'upload' : 'geplakt'}) returning id, op`)).rows as any[]
    await tx.execute(sql`update tasks set data = data || ${JSON.stringify({ transcriptBestand: naam })}::jsonb, updated_at = now() where id = ${id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'taak.transcript', resourceType: 'tasks', resourceId: id, changes: { bron: naam ? 'upload' : 'geplakt', woorden: telWoorden(tekst) } })
    return { id: r.id, tekst, bestandsnaam: naam, bron: naam ? 'upload' : 'geplakt', op: new Date(r.op).toISOString(), woorden: telWoorden(tekst) }
  })
})
