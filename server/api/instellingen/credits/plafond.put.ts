// PUT /api/instellingen/credits/plafond {gebruikerId, plafond}: plafond per gebruiker per maand (leeg = geen plafond). Beheerder.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'credits.beheer')
  const b = await readBody<{ gebruikerId?: string; plafond?: number | string | null }>(event)
  const plafond = b?.plafond === null || b?.plafond === '' || b?.plafond === undefined ? null : Number(b.plafond)
  if (plafond !== null && (!Number.isInteger(plafond) || plafond < 0)) throw createError({ statusCode: 422, statusMessage: 'Een plafond is een heel getal van 0 of meer' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [u] = (await tx.execute(sql`select id, name from users where id = ${b?.gebruikerId ?? ''}`)).rows as any[]
    if (!u) throw createError({ statusCode: 404, statusMessage: 'Gebruiker niet gevonden' })
    if (plafond === null) await tx.execute(sql`delete from ai_credit_plafonds where gebruiker_id = ${u.id}`)
    else await tx.execute(sql`insert into ai_credit_plafonds (organisation_id, gebruiker_id, plafond) values (${ctx.organisatie.id}, ${u.id}, ${plafond}) on conflict (organisation_id, gebruiker_id) do update set plafond = excluded.plafond`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'credits.plafond', resourceType: 'users', resourceId: u.id, changes: { plafond } })
    const naam = String(u.name).replace(/^Testgebruiker /, '')
    return { gebruikerId: u.id, plafond, tekst: plafond === null ? `${naam} heeft geen plafond meer.` : `Plafond voor ${naam} is ${plafond} credits per maand.` }
  })
})
