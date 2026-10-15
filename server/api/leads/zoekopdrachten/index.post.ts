// POST /api/leads/zoekopdrachten {naam, zoekopdracht, bronnen, automatisch}: "Bewaar als
// zoekopdracht" (Expert). Wekelijks laten draaien vraagt "Automatische rondes".
import { kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { schoonZoekopdracht } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.opgeslagen')
  const b = await readBody<{ naam?: string; zoekopdracht?: unknown; bronnen?: string[]; automatisch?: string }>(event)
  const naam = b?.naam?.trim().slice(0, 80)
  if (!naam) throw createError({ statusCode: 422, statusMessage: 'Geef de zoekopdracht een naam' })
  const automatisch = b?.automatisch === 'wekelijks' ? 'wekelijks' : 'uit'
  if (automatisch === 'wekelijks' && !kan(ctx, 'leads.automatisch')) throw createError({ statusCode: 403, statusMessage: 'Automatische rondes staan voor jou nog niet aan', data: { reden: 'niveau' } })
  const z = schoonZoekopdracht(b?.zoekopdracht)
  const bronnen = (b?.bronnen ?? []).filter((x) => x === 'ai' || x === 'kvk')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [r] = await tx.insert(schema.leadZoekopdrachten).values({ organisationId: ctx.organisatie!.id, gebruikerId: ctx.gebruiker.id, naam, zoekopdracht: z, bronnen: bronnen.length ? bronnen : ['kvk'], automatisch, doelgroepId: z.doelgroepId ?? null }).returning()
    return r
  })
})
