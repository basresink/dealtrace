// DELETE /api/instellingen/bel-me-niet {nummer, reden} (beheerder): van de lijst, alleen met reden (in de audit).
import { sql } from 'drizzle-orm'
import { normaliseerTelefoon } from '../../../../shared/contactgegevens'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.kanalen')
  const b = await readBody<any>(event)
  const n = normaliseerTelefoon(String(b?.nummer ?? ''))
  if (!n.ok) throw createError({ statusCode: 400, statusMessage: n.fout })
  const reden = typeof b?.reden === 'string' ? b.reden.trim() : ''
  if (reden.length < 3) throw createError({ statusCode: 400, statusMessage: 'Geef een reden' })
  const org = ctx.organisatie.id
  return metOrganisatie(org, async (tx) => {
    const r = await tx.execute(sql`delete from bel_me_niet where telefoon_e164 = ${n.e164}`)
    if (!r.rowCount) throw createError({ statusCode: 404, statusMessage: 'Nummer staat niet op de lijst' })
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'belMeNiet.verwijderen', resourceType: 'bel_me_niet', resourceId: n.e164, changes: { reden } })
    return { tekst: 'Van de lijst gehaald.' }
  })
})
