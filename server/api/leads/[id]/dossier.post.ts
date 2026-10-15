// POST /api/leads/:id/dossier: "Opnieuw uitzoeken" of "Toch uitzoeken" (10 credits). 402 zonder credits.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { leadsVoorScherm, maakDossier } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.leadgenerator')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const l = await maakDossier(tx, { id: ctx.organisatie!.id, pakket: ctx.organisatie!.pakket }, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, id)
    const [ronde] = l.rondeId ? await tx.select().from(schema.leadRondes).where(eq(schema.leadRondes.id, l.rondeId)) : []
    return (await leadsVoorScherm(tx, [l], ronde?.zoekopdracht ?? {}))[0]
  })
})
