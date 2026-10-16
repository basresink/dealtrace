// GET /api/roadmap: de wensen van de eigen organisatie met stemmen, of ik al stemde en de status. Iedereen.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'roadmap')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = (await tx.execute(sql`select w.*, u.name as door_naam, (select count(*)::int from roadmap_stemmen s where s.wens_id = w.id) as stemmen,
      exists (select 1 from roadmap_stemmen s where s.wens_id = w.id and s.gebruiker_id = ${ctx.gebruiker.id}) as gestemd
      from feature_requests w left join users u on u.id = w.door order by w.op desc`)).rows as any[]
    return {
      magSamenvoegen: ctx.gebruiker.rol === 'beheerder',
      wensen: rijen.filter((w) => !w.samengevoegd_met).map((w) => ({
        id: w.id, titel: w.titel, omschrijving: w.omschrijving, status: w.status, door: String(w.door_naam ?? '').replace(/^Testgebruiker /, ''), op: new Date(w.op).toISOString(),
        stemmen: w.stemmen + rijen.filter((x) => x.samengevoegd_met === w.id).reduce((s, x) => s + x.stemmen, 0), gestemd: w.gestemd, samengevoegd: rijen.filter((x) => x.samengevoegd_met === w.id).map((x) => x.titel),
      })).sort((a, b) => b.stemmen - a.stemmen),
    }
  })
})
