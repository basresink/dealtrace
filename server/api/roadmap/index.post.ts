// POST /api/roadmap {titel, omschrijving}: een wens indienen; de indiener stemt meteen mee. Iedereen.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'roadmap')
  const b = await readBody<{ titel?: string; omschrijving?: string }>(event)
  const titel = String(b?.titel ?? '').trim().slice(0, 120)
  if (titel.length < 4) throw createError({ statusCode: 422, statusMessage: 'Geef je wens een titel' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [w] = (await tx.execute(sql`insert into feature_requests (organisation_id, titel, omschrijving, door) values (${ctx.organisatie.id}, ${titel}, ${String(b.omschrijving ?? '').trim().slice(0, 2000)}, ${ctx.gebruiker.id}) returning id`)).rows as any[]
    await tx.execute(sql`insert into roadmap_stemmen (organisation_id, wens_id, gebruiker_id) values (${ctx.organisatie.id}, ${w.id}, ${ctx.gebruiker.id})`)
    await tx.execute(sql`select dealtrace_meld_founders(${`Nieuwe wens van ${ctx.organisatie.naam}`}, ${titel}, '/platform/roadmap')`)
    return { id: w.id, tekst: 'Je wens is ingediend.' }
  })
})
