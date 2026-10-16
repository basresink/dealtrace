// PUT /api/platform/help/:slug: een platformartikel bijwerken met een nieuwe versie, voor alle organisaties.
// content/help/ blijft de bron in de repository: een latere wijziging van hetzelfde bestand gaat voor. Founder.
import { sql } from 'drizzle-orm'
import { controleerArtikel, type ArtikelInvoer } from '../../../../shared/help'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const slug = getRouterParam(event, 'slug')!
  const b = await readBody<ArtikelInvoer>(event)
  const fouten = controleerArtikel(b ?? {})
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0]!, data: { fouten } })
  return alsPlatform(async (tx) => {
    const [a] = (await tx.execute(sql`select id, versie, data from help_artikelen where organisation_id is null and slug = ${slug}`)).rows as any[]
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
    const data = { ...a.data, samenvatting: b.samenvatting ?? '', inhoud: b.inhoud, routes: b.routes ?? [], vragen: b.vragen ?? [], bewerktInApp: true }
    const versie = Number(a.versie) + 1
    await tx.execute(sql`update help_artikelen set collectie = ${b.collectie}, categorie = ${b.categorie}, titel = ${b.titel.trim()}, niveau = ${b.niveau ?? null}, status = ${b.status === 'concept' ? 'concept' : 'gepubliceerd'}, data = ${JSON.stringify(data)}::jsonb, versie = ${versie}, bijgewerkt_op = now() where id = ${a.id}`)
    await tx.execute(sql`insert into help_artikel_versies (artikel_id, organisation_id, versie, titel, data, door) values (${a.id}, null, ${versie}, ${b.titel.trim()}, ${JSON.stringify(data)}::jsonb, ${ctx.gebruiker.id})`)
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'help.artikel', object: slug, na: { versie, status: b.status } })
    return { versie, tekst: `Versie ${versie} van "${b.titel.trim()}" staat voor alle organisaties.` }
  })
})
