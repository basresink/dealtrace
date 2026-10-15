// PUT /api/mailsjablonen {id?, naam, kanaal, actief, data: {onderwerp, tekst}}: een sjabloon maken of
// wijzigen (beheerder). Variabelen tussen accolades, zoals {contact.voornaam}; de versie gaat omhoog.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.mailsjablonen')
  const b = await readBody<any>(event)
  const naam = String(b?.naam ?? '').trim()
  if (naam.length < 2) throw createError({ statusCode: 422, statusMessage: 'Geef het sjabloon een naam' })
  const kanaal = ['mail', 'linkedin', 'whatsapp', 'kaart'].includes(b?.kanaal) ? b.kanaal : 'mail'
  const tekst = String(b?.data?.tekst ?? '')
  const data = { onderwerp: String(b?.data?.onderwerp ?? ''), tekst, variabelen: [...new Set(tekst.match(/\{[a-z.]+\}/gi) ?? [])] }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = (b?.id
      ? await tx.execute(sql`update mailsjablonen set naam = ${naam}, kanaal = ${kanaal}, actief = ${b?.actief !== false}, data = ${JSON.stringify(data)}::jsonb, versie = versie + 1, updated_at = now() where id = ${b.id} returning id`)
      : await tx.execute(sql`insert into mailsjablonen (organisation_id, naam, kanaal, data) values (${ctx.organisatie.id}, ${naam}, ${kanaal}, ${JSON.stringify(data)}::jsonb) returning id`)).rows as any[]
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Sjabloon niet gevonden' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'mailsjabloon.bewaren', resourceType: 'mailsjablonen', resourceId: r.id, changes: { naam, kanaal } })
    return { id: r.id }
  })
})
