// GET /api/help/beheer?collectie=&status=&herkomst=: de beheerlijst voor de beheerder: platformartikelen en
// eigen artikelen (ook concepten) met gelezen, nuttig en niet nuttig binnen de eigen organisatie, en verborgen.
import { sql } from 'drizzle-orm'
import { vereisBeheerder } from '../../utils/beheerder'
import { metOrganisatie } from '../../utils/db'
import { leesArtikelen } from '../../utils/help'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'help.eigenArtikelen')
  const q = getQuery(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const artikelen = await leesArtikelen(tx, { metVerborgen: true, metConcepten: true })
    const tel = new Map(((await tx.execute(sql`select a.id, (select count(*)::int from help_gelezen g where g.artikel_id = a.id) as gelezen, (select count(*)::int from help_feedback f where f.artikel_id = a.id and f.nuttig) as nuttig,
      (select count(*)::int from help_feedback f where f.artikel_id = a.id and not f.nuttig) as niet from help_artikelen a`)).rows as any[]).map((r) => [r.id, r]))
    const [kb] = (await tx.execute(sql`select value from org_settings where key = 'helpKennisbank'`)).rows as any[]
    return {
      kennisbank: kb?.value === true,
      artikelen: artikelen.filter((a) => (!q.collectie || a.collectie === q.collectie) && (!q.status || a.status === q.status) && (!q.herkomst || (q.herkomst === 'eigen') === !!a.organisationId))
        .map((a) => ({ id: a.id, slug: a.slug, titel: a.titel, collectie: a.collectie, categorie: a.categorie, niveau: a.niveau, status: a.status, herkomst: a.organisationId ? 'eigen' : 'platform', verborgen: a.verborgen, versie: a.versie, gelezen: tel.get(a.id)?.gelezen ?? 0, nuttig: tel.get(a.id)?.nuttig ?? 0, nietNuttig: tel.get(a.id)?.niet ?? 0 })),
    }
  })
})
