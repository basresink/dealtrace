// GET /api/platform/help/:slug: een platformartikel met inhoud, controlevragen en versies. Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const slug = getRouterParam(event, 'slug')!
  return alsPlatform(async (tx) => {
    const [a] = (await tx.execute(sql`select * from help_artikelen where organisation_id is null and slug = ${slug}`)).rows as any[]
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
    const versies = (await tx.execute(sql`select v.versie, v.titel, v.op, u.name as door from help_artikel_versies v left join users u on u.id = v.door where v.artikel_id = ${a.id} order by v.versie desc limit 20`)).rows as any[]
    return { id: a.id, slug: a.slug, titel: a.titel, collectie: a.collectie, categorie: a.categorie, niveau: a.niveau, status: a.status, versie: a.versie, samenvatting: a.data.samenvatting ?? '', inhoud: a.data.inhoud ?? '', routes: a.data.routes ?? [], vragen: a.data.vragen ?? [],
      versies: versies.map((v) => ({ versie: v.versie, titel: v.titel, op: new Date(v.op).toISOString(), door: String(v.door ?? 'content/help').replace(/^Testfounder /, '') })) }
  })
})
