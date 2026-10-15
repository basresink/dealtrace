// POST /api/sync/mutations: de schrijfweg van de offline wachtrij (bouwplan F24, 8.14).
//
// Per mutatie: de tabel moet op de allowlist staan (shared/syncTabellen.ts), de
// rechtenmatrix moet het toestaan, en de idempotentiesleutel zorgt dat een
// mutatie na herstel van de verbinding precies één keer aankomt. Met een
// meegegeven versie controleert de server op conflicten (409 per mutatie).

import { and, eq } from 'drizzle-orm'
import { rolMag } from '../../../shared/permissions'
import { SYNCBARE_TABELLEN, isSyncbareTabel } from '../../../shared/syncTabellen'
import { pasPatchToe } from '../../../shared/wisPatch'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

interface Mutatie {
  idempotentieSleutel: string
  tabel: string
  op: 'patch'
  recordId: string
  versie?: number
  patch: Record<string, unknown>
}

type Resultaat =
  | { status: 'ok'; recordId: string; versie: number }
  | { status: 'conflict'; recordId: string; serverVersie: number; serverStand: unknown }
  | { status: 'geweigerd'; recordId: string; code: 403 | 400 | 404; reden: string }

const NOTIFICATIE_VELDEN = new Set(['gelezenOp', 'verborgenOp'])

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  const { mutaties } = await readBody<{ mutaties?: Mutatie[] }>(event)
  if (!Array.isArray(mutaties) || mutaties.length > 200) throw createError({ statusCode: 400, statusMessage: 'Geef tussen 1 en 200 mutaties' })

  const resultaten: Resultaat[] = []
  for (const m of mutaties) {
    resultaten.push(await metOrganisatie(organisatie.id, async (tx): Promise<Resultaat> => {
      if (!m?.idempotentieSleutel || !m.recordId) return { status: 'geweigerd', recordId: m?.recordId ?? '', code: 400, reden: 'idempotentieSleutel en recordId zijn verplicht' }

      // Al verwerkt? Dan hetzelfde antwoord, zonder iets opnieuw te doen.
      const [eerder] = await tx.select().from(schema.mutaties).where(eq(schema.mutaties.id, m.idempotentieSleutel))
      if (eerder) return eerder.resultaat as Resultaat

      if (!isSyncbareTabel(m.tabel)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: `Tabel ${m.tabel} staat niet op de allowlist` }
      const onderdeel = SYNCBARE_TABELLEN[m.tabel]

      const sleutel = `${m.tabel}:${m.recordId}`
      const [rec] = await tx.select().from(schema.serverRecords).where(eq(schema.serverRecords.key, sleutel))
      const huidigeVersie = rec?.version ?? 0

      let resultaat: Resultaat
      if (m.tabel === 'notificaties') {
        const [n] = await tx.select().from(schema.notificaties).where(eq(schema.notificaties.id, m.recordId))
        if (!n) return { status: 'geweigerd', recordId: m.recordId, code: 404, reden: 'Melding onbekend' }
        if (!rolMag(gebruiker.rol, onderdeel, 'schrijven', { eigen: n.gebruikerId === gebruiker.id })) {
          return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Niet je eigen melding' }
        }
        if (m.versie !== undefined && m.versie !== huidigeVersie) {
          return { status: 'conflict', recordId: m.recordId, serverVersie: huidigeVersie, serverStand: { gelezenOp: n.gelezenOp, verborgenOp: n.verborgenOp } }
        }
        const set: Record<string, string | null> = {}
        for (const [k, v] of Object.entries(m.patch ?? {})) if (NOTIFICATIE_VELDEN.has(k)) set[k] = v === null ? null : String(v)
        if (Object.keys(set).length) {
          await tx.update(schema.notificaties).set(set).where(and(eq(schema.notificaties.id, m.recordId), eq(schema.notificaties.gebruikerId, gebruiker.id)))
        }
      } else {
        // persoonlijke_instellingen: één rij per gebruiker, id = gebruikers-id.
        if (!rolMag(gebruiker.rol, onderdeel, 'schrijven', { eigen: m.recordId === gebruiker.id })) {
          return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen je eigen instellingen' }
        }
        const [p] = await tx.select().from(schema.persoonlijkeInstellingen).where(eq(schema.persoonlijkeInstellingen.id, m.recordId))
        if (m.versie !== undefined && m.versie !== huidigeVersie) {
          return { status: 'conflict', recordId: m.recordId, serverVersie: huidigeVersie, serverStand: p?.data ?? {} }
        }
        const data = pasPatchToe(p?.data ?? {}, m.patch ?? {})
        await tx.insert(schema.persoonlijkeInstellingen)
          .values({ id: m.recordId, organisationId: organisatie.id, data, updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({ target: schema.persoonlijkeInstellingen.id, set: { data, updatedAt: new Date().toISOString() } })
      }

      const versie = huidigeVersie + 1
      await tx.insert(schema.serverRecords)
        .values({ key: sleutel, organisationId: organisatie.id, version: versie, updatedAt: new Date().toISOString(), updatedBy: gebruiker.id })
        .onConflictDoUpdate({ target: schema.serverRecords.key, set: { version: versie, updatedAt: new Date().toISOString(), updatedBy: gebruiker.id } })
      resultaat = { status: 'ok', recordId: m.recordId, versie }
      await tx.insert(schema.mutaties).values({
        id: m.idempotentieSleutel, organisationId: organisatie.id, userId: gebruiker.id, tabel: m.tabel, op: m.op ?? 'patch',
        recordId: m.recordId, resultaat, appliedAt: new Date().toISOString(),
      })
      return resultaat
    }))
  }
  return { resultaten }
})
