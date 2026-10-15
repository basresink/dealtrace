// GET /api/accounts/:id/reisgeschiedenis: per regel datum, van fase, naar fase,
// gebeurtenis, door (gebruiker of "motor") en reden (Gevorderd).
import { desc, eq } from 'drizzle-orm'
import { GEBEURTENIS_LABEL, type Gebeurtenis } from '../../../../shared/nbStatus'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.geschiedenis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await tx.select().from(schema.reisgeschiedenis).where(eq(schema.reisgeschiedenis.accountId, id)).orderBy(desc(schema.reisgeschiedenis.op))
    const reizen = await tx.select({ id: schema.reistemplates.id, data: schema.reistemplates.data }).from(schema.reistemplates)
    const label = new Map(reizen.flatMap((r) => r.data.fases.map((f) => [f.id, f.label] as const)))
    const namen = new Map((await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users)).map((u) => [u.id, u.naam]))
    return {
      regels: rijen.map((r) => ({
        id: r.id, op: r.op, van: r.vanFaseId ? label.get(r.vanFaseId) ?? r.vanFaseId : null, naar: r.naarFaseId ? label.get(r.naarFaseId) ?? r.naarFaseId : null,
        vanStatus: r.vanStatus, naarStatus: r.naarStatus, gebeurtenis: GEBEURTENIS_LABEL[r.gebeurtenis as Gebeurtenis] ?? r.gebeurtenis,
        door: r.door === 'motor' ? 'motor' : namen.get(r.door) ?? r.door, reden: r.reden,
      })),
    }
  })
})
