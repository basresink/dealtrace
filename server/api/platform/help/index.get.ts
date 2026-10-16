// GET /api/platform/help: de platformartikelen met versie, status en statistiek over alle organisaties
// (gelezen, nuttig, niet nuttig), en de vragen en zoektermen zonder antwoord (signaal voor een nieuw artikel). Founder.
import { sql } from 'drizzle-orm'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const stat = new Map(((await tx.execute(sql`select * from dealtrace_platform_help_statistiek()`)).rows as any[]).map((r) => [r.artikel_id, r]))
    return {
      artikelen: ((await tx.execute(sql`select id, slug, titel, categorie, collectie, niveau, status, versie, bijgewerkt_op from help_artikelen where organisation_id is null order by collectie, categorie, titel`)).rows as any[])
        .map((a) => ({ id: a.id, slug: a.slug, titel: a.titel, categorie: a.categorie, collectie: a.collectie, niveau: a.niveau, status: a.status, versie: a.versie, bijgewerktOp: new Date(a.bijgewerkt_op).toISOString(),
          gelezen: Number(stat.get(a.id)?.gelezen ?? 0), nuttig: Number(stat.get(a.id)?.nuttig ?? 0), nietNuttig: Number(stat.get(a.id)?.niet_nuttig ?? 0) })),
      vragen: ((await tx.execute(sql`select * from dealtrace_platform_help_vragen()`)).rows as any[]).map((v) => ({ klant: v.naam, term: v.term, soort: v.soort, op: new Date(v.op).toISOString() })),
    }
  })
})
