// GET /api/instellingen/agenda: de agendakoppeling voor de organisatie (beheerder). Of hij aanstaat en
// hoeveel actieve gebruikers hun agenda koppelden; ieder koppelt zelf bij Account (/mij#agenda).
import { sql } from 'drizzle-orm'
import { koppelingAan } from '../../utils/agenda'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder zet de agendakoppeling aan' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = (await tx.execute(sql`select (select count(*)::int from users where status = 'actief' and role <> 'founder') as gebruikers,
      (select count(distinct k.gebruiker_id)::int from agenda_koppelingen k join users u on u.id = k.gebruiker_id where k.status = 'actief' and u.status = 'actief') as gekoppeld`)).rows as any[]
    return { aan: await koppelingAan(tx), gebruikers: t?.gebruikers ?? 0, gekoppeld: t?.gekoppeld ?? 0, providers: ['Microsoft 365', 'Google'] }
  })
})
