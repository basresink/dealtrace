// POST /api/afspraken/inloop {accountId, uitkomst?, verslag?}: een inloopbezoek achteraf vastleggen
// (F10). Telt als bezoek en als klantcontact; het telefoonpad in drie tikken bouwt P30.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'bezoeken.kansenAlle')
  const b = await readBody<{ accountId?: string; uitkomst?: string; verslag?: string; contactId?: string }>(event)
  if (!b?.accountId) throw createError({ statusCode: 400, statusMessage: 'Kies een account' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = (await tx.execute(sql`select id, name from accounts where id = ${b.accountId}`)).rows as any[]
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account niet gevonden' })
    const nu = new Date().toISOString()
    await tx.execute(sql`insert into activiteiten (organisation_id, account_id, contact_id, soort, kanaal, uitkomst, door, op, data) values (${ctx.organisatie.id}, ${a.id}, ${b.contactId ?? null}, 'bezoek', 'bezoek', ${b.uitkomst ?? 'gesproken'}, ${ctx.gebruiker.id}, ${nu}, ${JSON.stringify({ inloop: true, soort: 'Ongepland bezoek', tekst: b.verslag ?? null })}::jsonb)`)
    await tx.execute(sql`update accounts set laatste_contact_op = ${nu} where id = ${a.id}`)
    return { ok: true, tekst: `Inloopbezoek bij ${a.name} vastgelegd.` }
  })
})
