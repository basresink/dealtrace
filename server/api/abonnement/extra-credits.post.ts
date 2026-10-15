// POST /api/abonnement/extra-credits {aantal, toelichting}: de beheerder vraagt extra credits aan; de founder krijgt een melding.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'credits.beheer')
  const b = await readBody<{ aantal?: number; toelichting?: string }>(event)
  const aantal = Number(b?.aantal)
  if (!Number.isInteger(aantal) || aantal <= 0 || aantal > 100000) throw createError({ statusCode: 422, statusMessage: 'Vul een aantal credits in' })
  const r = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = (await tx.execute(sql`insert into credit_aanvragen (organisation_id, aantal, toelichting, aangevraagd_door) values (${ctx.organisatie.id}, ${aantal}, ${b?.toelichting?.slice(0, 500) ?? null}, ${ctx.gebruiker.id}) returning id, aantal, status, op`)).rows as any[]
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'credits.aanvraag', resourceType: 'credit_aanvragen', resourceId: a.id, changes: { aantal } })
    return a
  })
  // Melding aan de founder(s): via de functie die alleen founders opzoekt, buiten de organisatie om.
  await metOrganisatie('org-dealtrace', async (tx) => {
    const founders = (await tx.execute(sql`select id from users where role = 'founder' and status = 'actief'`)).rows as any[]
    for (const f of founders) await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, 'org-dealtrace', ${f.id}, 'systeem', 'Aanvraag extra AI-credits', ${`${ctx.organisatie.naam}: ${aantal} credits`}, '/platform/credits', now(), '{}'::jsonb)`)
  }).catch(() => undefined)
  return { ...r, tekst: `Aanvraag voor ${aantal} extra credits is verstuurd.` }
})
