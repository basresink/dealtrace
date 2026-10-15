// GET /api/assistent/credits: de stand van de pot, je eigen verbruik per soort en je plafond.
import { sql } from 'drizzle-orm'
import { CREDITS_OP_TEKST, PLAFOND_TEKST } from '../../../shared/credits'
import { maandVan, stand, verbruikGebruiker } from '../../utils/credits'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const s = await stand(tx, ctx.organisatie!.id)
    const eigen = await verbruikGebruiker(tx, ctx.organisatie!.id, ctx.gebruiker.id)
    const perSoort = (await tx.execute(sql`select kosten->>'soort' as soort, count(*)::int as handelingen, sum((kosten->>'credits')::int)::int as credits from agent_runs
      where gebruiker_id = ${ctx.gebruiker.id} and kosten->>'door' = 'gebruiker' and uitkomst = 'uitgevoerd' and to_char(op at time zone 'Europe/Amsterdam', 'YYYY-MM') = ${maandVan(new Date())} group by 1 order by 3 desc`)).rows
    const geblokt = s.over <= 0 ? CREDITS_OP_TEKST : eigen.plafond != null && eigen.verbruikt >= eigen.plafond ? PLAFOND_TEKST : null
    return { pot: s.pot, verbruikt: s.verbruikt, over: s.over, procent: s.procentVerbruikt, eigen: { ...eigen, perSoort }, geblokt }
  })
})
