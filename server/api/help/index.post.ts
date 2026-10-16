// POST /api/help {titel, collectie, categorie, niveau?, samenvatting, inhoud, routes?, vragen?, status}: een eigen
// artikel voor de organisatie (beheerder vanaf Plus). Een accountmanager krijgt 403. Platformartikelen schrijft
// alleen de founder via /api/platform/help.
import { sql } from 'drizzle-orm'
import { controleerArtikel, slugVan, type ArtikelInvoer } from '../../../shared/help'
import { schrijfAudit } from '../../utils/audit'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'help.eigenArtikelen')
  const b = await readBody<ArtikelInvoer>(event)
  const fouten = controleerArtikel(b ?? {})
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0]!, data: { fouten } })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    let slug = slugVan(b.titel)
    if (((await tx.execute(sql`select 1 from help_artikelen where slug = ${slug}`)).rows).length) slug = `${slug}-${ctx.organisatie.id.replace(/^org-/, '').slice(0, 12)}`
    const data = { samenvatting: b.samenvatting ?? '', inhoud: b.inhoud, routes: b.routes ?? [], features: [], vragen: b.vragen ?? [] }
    const [r] = (await tx.execute(sql`insert into help_artikelen (organisation_id, collectie, categorie, slug, titel, niveau, status, data) values (${ctx.organisatie.id}, ${b.collectie}, ${b.categorie}, ${slug}, ${b.titel.trim()}, ${b.niveau ?? null}, ${b.status === 'gepubliceerd' ? 'gepubliceerd' : 'concept'}, ${JSON.stringify(data)}::jsonb) returning id`)).rows as any[]
    await tx.execute(sql`insert into help_artikel_versies (artikel_id, organisation_id, versie, titel, data, door) values (${r.id}, ${ctx.organisatie.id}, 1, ${b.titel.trim()}, ${JSON.stringify(data)}::jsonb, ${ctx.gebruiker.id})`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'help.artikel.nieuw', resourceType: 'help_artikelen', resourceId: r.id, changes: { titel: b.titel, status: b.status } })
    return { id: r.id, slug, tekst: b.status === 'gepubliceerd' ? 'Het artikel is gepubliceerd.' : 'Het artikel is als concept opgeslagen.' }
  })
})
