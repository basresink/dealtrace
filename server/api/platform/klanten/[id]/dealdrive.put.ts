// PUT /api/platform/klanten/:id/dealdrive {stand, basisUrl?, organisatieId?, geheim?}: de founder richt de
// DealDrive-koppeling van een organisatie in (hoofdstuk 12) en zet de stand op uit, mock of aan. Het
// geheim is schrijf-alleen (AES-256-GCM met een eigen sleutel voor dit doel); terug komt alleen de
// vingerafdruk. Aan kan pas met basis-URL, organisatie-id en geheim. De platformrol leest en schrijft alleen
// deze rij, via de functies dealtrace_platform_dealdrive*.
import { sql } from 'drizzle-orm'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'
import { ontsleutel, versleutel } from '../../../../utils/geheimen'
import { vingerafdruk } from '../../../../utils/salesdnaWebhook'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ stand?: string; basisUrl?: string; organisatieId?: string; geheim?: string }>(event)
  const stand = b?.stand === 'http' ? 'aan' : b?.stand
  if (!['uit', 'mock', 'aan'].includes(stand ?? '')) throw createError({ statusCode: 400, statusMessage: 'Kies uit, mock of aan' })
  const basisUrl = typeof b.basisUrl === 'string' ? b.basisUrl.trim() : undefined
  if (basisUrl && !/^https:\/\/[^\s/]+/.test(basisUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(basisUrl)) throw createError({ statusCode: 422, statusMessage: 'De basis-URL begint met https://' })
  const geheim = typeof b.geheim === 'string' && b.geheim.trim() ? b.geheim.trim() : undefined
  if (geheim && geheim.length < 32) throw createError({ statusCode: 422, statusMessage: 'Het gedeelde geheim is minstens 32 tekens' })
  return alsPlatform(async (tx) => {
    const [o] = (await tx.execute(sql`select id from organisations where id = ${id} and status <> 'systeem'`)).rows as any[]
    if (!o) throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const [voor] = (await tx.execute(sql`select * from dealtrace_platform_dealdrive(${id})`)).rows as any[]
    const inst = { ...(voor?.instellingen ?? {}), stand, ...(basisUrl !== undefined ? { basisUrl } : {}), ...(typeof b.organisatieId === 'string' ? { organisatieId: b.organisatieId.trim() } : {}) }
    const geheimen = geheim ? versleutel({ geheim }, 'dealdrive') : voor?.geheimen ?? null
    const heeftGeheim = !!ontsleutel(geheimen, 'dealdrive')?.geheim
    if (stand === 'aan' && (!inst.basisUrl || !inst.organisatieId || !heeftGeheim)) throw createError({ statusCode: 422, statusMessage: 'Vul eerst de basis-URL, het organisatie-id van DealDrive en het gedeelde geheim in' })
    const status = stand === 'uit' ? 'uit' : 'actief'
    await tx.execute(sql`select dealtrace_platform_dealdrive_zet(${id}, ${status}, ${geheimen}, ${JSON.stringify(inst)}::jsonb)`)
    const voorStand = voor?.status === 'actief' ? (voor.instellingen?.stand === 'http' ? 'aan' : voor.instellingen?.stand) : 'uit'
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'dealdrive.inrichten', object: id, voor: { stand: voorStand, basisUrl: voor?.instellingen?.basisUrl ?? null }, na: { stand, basisUrl: inst.basisUrl ?? null, organisatieId: inst.organisatieId ?? null, geheimGewijzigd: !!geheim } })
    const g = ontsleutel(geheimen, 'dealdrive')?.geheim
    return { stand, basisUrl: inst.basisUrl ?? null, organisatieId: inst.organisatieId ?? null, geheimVingerafdruk: g ? vingerafdruk(g) : null }
  })
})
