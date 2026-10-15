// GET /api/assistent/chats: je eigen gesprekken van de laatste 30 dagen, nieuwste eerst; ?id= geeft één gesprek met berichten.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'assistent.chat')
  const id = getQuery(event).id
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (typeof id === 'string') {
      const [c] = (await tx.execute(sql`select id, context, titel, gemaakt_op from ai_chats where id = ${id} and gebruiker_id = ${ctx.gebruiker.id}`)).rows as any[]
      if (!c) throw createError({ statusCode: 404, statusMessage: 'Gesprek niet gevonden' })
      const berichten = (await tx.execute(sql`select id, rol, tekst, bronnen, acties, credits, op from ai_chat_berichten where chat_id = ${id} order by op`)).rows
      return { ...c, berichten }
    }
    return (await tx.execute(sql`select id, titel, context, gemaakt_op from ai_chats where gebruiker_id = ${ctx.gebruiker.id} and verloopt_op > now() order by gemaakt_op desc limit 30`)).rows
  })
})
