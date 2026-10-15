// PUT /api/koppelingen/kvk {sleutel?, plafond?, uit?}: eerst testen, dan opslaan (12). De sleutel
// wordt versleuteld bewaard en komt nooit terug in een antwoord of log.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { kvkStatus, testSleutel } from '../../utils/bronnen/kvk'
import { versleutel } from '../../utils/geheimen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.kvk')
  const b = await readBody<{ sleutel?: string; plafond?: number | null; uit?: boolean }>(event)
  const sleutel = b?.sleutel?.trim()
  if (sleutel) {
    const f = await testSleutel(sleutel)
    if (f) throw createError({ statusCode: 400, statusMessage: f })
  }
  const plafond = b?.plafond == null || b.plafond === ('' as any) ? null : Math.max(0, Math.round(Number(b.plafond)))
  if (plafond != null && !Number.isFinite(plafond)) throw createError({ statusCode: 422, statusMessage: 'Het plafond is een aantal bevragingen per maand' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'kvk'))
    const nu = new Date().toISOString()
    const waarden = {
      status: b?.uit ? 'uit' : sleutel || k?.geheimen ? 'actief' : 'uit',
      ...(sleutel ? { geheimen: versleutel({ sleutel }), getestOp: nu } : {}),
      ...(b?.uit ? { geheimen: null } : {}),
      instellingen: { ...(k?.instellingen ?? {}), plafond, laatsteFout: null },
      updatedAt: nu,
    }
    if (k) await tx.update(schema.koppelingen).set(waarden).where(eq(schema.koppelingen.id, k.id))
    else await tx.insert(schema.koppelingen).values({ organisationId: ctx.organisatie!.id, soort: 'kvk', ...waarden })
    await schrijfAudit(tx, { organisationId: ctx.organisatie!.id, actorId: ctx.gebruiker.id, action: 'koppeling.kvk', resourceType: 'koppelingen', resourceId: 'kvk', changes: { sleutelGewijzigd: !!sleutel, plafond, uit: !!b?.uit } })
    return kvkStatus(tx, ctx.organisatie!.pakket)
  })
})
