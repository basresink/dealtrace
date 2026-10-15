// GET /api/instellingen/audit?leverancier=1: auditlog van de eigen organisatie,
// inclusief wat de leverancier deed (F23).
import { desc, like } from 'drizzle-orm'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisBeheerder(event, 'instellingen.audit')
  const alleenLeverancier = getQuery(event).leverancier === '1'
  return metOrganisatie(organisatie.id, async (tx) => {
    const q = tx.select().from(schema.auditEvents)
    const rijen = await (alleenLeverancier ? q.where(like(schema.auditEvents.action, 'leverancier.%')) : q).orderBy(desc(schema.auditEvents.occurredAt)).limit(200)
    const namen = new Map((await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users)).map((u) => [u.id, u.naam]))
    return rijen.map((r) => ({
      id: r.id, op: r.occurredAt, actie: r.action, object: r.resourceType, objectId: r.resourceId, wijziging: r.changes,
      door: namen.get(r.actorId) ?? (r.metadata as any)?.door ?? r.actorId,
      leverancier: r.action.startsWith('leverancier.'), reden: (r.metadata as any)?.reden ?? null,
    }))
  })
})
