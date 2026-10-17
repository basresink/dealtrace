// POST /api/belblokken/:id/vul {accountIds}: vul een eigen gepland belblok met het voorstel van Dagstart of
// Weekstart (shared/ritmeBlokken.ts vulVoorstellen). Alleen kandidaten uit je eigen bellijst die nog aan geen
// blok hangen; bestaande beltaken krijgen het blok, de rest een nieuwe beltaak (hangAanBlok, zoals de vuller).
import { eq } from 'drizzle-orm'
import { bouwBellijst } from '../../../../shared/belblokken'
import { schrijfAudit } from '../../../utils/audit'
import { hangAanBlok, laadBelKandidaten } from '../../../utils/bellen'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ accountIds?: unknown }>(event).catch(() => ({} as { accountIds?: unknown }))
  const ids = Array.isArray(b?.accountIds) ? [...new Set(b!.accountIds.filter((x): x is string => typeof x === 'string'))].slice(0, 15) : []
  if (!ids.length) throw createError({ statusCode: 422, statusMessage: 'Kies wie je wilt bellen' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [s] = await tx.select().from(schema.belblokSessies).where(eq(schema.belblokSessies.id, id))
    if (!s || s.gebruikerId !== ctx.gebruiker.id) throw createError({ statusCode: 404, statusMessage: 'Belblok onbekend' })
    if (s.status !== 'gepland') throw createError({ statusCode: 409, statusMessage: 'Dit blok loopt al of is klaar' })
    const nu = new Date()
    if (Date.parse(s.eindOp) <= nu.getTime()) throw createError({ statusCode: 422, statusMessage: 'Dit blok is al voorbij' })
    const gekozen = bouwBellijst((await laadBelKandidaten(tx, ctx.gebruiker.id)).filter((k) => !k.belblokId && ids.includes(k.accountId)), nu)
      .sort((x, y) => ids.indexOf(x.accountId) - ids.indexOf(y.accountId))
    if (!gekozen.length) throw createError({ statusCode: 409, statusMessage: 'Deze gesprekken staan al in een belblok' })
    const taken = await hangAanBlok(tx, ctx.organisatie.id, ctx.gebruiker.id, s.id, s.startOp, gekozen)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'belblok.gevuld', resourceType: 'belblok_sessies', resourceId: s.id, changes: { accountIds: gekozen.map((k) => k.accountId), taken } })
    const wanneer = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(s.startOp))
    return { sessieId: s.id, toegevoegd: taken.length, toast: `${taken.length === 1 ? '1 gesprek staat' : `${taken.length} gesprekken staan`} in je belblok van ${wanneer}.` }
  })
})
