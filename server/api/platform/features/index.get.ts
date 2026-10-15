// GET /api/platform/features?organisatie=: het raster functies per niveau (founder).
// Met een organisatie: per cel of hij afwijkt van "Alle organisaties".
import { desc, like } from 'drizzle-orm'
import { schema } from '../../../utils/db'
import { raster } from '../../../utils/features'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const q = getQuery(event)
  const org = typeof q.organisatie === 'string' && q.organisatie ? q.organisatie : null
  return alsPlatform(async (tx) => {
    const functies = await raster(tx, org)
    const organisaties = (await tx.select({ id: schema.organisations.id, naam: schema.organisations.name, status: schema.organisations.status }).from(schema.organisations))
      .filter((o) => o.status !== 'systeem').map(({ id, naam }) => ({ id, naam }))
    const wijzigingen = await tx.select({ id: schema.platformAudit.id, handeling: schema.platformAudit.handeling, object: schema.platformAudit.object, voor: schema.platformAudit.voor, na: schema.platformAudit.na, op: schema.platformAudit.op, actorId: schema.platformAudit.actorId })
      .from(schema.platformAudit).where(like(schema.platformAudit.handeling, 'feature.%')).orderBy(desc(schema.platformAudit.op)).limit(20)
    return { functies, organisaties, wijzigingen, organisatie: org }
  })
})
