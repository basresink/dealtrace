// POST /api/leads/ronde {zoekopdracht, bronnen}: een leadronde met AI-zoeker, KvK en of Datacollectief.
// 429 bij de daggrens, 402 zonder credits, 400 als een bron niet gekoppeld is. Dezelfde
// zoekopdracht binnen 24 uur geeft het bewaarde resultaat zonder kosten.
import { eq } from 'drizzle-orm'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { draaiRonde, leadsVoorScherm, schoonZoekopdracht } from '../../utils/leads'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.leadgenerator')
  const b = await readBody<{ zoekopdracht?: unknown; bronnen?: string[] }>(event)
  const bronnen = (Array.isArray(b?.bronnen) ? b.bronnen : []).filter((x) => x === 'ai' || x === 'kvk' || x === 'datacollectief')
  if (bronnen.includes('kvk') && !kan(ctx, 'leads.kvk')) throw createError({ statusCode: 403, statusMessage: 'Zoeken in KvK staat voor jou nog niet aan', data: { reden: 'niveau' } })
  if (bronnen.includes('datacollectief') && !kan(ctx, 'leadgenerator.datacollectief')) throw createError({ statusCode: 403, statusMessage: ctx.organisatie!.pakket !== 'compleet' ? 'Datacollectief is onderdeel van Compleet' : 'Datacollectief in rondes staat voor jou nog niet aan', data: { functie: 'leadgenerator.datacollectief', reden: ctx.organisatie!.pakket !== 'compleet' ? 'pakket' : 'niveau' } })
  if (bronnen.includes('ai') && !kan(ctx, 'leads.aiZoeker')) throw createError({ statusCode: 403, statusMessage: 'De AI-zoeker is onderdeel van Compleet', data: { reden: 'pakket' } })
  const z = schoonZoekopdracht(b?.zoekopdracht)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const r = await draaiRonde(tx, { id: ctx.organisatie!.id, pakket: ctx.organisatie!.pakket }, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }, z, bronnen)
    const [ronde] = await tx.select().from(schema.leadRondes).where(eq(schema.leadRondes.id, r.rondeId))
    const rijen = await tx.select().from(schema.leads).where(eq(schema.leads.rondeId, r.rondeId))
    return { ...r, zoekopdracht: ronde!.zoekopdracht, leads: await leadsVoorScherm(tx, rijen.filter((l) => l.status !== 'afgewezen'), ronde!.zoekopdracht) }
  })
})
