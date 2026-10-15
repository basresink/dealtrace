// PUT /api/campagnes/soorten {id, actief}: een campagnesoort aan of uit (beheerder, F22 Verkoop).
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.campagnesoorten')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = (await tx.execute(sql`update campagnesoorten set actief = ${b?.actief !== false} where id = ${String(b?.id ?? '')} returning id, naam, actief`)).rows as any[]
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Campagnesoort niet gevonden' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'campagnesoort.wijzigen', resourceType: 'campagnesoorten', resourceId: r.id, changes: { actief: r.actief } })
    return r
  })
})
