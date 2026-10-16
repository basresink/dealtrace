// POST /api/platform/facturen/maak {organisatieId}: de maandfactuur via Stripe (lokaal de mock): abonnement,
// seats en de te factureren extra credits. Het resultaat komt als event binnen, net als bij Stripe. Founder.
import { sql } from 'drizzle-orm'
import { prijsOp } from '../../../../shared/platform'
import { gebruikDb, metOrganisatie } from '../../../utils/db'
import { mockStripeFactuur, verwerkStripeEvent } from '../../../utils/platformBeheer'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const { organisatieId } = await readBody<{ organisatieId?: string }>(event)
  const o = await alsPlatform(async (tx) => {
    const [r] = (await tx.execute(sql`select id, name, pakket, stripe_customer_id, (select count(*)::int from users u where u.organisation_id = o.id and u.status = 'actief') as seats from organisations o where id = ${organisatieId ?? ''} and status <> 'systeem'`)).rows as any[]
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    if (!r.stripe_customer_id) { r.stripe_customer_id = `cus_mock_${r.id}`; await tx.execute(sql`update organisations set stripe_customer_id = ${r.stripe_customer_id} where id = ${r.id}`) }
    const prijzen = ((await tx.execute(sql`select pakket, prijs_cent, seat_cent, geldig_vanaf::text as g from pakketprijzen`)).rows as any[]).map((p) => ({ pakket: p.pakket, prijsCent: p.prijs_cent, seatCent: p.seat_cent, geldigVanaf: p.g }))
    r.prijs = prijsOp(prijzen, new Date().toISOString().slice(0, 10), (p) => p.pakket === r.pakket)
    await platformAudit(tx, event, ctx, { organisatieId: r.id, handeling: 'factuur.maken', object: r.id })
    return r
  })
  if (!o.prijs) throw createError({ statusCode: 422, statusMessage: 'Zet eerst een prijs voor dit pakket bij Abonnementen' })
  const extra = await metOrganisatie(o.id, async (tx) => {
    const [x] = (await tx.execute(sql`select coalesce(sum(aantal), 0)::int as n from extra_credits_log where factureren and not gefactureerd`)).rows as any[]
    await tx.execute(sql`update extra_credits_log set gefactureerd = true where factureren and not gefactureerd`)
    return x.n as number
  })
  const nummer = `DT-${new Date().toISOString().slice(0, 7).replace('-', '')}-${o.id.slice(4, 10).toUpperCase()}-${Date.now() % 10000}`
  const f = mockStripeFactuur({ customer: o.stripe_customer_id, nummer, seats: o.seats, seatCent: o.prijs.seatCent, prijsCent: o.prijs.prijsCent, extra: extra ? { aantal: extra, centPerCredit: 1 } : null })
  await verwerkStripeEvent({ buiten: (w) => gebruikDb().transaction(w), inOrg: metOrganisatie }, { id: `evt_mock_${nummer}`, type: 'invoice.finalized', data: { object: f } })
  return { ok: true, nummer, tekst: `Factuur ${nummer} is gemaakt.` }
})
