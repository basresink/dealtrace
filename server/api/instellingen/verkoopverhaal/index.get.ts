// GET /api/instellingen/verkoopverhaal: alle acht onderdelen met concept, status, versie en labels,
// plus de eigen aanvullingen en open voorstellen. Salesmanager en beheerder.
import { desc, eq } from 'drizzle-orm'
import { kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { leesStand, sublagen } from '../../../utils/vvProjectie'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand = await leesStand(tx)
    return {
      onderdelen: await sublagen(tx),
      aanvullingen: { brancheMapping: stand.brancheMapping, redenmapping: stand.redenmapping, ambitiedoelen: stand.ambitiedoelen },
      voorstellen: await tx.select().from(schema.vvVoorstellen).where(eq(schema.vvVoorstellen.status, 'open')).orderBy(desc(schema.vvVoorstellen.op)),
      kan: { mappings: kan(ctx, 'verkoopverhaal.mappings'), startset: ctx.gebruiker.rol === 'beheerder' },
    }
  })
})
