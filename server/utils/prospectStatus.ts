// Status prospect (koud, lauw, warm, heet) bewaren: in accounts.data.prospectStatus met een auditregel
// account.prospectStatus (van, naar). Alleen voor prospects; klanten hebben geen status. Wie mag: dezelfde
// regel als deactiveren (de eigenaar, zijn salesmanager of de beheerder), want de status stuurt het werk
// van de eigenaar. Leeg (null) wist de status.
import { eq } from 'drizzle-orm'
import { isProspectStatus, prospectStatusUit, type ProspectStatus } from '../../shared/prospectStatus'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { magDitAccount } from './deactiveren'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export class StatusFout extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}

export async function zetProspectStatus(tx: Tx, org: string, g: { id: string; rol: string }, id: string, status: unknown): Promise<{ id: string; prospectStatus: ProspectStatus | null; gewijzigd: boolean }> {
  if (status !== null && status !== '' && !isProspectStatus(status)) throw new StatusFout(422, 'Kies koud, lauw, warm of heet')
  const nieuw = isProspectStatus(status) ? status : null
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
  if (!a) throw new StatusFout(404, 'Account onbekend')
  if (a.accountKind !== 'prospect') throw new StatusFout(422, 'Alleen een prospect heeft een status')
  if (!(await magDitAccount(tx, g, a))) throw new StatusFout(403, 'Alleen de eigenaar, zijn salesmanager of de beheerder zet de status van deze prospect')
  const oud = prospectStatusUit(a.data)
  if (oud === nieuw) return { id, prospectStatus: nieuw, gewijzigd: false }
  const { prospectStatus: _weg, ...rest } = (a.data ?? {}) as Record<string, unknown>
  const data = nieuw ? { ...rest, prospectStatus: nieuw, prospectStatusOp: new Date().toISOString(), prospectStatusDoor: g.id } : rest
  if (!nieuw) { delete (data as any).prospectStatusOp; delete (data as any).prospectStatusDoor }
  await tx.update(schema.accounts).set({ data: data as any, updatedAt: new Date().toISOString() }).where(eq(schema.accounts.id, id))
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'account.prospectStatus', resourceType: 'accounts', resourceId: id, changes: { van: oud, naar: nieuw } })
  return { id, prospectStatus: nieuw, gewijzigd: true }
}

export function statusAlsHttp(e: unknown): never {
  if (e instanceof StatusFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message })
  throw e
}
