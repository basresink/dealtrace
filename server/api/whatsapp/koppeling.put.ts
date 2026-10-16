// PUT /api/whatsapp/koppeling {modus, telefoonId?, wabaId?, token?, optInTekst?} of {uit: true} (beheerder):
// eerst testen, dan opslaan. Token en webhookgeheim versleuteld (eigen doel whatsapp); het webhookgeheim
// maakt Dealtrace zelf en toont het één keer, voor de instelling bij de provider.
import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { whatsappAdapter } from '../../utils/bronnen/whatsapp'
import { metOrganisatie } from '../../utils/db'
import { versleutel } from '../../utils/geheimen'
import { vereisFunctie } from '../../utils/sessie'
import { OPT_IN_STANDAARD, waKoppeling } from '../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.whatsapp')
  const b = await readBody<any>(event)
  const org = ctx.organisatie.id
  return metOrganisatie(org, async (tx) => {
    if (b?.uit) {
      await tx.execute(sql`update koppelingen set status = 'uit', updated_at = now() where soort = 'whatsapp'`)
      await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'koppeling.whatsapp.uit', resourceType: 'koppelingen', resourceId: 'whatsapp', changes: {} })
      return { status: 'uit', tekst: 'WhatsApp is ontkoppeld.' }
    }
    const oud = await waKoppeling(tx)
    const modus = b?.modus === 'meta' ? 'meta' : 'mock'
    const optInTekst = typeof b?.optInTekst === 'string' && b.optInTekst.trim() ? b.optInTekst.trim().slice(0, 400) : oud?.optInTekst ?? OPT_IN_STANDAARD
    if (/[–—]/.test(optInTekst)) throw createError({ statusCode: 400, statusMessage: 'Gebruik geen gedachtestreepjes' })
    const token = (typeof b?.token === 'string' && b.token) || oud?.config.token || ''
    const config = { modus, telefoonId: b?.telefoonId ? String(b.telefoonId) : oud?.config.telefoonId, wabaId: b?.wabaId ? String(b.wabaId) : oud?.config.wabaId, token } as const
    if (modus === 'meta' && (!config.telefoonId || !config.wabaId || !token)) throw createError({ statusCode: 400, statusMessage: 'Vul telefoonnummer-id, WABA-id en token in' })
    const t = await whatsappAdapter(config).test()
    if (!t.ok) throw createError({ statusCode: 400, statusMessage: t.tekst })
    const nieuwGeheim = !oud?.webhookGeheim
    const webhookGeheim = oud?.webhookGeheim ?? randomBytes(24).toString('base64url')
    const geheimen = versleutel({ ...(token ? { token } : {}), webhookGeheim }, 'whatsapp')
    await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen, getest_op) values (${org}, 'whatsapp', 'actief', ${geheimen}, ${JSON.stringify({ modus, telefoonId: config.telefoonId ?? null, wabaId: config.wabaId ?? null, optInTekst })}::jsonb, now())
      on conflict (organisation_id, soort) do update set status = 'actief', geheimen = excluded.geheimen, instellingen = excluded.instellingen, getest_op = now(), updated_at = now()`)
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'koppeling.whatsapp.opslaan', resourceType: 'koppelingen', resourceId: 'whatsapp', changes: { modus } })
    return { status: 'actief', tekst: t.tekst, webhook: { url: `${getRequestURL(event).origin}/api/whatsapp/webhook?org=${org}`, geheim: nieuwGeheim ? webhookGeheim : null } }
  })
})
