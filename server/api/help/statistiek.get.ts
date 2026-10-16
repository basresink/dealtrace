// GET /api/help/statistiek: voor de beheerder: zoektermen zonder resultaat en vragen zonder antwoord van de
// eigen organisatie, en per artikel niet nuttig met reden.
import { sql } from 'drizzle-orm'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'help.eigenArtikelen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({
    zonderResultaat: ((await tx.execute(sql`select term, soort, count(*)::int as n, max(op) as laatst from help_zoekopdrachten where (soort = 'zoek' and resultaten = 0) or (soort = 'vraag' and not beantwoord) group by term, soort order by n desc, laatst desc limit 50`)).rows as any[])
      .map((r) => ({ term: r.term, soort: r.soort, aantal: r.n, laatst: new Date(r.laatst).toISOString() })),
    nietNuttig: ((await tx.execute(sql`select a.titel, a.slug, f.reden, count(*)::int as n from help_feedback f join help_artikelen a on a.id = f.artikel_id where not f.nuttig group by 1, 2, 3 order by n desc limit 50`)).rows as any[])
      .map((r) => ({ titel: r.titel, slug: r.slug, reden: r.reden, aantal: r.n })),
  }))
})
