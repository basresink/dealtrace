// PUT /api/koppelingen/datacollectief {sleutel?, plafond?, uit?}: eerst testen, dan opslaan (12). De sleutel
// wordt versleuteld bewaard; terug komt alleen een vingerafdruk van acht tekens.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { dcStatus, testSleutel } from '../../utils/bronnen/datacollectief'
import { metOrganisatie, schema } from '../../utils/db'
import { versleutel } from '../../utils/geheimen'
import { vingerafdruk } from '../../utils/salesdnaWebhook'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.datacollectief')
  const b = await readBody<{ sleutel?: string; plafond?: number | null; uit?: boolean }>(event)
  const sleutel = b?.sleutel?.trim()
  let tegoed: number | undefined
  if (sleutel) {
    const t = await testSleutel(sleutel)
    if (t.fout) throw createError({ statusCode: 400, statusMessage: t.fout })
    tegoed = t.tegoed
  }
  const plafond = b?.plafond == null || b.plafond === ('' as any) ? null : Math.max(0, Math.round(Number(b.plafond)))
  if (plafond != null && !Number.isFinite(plafond)) throw createError({ statusCode: 422, statusMessage: 'Het plafond is een aantal records per maand' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'datacollectief'))
    const nu = new Date().toISOString()
    const waarden = {
      status: b?.uit ? 'uit' : sleutel || k?.geheimen ? 'actief' : 'uit',
      ...(sleutel ? { geheimen: versleutel({ sleutel }), getestOp: nu } : {}),
      ...(b?.uit ? { geheimen: null } : {}),
      instellingen: { ...(k?.instellingen ?? {}), plafond, laatsteFout: null, ...(sleutel ? { vingerafdruk: vingerafdruk(sleutel), tegoed: tegoed ?? null } : {}), ...(b?.uit ? { vingerafdruk: null } : {}) },
      updatedAt: nu,
    }
    if (k) await tx.update(schema.koppelingen).set(waarden).where(eq(schema.koppelingen.id, k.id))
    else await tx.insert(schema.koppelingen).values({ organisationId: ctx.organisatie!.id, soort: 'datacollectief', ...waarden })
    await schrijfAudit(tx, { organisationId: ctx.organisatie!.id, actorId: ctx.gebruiker.id, action: 'koppeling.datacollectief', resourceType: 'koppelingen', resourceId: 'datacollectief', changes: { sleutelGewijzigd: !!sleutel, plafond, uit: !!b?.uit } })
    return dcStatus(tx, ctx.organisatie!.pakket)
  })
})
