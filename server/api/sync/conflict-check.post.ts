// POST /api/sync/conflict-check {records: [{tabel, recordId, versie}]}: welke records
// zijn op de server nieuwer dan de versie die de client kent.
import { inArray } from 'drizzle-orm'
import { isSyncbareTabel } from '../../../shared/syncTabellen'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisOrganisatie(event)
  const { records } = await readBody<{ records?: { tabel: string; recordId: string; versie: number }[] }>(event)
  const geldig = (records ?? []).filter((r) => isSyncbareTabel(r.tabel))
  if (!geldig.length) return { conflicten: [] }
  const sleutels = geldig.map((r) => `${r.tabel}:${r.recordId}`)
  const rijen = await metOrganisatie(organisatie.id, (tx) => tx.select().from(schema.serverRecords).where(inArray(schema.serverRecords.key, sleutels)))
  const versies = new Map(rijen.map((r) => [r.key, r.version]))
  return {
    conflicten: geldig
      .filter((r) => (versies.get(`${r.tabel}:${r.recordId}`) ?? 0) > r.versie)
      .map((r) => ({ ...r, serverVersie: versies.get(`${r.tabel}:${r.recordId}`) })),
  }
})
