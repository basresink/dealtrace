// PUT /api/coaching/notities/:id {status?} van de manager of {reactie} van de accountmanager zelf (alleen op een afspraak).
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { vereisOrganisatie } from '../../../utils/sessie'
import { vereisTeamlid } from '../../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ status?: string; reactie?: string }>(event)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [n] = (await tx.execute(sql`select * from coaching_notities where id = ${id}`)).rows as any[]
    if (!n) throw createError({ statusCode: 404, statusMessage: 'Notitie onbekend' })
    if (n.gebruiker_id === ctx.gebruiker.id) {
      if (n.soort !== 'afspraak') throw createError({ statusCode: 404, statusMessage: 'Notitie onbekend' })
      const reactie = b?.reactie?.trim()
      if (!reactie) throw createError({ statusCode: 422, statusMessage: 'Schrijf je reactie' })
      await tx.execute(sql`update coaching_notities set data = data || ${JSON.stringify({ reactie: { tekst: reactie.slice(0, 1000), op: new Date().toISOString() } })}::jsonb where id = ${id}`)
      await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${ctx.organisatie!.id}, ${n.manager_id}, 'systeem', 'Reactie op een coachingafspraak', ${reactie.slice(0, 200)}, ${`/coaching/${n.gebruiker_id}`}, now(), '{}'::jsonb)`)
      return { id }
    }
    if (!['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol)) throw createError({ statusCode: 404, statusMessage: 'Notitie onbekend' })
    await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, n.gebruiker_id)
    if (!['open', 'gehaald', 'niet_gehaald'].includes(b?.status ?? '')) throw createError({ statusCode: 422, statusMessage: 'Kies open, gehaald of niet gehaald' })
    await tx.execute(sql`update coaching_notities set status = ${b!.status} where id = ${id}`)
    return { id, status: b!.status }
  })
})
