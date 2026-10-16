// GET /api/platform/help: de platformartikelen met versie en status (de editor en de inhoud komen in P25). Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => ({
    artikelen: ((await tx.execute(sql`select slug, titel, categorie, collectie, niveau, status, versie, bijgewerkt_op from help_artikelen where organisation_id is null order by categorie, titel`)).rows as any[])
      .map((a) => ({ slug: a.slug, titel: a.titel, categorie: a.categorie, collectie: a.collectie, niveau: a.niveau, status: a.status, versie: a.versie, bijgewerktOp: new Date(a.bijgewerkt_op).toISOString() })),
  }))
})
