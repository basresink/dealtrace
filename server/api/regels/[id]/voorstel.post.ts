// POST /api/regels/:id/voorstel {tekst}: een Expert stelt een wijziging van een teamregel
// voor; de salesmanager (of beheerder) krijgt een inzicht.
import { eq } from 'drizzle-orm'
import { kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisOrganisatie, weigerFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'regels.persoonlijk')) weigerFunctie('regels.persoonlijk', 'niveau')
  const id = getRouterParam(event, 'id')!
  const { tekst } = await readBody<{ tekst?: string }>(event)
  if (!tekst?.trim()) throw createError({ statusCode: 422, statusMessage: 'Beschrijf je voorstel' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select().from(schema.activityRules).where(eq(schema.activityRules.id, id))
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Regel onbekend' })
    const users = await tx.select().from(schema.users)
    const ontvanger = users.find((u) => u.role === 'salesmanager' && u.status !== 'gearchiveerd') ?? users.find((u) => u.role === 'beheerder')
    if (!ontvanger) throw createError({ statusCode: 422, statusMessage: 'Er is geen salesmanager of beheerder' })
    await tx.insert(schema.signals).values({ organisationId: ctx.organisatie.id, ownerId: ontvanger.id, type: 'regel-voorstel', title: `Voorstel voor regel ${r.code ?? ''} ${r.naam}`.trim(), bron: 'intern', relevanceScore: 60,
      data: { waarom: tekst.trim().slice(0, 1000), bewijs: [`door ${ctx.gebruiker.naam}`], regelId: r.id } })
    return { ok: true }
  })
})
