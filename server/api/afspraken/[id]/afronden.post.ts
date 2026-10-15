// POST /api/afspraken/:id/afronden {uitkomst, verslag, agendapunten, laterOp?, reden?, ...}: "Rond af".
// 400 zonder reden bij nee; idempotent op afspraak en uitkomst.
import { kan } from '../../../utils/accounts'
import { rondAfAfspraak, type AfrondInvoer } from '../../../utils/agenda'
import { metOrganisatie } from '../../../utils/db'
import { eigenTeams } from '../../../utils/gebruikers'
import { vereisFunctie } from '../../../utils/sessie'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<AfrondInvoer>(event)
  if (!b?.uitkomst) throw createError({ statusCode: 400, statusMessage: 'Kies een uitkomst' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [ap] = (await tx.execute(sql`select ap.owner_id, ap.gepland_door, u.team_id from appointments ap join users u on u.id = ap.owner_id where ap.id = ${id}`)).rows as any[]
    if (!ap) throw createError({ statusCode: 404, statusMessage: 'Afspraak niet gevonden' })
    const eigen = ap.owner_id === ctx.gebruiker.id || ap.gepland_door === ctx.gebruiker.id
    const team = ctx.gebruiker.rol === 'beheerder' || (ctx.gebruiker.rol === 'salesmanager' && ap.team_id && (await eigenTeams(tx, ctx.gebruiker.id)).includes(ap.team_id))
    if (!eigen && !team && !kan(ctx, 'agenda.voorCollega')) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw afspraak' })
    return rondAfAfspraak(tx, ctx.organisatie.id, id, ctx.gebruiker.id, b)
  })
})
