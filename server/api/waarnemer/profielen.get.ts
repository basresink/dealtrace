// GET /api/waarnemer/profielen: het Waarnemer-profiel per doelgroep (P19). Lezen vanaf Gevorderd;
// een doelgroep zonder eigen profiel krijgt het standaardprofiel.
import { sql } from 'drizzle-orm'
import { PROFIEL_STANDAARD } from '../../../shared/agents'
import { metOrganisatie } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { leesStand } from '../../utils/vvProjectie'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agents.lezen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const doelgroepen = (await tx.execute(sql`select id, naam from doelgroepen order by naam`)).rows as any[]
    const profielen = (await tx.execute(sql`select doelgroep_id, data, updated_at from waarnemer_profielen`)).rows as any[]
    const voor = (id: string | null) => profielen.find((p) => (p.doelgroep_id ?? null) === id)
    const stand = await leesStand(tx)
    return {
      winpunten: ((stand.winpunten ?? []) as any[]).filter((w) => w.actief).map((w) => ({ id: w.id, titel: w.titel })),
      kanBewerken: kan(ctx, 'waarnemer.profielen'),
      profielen: [{ id: null, naam: 'Alle doelgroepen' }, ...doelgroepen].map((d) => ({ doelgroepId: d.id, naam: d.naam, eigen: !!voor(d.id), profiel: voor(d.id)?.data ?? PROFIEL_STANDAARD })),
    }
  })
})
