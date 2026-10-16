// POST /api/accounts/:id/mail {onderwerp, tekst}: een mail die je zelf schrijft vanaf de accountkaart ("+ Mail").
// Wordt een goedgekeurd concept op jouw naam en gaat via dezelfde weg als elk concept: de Bewaker toetst,
// de mailkoppeling verstuurt en de activiteitenlog krijgt de mail.
import { sql } from 'drizzle-orm'
import { verstuurConcept } from '../../../utils/briefing'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'mail.versturen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ onderwerp?: string; tekst?: string }>(event)
  const onderwerp = String(b?.onderwerp ?? '').trim().slice(0, 200)
  const tekst = String(b?.tekst ?? '').trim()
  if (!onderwerp || !tekst) throw createError({ statusCode: 422, statusMessage: 'Vul een onderwerp en een tekst in' })
  const basis = getRequestURL(event).origin
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = (await tx.execute(sql`select id from accounts where id = ${id}`)).rows
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const conceptId = crypto.randomUUID()
    await tx.execute(sql`insert into concepten (id, organisation_id, agent, handeling, gebruiker_id, account_id, concept, status, op, besloten_op)
      values (${conceptId}, ${ctx.organisatie.id}, 'mens', 'mail:handmatig', ${ctx.gebruiker.id}, ${id}, ${JSON.stringify({ type: 'mail', onderwerp, tekst })}::jsonb, 'goedgekeurd', now(), now())`)
    return verstuurConcept(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: (ctx.gebruiker as any).data }, conceptId, basis)
  })
})
