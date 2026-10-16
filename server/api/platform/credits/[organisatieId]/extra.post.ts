// POST /api/platform/credits/:organisatieId/extra {aantal, reden, factureren, sleutel?, aanvraagId?}: extra credits
// voor deze maand. De pot groeit direct; met factureren een regel op de volgende factuur. Dezelfde sleutel
// telt één keer. Founder; platformaudit en een melding aan de beheerders.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../../utils/db'
import { kenExtraToe } from '../../../../utils/platformBeheer'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const org = getRouterParam(event, 'organisatieId')!
  const b = await readBody<{ aantal?: number; reden?: string; factureren?: boolean; sleutel?: string; aanvraagId?: string }>(event)
  const aantal = Number(b?.aantal)
  if (!Number.isInteger(aantal) || aantal <= 0 || aantal > 1_000_000) throw createError({ statusCode: 422, statusMessage: 'Vul een aantal credits in' })
  if (!b?.reden?.trim()) throw createError({ statusCode: 422, statusMessage: 'Geef een reden' })
  const sleutel = b.sleutel || b.aanvraagId || crypto.randomUUID()
  const r = await metOrganisatie(org, async (tx) => {
    const [o] = (await tx.execute(sql`select id from organisations where id = ${org}`)).rows
    if (!o) throw createError({ statusCode: 404, statusMessage: 'Organisatie niet gevonden' })
    const x = await kenExtraToe(tx, org, { aantal, reden: b.reden!, factureren: !!b.factureren, sleutel, door: ctx.gebruiker.id })
    if (b.aanvraagId) await tx.execute(sql`update credit_aanvragen set status = 'toegekend', besloten_door = ${ctx.gebruiker.id}, besloten_op = now() where id = ${b.aanvraagId} and status = 'open'`)
    return x
  })
  if (!r.dubbel) {
    await alsPlatform(async (tx) => {
      await platformAudit(tx, event, ctx, { organisatieId: org, handeling: 'credits.extra', object: b.aanvraagId ?? 'extra', na: { aantal, reden: b.reden, factureren: !!b.factureren } })
      await meldBeheerders(tx, org, 'Extra AI-credits toegekend', `${aantal} extra credits toegekend: ${b.reden}.`, '/instellingen/verbruik')
    })
  }
  return { pot: r.stand.pot, over: r.stand.over, dubbel: r.dubbel, tekst: r.dubbel ? 'Deze toekenning was al verwerkt.' : `${aantal} extra credits toegekend.` }
})
