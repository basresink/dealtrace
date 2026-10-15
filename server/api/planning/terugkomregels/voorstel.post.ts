// POST /api/planning/terugkomregels/voorstel {regelId, ritmeId?, tekst}: een Expert stelt voor een
// regel aan een ander hercontactritme te koppelen of te wijzigen; het wordt een inzicht voor de salesmanager.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { verkoopverhaal } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'terugkomen.koppelenEnOpbrengst')
  const b = await readBody<{ regelId?: string; ritmeId?: string; tekst?: string }>(event)
  if (!b?.tekst?.trim() && !b?.ritmeId) throw createError({ statusCode: 422, statusMessage: 'Kies een ritme of beschrijf je voorstel' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const regel = (await verkoopverhaal(tx)).terugkomregels.find((r) => r.id === b.regelId)
    if (!regel) throw createError({ statusCode: 404, statusMessage: 'Terugkomregel onbekend' })
    const ritme = b.ritmeId ? (await tx.select().from(schema.hercontactritmes).where(eq(schema.hercontactritmes.id, b.ritmeId)))[0] : null
    const users = await tx.select().from(schema.users)
    const ontvanger = users.find((u) => u.role === 'salesmanager' && u.status !== 'gearchiveerd') ?? users.find((u) => u.role === 'beheerder')
    if (!ontvanger) throw createError({ statusCode: 422, statusMessage: 'Er is geen salesmanager' })
    const waarom = [ritme ? `Koppel "${regel.reden}" aan het ritme ${ritme.naam}.` : null, b.tekst?.trim()].filter(Boolean).join(' ').slice(0, 1000)
    await tx.insert(schema.signals).values({ organisationId: ctx.organisatie!.id, ownerId: ontvanger.id, type: 'terugkomregel-voorstel', title: `Voorstel voor terugkomregel ${regel.reden}`, bron: 'intern', relevanceScore: 60, data: { waarom, bewijs: [`door ${ctx.gebruiker.naam}`] } })
    return { ok: true }
  })
})
