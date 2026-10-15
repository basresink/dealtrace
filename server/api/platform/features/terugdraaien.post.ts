// POST /api/platform/features/terugdraaien {auditId}: zet een cel terug naar de stand
// van vóór die wijziging. 409 als dezelfde cel daarna nog eens wijzigde.
import { and, eq, gt } from 'drizzle-orm'
import type { Niveau } from '../../../../shared/types'
import { schema } from '../../../utils/db'
import { leesCel, zetCel } from '../../../utils/features'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ auditId?: string }>(event)
  return alsPlatform(async (tx) => {
    const [a] = await tx.select().from(schema.platformAudit).where(eq(schema.platformAudit.id, b?.auditId ?? ''))
    if (!a || !a.handeling.startsWith('feature.') || !a.object) throw createError({ statusCode: 404, statusMessage: 'Wijziging onbekend' })
    const [later] = await tx.select({ id: schema.platformAudit.id }).from(schema.platformAudit).where(and(eq(schema.platformAudit.object, a.object), gt(schema.platformAudit.op, a.op))).limit(1)
    if (later) throw createError({ statusCode: 409, statusMessage: 'Deze cel is daarna nog eens gewijzigd' })
    const [f, n, o] = a.object.split('|') as [string, Niveau, string]
    const org = o === 'alle' ? null : o
    const terug = (a.voor as { aan?: boolean } | null)?.aan ?? null
    const nu = await leesCel(tx, f, n, org)
    await zetCel(tx, f, n, org, terug, ctx.gebruiker.id)
    await platformAudit(tx, event, ctx, { organisatieId: org, handeling: 'feature.terugdraaien', object: a.object, voor: nu, na: terug === null ? null : { aan: terug }, reden: `Teruggedraaid: ${a.id}` })
    return { functie: f, niveau: n, organisatieId: org, aan: terug }
  })
})
