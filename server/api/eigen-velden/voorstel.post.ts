// POST /api/eigen-velden/voorstel {naam, type, reden}: Expert stelt een veld voor aan de beheerder.
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'eigenVelden.voorstellen')
  const b = await readBody<{ naam?: string; type?: string; reden?: string; object?: string }>(event)
  if (!b.naam?.trim()) throw createError({ statusCode: 400, statusMessage: 'Naam is verplicht' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [v] = await tx.insert(schema.eigenVeldVoorstellen).values({ organisationId: ctx.organisatie.id, door: ctx.gebruiker.id, data: { naam: b.naam!.trim(), type: b.type ?? 'tekst', reden: b.reden ?? '', object: b.object ?? 'account', doorNaam: ctx.gebruiker.naam } }).returning()
    await tx.execute(sql`insert into notificaties (organisation_id, gebruiker_id, soort, titel, tekst, link)
      select ${ctx.organisatie.id}, id, 'systeem', ${`Voorstel voor eigen veld: ${b.naam!.trim()}`}, ${`${ctx.gebruiker.naam}: ${b.reden ?? ''}`}, '/instellingen/eigen-velden'
      from users where role = 'beheerder' and status = 'actief'`)
    return v
  })
})
