// POST /api/motor/reminders-sweep: elke 5 minuten (geplande functie, x-motor-secret).
// Taken met een herinnering die aan de beurt is krijgen een melding; daarna gaat de verzender (P26)
// langs alle nieuwe meldingen: per soort naar de app, e-mail en push, met stille uren en bundelen.
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { gebruikDb, metOrganisatie, schema } from '../../utils/db'
import { verzendMeldingen } from '../../utils/meldingVerzender'

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  if (!(geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim)))) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  let aantal = 0
  for (const o of orgs) {
    aantal += await metOrganisatie(o.id, async (tx) => {
      const rijen = (await tx.execute(sql`select id, owner_id, title, due_date, data from tasks where status in ('open', 'bezig') and owner_id is not null
        and data ? 'herinnering' and coalesce((data->'herinnering'->>'verstuurd')::boolean, false) = false
        and due_date - make_interval(mins => (data->'herinnering'->>'minuten')::int) <= now()`)).rows as { id: string; owner_id: string; title: string; data: any }[]
      for (const r of rijen) {
        await tx.insert(schema.notificaties).values({ id: crypto.randomUUID(), organisationId: o.id, gebruikerId: r.owner_id, soort: 'herinnering', titel: `Herinnering: ${r.title}`, tekst: null, link: `/acties?taak=${r.id}`, op: new Date().toISOString(), data: {} })
        await tx.execute(sql`update tasks set data = jsonb_set(data, '{herinnering,verstuurd}', 'true'::jsonb) where id = ${r.id}`)
      }
      return rijen.length
    })
    await metOrganisatie(o.id, (tx) => verzendMeldingen(tx, o.id)).catch((e) => console.error(`verzender ${o.id}: ${e?.message}`))
  }
  return { aantal }
})
