// PUT /api/mij/profiel {voornaam, achternaam, functie, telefoon, mobiel}: je eigen gegevens. De naam
// wordt "voornaam achternaam"; de losse velden staan in users.data.profiel. Je e-mailadres (waarmee je
// inlogt), rol, niveau en team wijzigt de beheerder. Niet terwijl de founder in een organisatie werkt.
import { sql } from 'drizzle-orm'
import { controleerProfiel } from '../../../shared/profiel'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Je werkt in een organisatie: je eigen account wijzig je daarbuiten.' })
  const c = controleerProfiel(await readBody<Record<string, unknown>>(event))
  if (c.melding) throw createError({ statusCode: 422, statusMessage: c.melding, data: { ongeldig: c.ongeldig } })
  const naam = `${c.schoon.voornaam} ${c.schoon.achternaam}`
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    await tx.execute(sql`update users set name = ${naam}, data = jsonb_set(data, '{profiel}', ${JSON.stringify(c.schoon)}::jsonb), updated_at = now() where id = ${ctx.gebruiker.id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie!.id, actorId: ctx.gebruiker.id, action: 'gebruiker.profiel', resourceType: 'users', resourceId: ctx.gebruiker.id, changes: { naam, functie: c.schoon.functie } })
    return { naam, ...c.schoon }
  })
})
