// POST /api/push/abonneer {endpoint, keys}: dit toestel ontvangt pushmeldingen (F24).
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker } = await vereisSessie(event)
  const b = await readBody<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>(event)
  if (!b?.endpoint?.startsWith('https://') || !b.keys?.p256dh || !b.keys?.auth) throw createError({ statusCode: 400, statusMessage: 'Ongeldig push-abonnement' })
  return metOrganisatie(gebruiker.organisationId!, async (tx) => {
    await tx.execute(sql`insert into push_subscriptions (organisation_id, gebruiker_id, endpoint, data) values (${gebruiker.organisationId}, ${gebruiker.id}, ${b.endpoint}, ${JSON.stringify({ keys: b.keys, toestel: getHeader(event, 'user-agent')?.slice(0, 120) ?? null })}::jsonb)
      on conflict (endpoint) do update set gebruiker_id = excluded.gebruiker_id, data = excluded.data`)
    return { ok: true }
  })
})
