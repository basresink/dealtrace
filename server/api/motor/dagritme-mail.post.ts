// POST /api/motor/dagritme-mail: elk kwartier (geplande functie, x-motor-secret). Weekreview op vrijdag,
// weekstart op maandag en dagstart op elke werkdag per e-mail, voor wie de schakelaar aanzette, op zijn
// tijdstip en buiten de stille uren. Eén mail per soort per dag (melding_log).
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { beschikbaar } from '../../../shared/functies'
import type { Niveau, Rol, Werkplek } from '../../../shared/types'
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { verstuurDagritmeMails } from '../../utils/dagritmeWeek'
import { leesOrganisatie } from '../../utils/sessie'

const FUNCTIE = { weekreview: 'dagritme.weekreview', weekstart: 'dagritme.weekstart', dagstart: 'dagritme.dagstart' } as const

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  if (!(geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim)))) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const basis = process.env.URL || getRequestURL(event).origin
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  const nu = new Date()
  const totaal: Record<string, number> = {}
  for (const o of orgs) {
    try {
      const { organisatie, stand } = await leesOrganisatie(o.id)
      const mag = (g: { id: string; rol: string; niveau: string; werkplek: string; teamId: string | null }, soort: keyof typeof FUNCTIE) => {
        const ctx = { id: g.id, rol: g.rol as Rol, niveau: g.niveau as Niveau, werkplek: g.werkplek as Werkplek, teamId: g.teamId, verborgen: [] }
        return beschikbaar('dagritme.mail', ctx, organisatie, stand).ok && beschikbaar(FUNCTIE[soort], ctx, organisatie, stand).ok
      }
      // De blokken in de mail (belblokken, campagnes, accountplannen) volgen dezelfde functies als het scherm.
      const kanFunctie = (g: { id: string; rol: string; niveau: string; werkplek: string; teamId: string | null }, sleutel: string) =>
        beschikbaar(sleutel, { id: g.id, rol: g.rol as Rol, niveau: g.niveau as Niveau, werkplek: g.werkplek as Werkplek, teamId: g.teamId, verborgen: [] }, organisatie, stand).ok
      const t = await metOrganisatie(o.id, (tx) => verstuurDagritmeMails(tx, o.id, nu, basis, mag, kanFunctie))
      for (const [k, v] of Object.entries(t)) totaal[k] = (totaal[k] ?? 0) + v
    } catch (e: any) { console.error(`dagritme-mail ${o.id}: ${e?.message}`) }
  }
  return totaal
})
