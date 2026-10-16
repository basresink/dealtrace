// POST /api/instellingen/bel-me-niet {nummer, reden?} (beheerder): een nummer op de lijst, genormaliseerd
// naar E.164. Contacten met dit nummer krijgen "Bel me niet"; de bellijst slaat ze vanaf nu over.
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
  const reden = typeof b?.reden === 'string' && b.reden.trim() ? b.reden.trim().slice(0, 200) : null
  const org = ctx.organisatie.id
  return metOrganisatie(org, async (tx) => {
    await tx.execute(sql`insert into bel_me_niet (organisation_id, telefoon_e164, door, reden) values (${org}, ${n.e164}, ${ctx.gebruiker.id}, ${reden}) on conflict (organisation_id, telefoon_e164) do update set reden = coalesce(excluded.reden, bel_me_niet.reden)`)
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'belMeNiet.toevoegen', resourceType: 'bel_me_niet', resourceId: n.e164, changes: { reden } })
    return { nummer: n.e164, tekst: 'Het nummer staat op de bel-me-niet-lijst.' }
  })
})
