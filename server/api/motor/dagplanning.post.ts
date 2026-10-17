// POST /api/motor/dagplanning: elk kwartier (geplande functie, x-motor-secret). Plant de dag van wie
// "Plan mijn dag automatisch" aanzette op zijn tijdstip, na de stille uren, één keer per werkdag; wie al
// gepland is, krijgt een controle op de vaste punten (gekoppelde agenda) en zo nodig een herplanning.
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { beschikbaar } from '../../../shared/functies'
import type { Niveau, Rol } from '../../../shared/types'
import { dagplanningSweep } from '../../utils/agents/dagplanner'
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { leesOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  if (!(geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim)))) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  const nu = new Date()
  const totaal: Record<string, number> = {}
  for (const o of orgs) {
    try {
      const { organisatie, stand } = await leesOrganisatie(o.id)
      const mag = (g: { id: string; rol: string; niveau: string; werkplek: string; teamId: string | null }) =>
        beschikbaar('dagritme.dagstart', { rol: g.rol as Rol, niveau: g.niveau as Niveau }, organisatie, stand).ok
      const t = await metOrganisatie(o.id, (tx) => dagplanningSweep(tx, o.id, nu, mag))
      for (const [k, v] of Object.entries(t)) totaal[k] = (totaal[k] ?? 0) + v
    } catch (e: any) { console.error(`dagplanning ${o.id}: ${e?.message}`) }
  }
  return totaal
})
