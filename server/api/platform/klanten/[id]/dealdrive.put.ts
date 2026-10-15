// PUT /api/platform/klanten/:id/dealdrive {stand}: de founder zet de DealDrive-koppeling van een
// organisatie op uit, mock of http (http komt met P23 en wordt nu nog geweigerd).
import { sql } from 'drizzle-orm'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ stand?: string }>(event)
  if (!['uit', 'mock'].includes(b?.stand ?? '')) throw createError({ statusCode: 400, statusMessage: b?.stand === 'http' ? 'De http-koppeling komt in een volgende versie' : 'Kies uit of mock' })
  return alsPlatform(async (tx) => {
    const [o] = (await tx.execute(sql`select id from organisations where id = ${id} and status <> 'systeem'`)).rows as any[]
    if (!o) throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const [voor] = (await tx.execute(sql`select status, instellingen->>'stand' as stand from koppelingen where organisation_id = ${id} and soort = 'dealdrive'`)).rows as any[]
    const status = b.stand === 'uit' ? 'uit' : 'actief'
    await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, instellingen) values (${id}, 'dealdrive', ${status}, ${JSON.stringify({ stand: b.stand })}::jsonb)
      on conflict (organisation_id, soort) do update set status = excluded.status, instellingen = koppelingen.instellingen || excluded.instellingen, updated_at = now()`)
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'dealdrive.stand', object: id, voor: { stand: voor?.status === 'actief' ? voor.stand : 'uit' }, na: { stand: b.stand } })
    return { stand: b.stand }
  })
})
