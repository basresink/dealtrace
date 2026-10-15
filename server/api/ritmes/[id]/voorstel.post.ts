// POST /api/ritmes/:id/voorstel {tekst}: "Stel wijziging voor" wordt een inzicht voor de salesmanager.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'ritme.lezen')
  const id = getRouterParam(event, 'id')!
  const { tekst } = await readBody<{ tekst?: string }>(event)
  if (!tekst?.trim()) throw createError({ statusCode: 422, statusMessage: 'Beschrijf je voorstel' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.hercontactritmes).where(eq(schema.hercontactritmes.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Ritme onbekend' })
    const users = await tx.select().from(schema.users)
    const ontvanger = users.find((u) => u.role === 'salesmanager' && u.status !== 'gearchiveerd') ?? users.find((u) => u.role === 'beheerder')
    if (!ontvanger) throw createError({ statusCode: 422, statusMessage: 'Er is geen salesmanager' })
    await tx.insert(schema.signals).values({ organisationId: ctx.organisatie.id, ownerId: ontvanger.id, type: 'ritme-voorstel', title: `Voorstel voor ritme ${r.naam}`, bron: 'intern', relevanceScore: 60, data: { waarom: tekst.trim().slice(0, 1000), bewijs: [`door ${ctx.gebruiker.naam}`] } })
    return { ok: true }
  })
})
