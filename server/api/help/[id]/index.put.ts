// PUT /api/help/:id: een eigen artikel bijwerken (nieuwe versie). Platformartikelen niet (403).
import { sql } from 'drizzle-orm'
import { controleerArtikel, type ArtikelInvoer } from '../../../../shared/help'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'help.eigenArtikelen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<ArtikelInvoer>(event)
  const fouten = controleerArtikel(b ?? {})
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0]!, data: { fouten } })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = (await tx.execute(sql`select id, organisation_id, versie from help_artikelen where id = ${id}`)).rows as any[]
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
    if (!a.organisation_id) throw createError({ statusCode: 403, statusMessage: 'Een platformartikel wijzigt alleen Dealtrace. Verberg het en schrijf een eigen artikel.' })
    const data = { samenvatting: b.samenvatting ?? '', inhoud: b.inhoud, routes: b.routes ?? [], features: [], vragen: b.vragen ?? [] }
    const versie = Number(a.versie) + 1
    await tx.execute(sql`update help_artikelen set collectie = ${b.collectie}, categorie = ${b.categorie}, titel = ${b.titel.trim()}, niveau = ${b.niveau ?? null}, status = ${b.status === 'gepubliceerd' ? 'gepubliceerd' : 'concept'}, data = ${JSON.stringify(data)}::jsonb, versie = ${versie}, bijgewerkt_op = now() where id = ${id}`)
    await tx.execute(sql`insert into help_artikel_versies (artikel_id, organisation_id, versie, titel, data, door) values (${id}, ${ctx.organisatie.id}, ${versie}, ${b.titel.trim()}, ${JSON.stringify(data)}::jsonb, ${ctx.gebruiker.id})`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'help.artikel.bijgewerkt', resourceType: 'help_artikelen', resourceId: id, changes: { versie, status: b.status } })
    return { versie, tekst: b.status === 'gepubliceerd' ? 'Het artikel is gepubliceerd.' : 'Het concept is opgeslagen.' }
  })
})
