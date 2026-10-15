// POST /api/platform/credits/:organisatieId/extra {aantal, aanvraagId?}: extra credits toekennen voor de lopende maand.
// Founder met tweestapsverificatie; platformaudit en een melding aan de beheerders.
import { sql } from 'drizzle-orm'
import { maandVan, stand } from '../../../../utils/credits'
import { metOrganisatie } from '../../../../utils/db'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const org = getRouterParam(event, 'organisatieId')!
  const b = await readBody<{ aantal?: number; aanvraagId?: string }>(event)
  const aantal = Number(b?.aantal)
  if (!Number.isInteger(aantal) || aantal <= 0 || aantal > 1_000_000) throw createError({ statusCode: 422, statusMessage: 'Vul een aantal credits in' })
  const na = await metOrganisatie(org, async (tx) => {
    const [o] = (await tx.execute(sql`select id from organisations where id = ${org}`)).rows
    if (!o) throw createError({ statusCode: 404, statusMessage: 'Organisatie niet gevonden' })
    await stand(tx, org)
    await tx.execute(sql`update ai_credits set extra = extra + ${aantal} where organisation_id = ${org} and maand = ${maandVan(new Date())}`)
    if (b?.aanvraagId) await tx.execute(sql`update credit_aanvragen set status = 'toegekend', besloten_door = ${ctx.gebruiker.id}, besloten_op = now() where id = ${b.aanvraagId} and status = 'open'`)
    const s = await stand(tx, org)
    return { pot: s.pot, over: s.over, extra: s.extra }
  })
  await alsPlatform(async (tx) => {
    await platformAudit(tx, event, ctx, { organisatieId: org, handeling: 'credits.extra', object: b?.aanvraagId ?? 'extra', na: { aantal } })
    await meldBeheerders(tx, org, 'Extra AI-credits toegekend', `${aantal} extra credits toegekend.`, '/instellingen/verbruik')
  })
  return { ...na, tekst: `${aantal} extra credits toegekend.` }
})
