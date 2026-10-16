// POST /api/coaching/zelfanalyse: "Wat kan ik deze week beter doen?" voor de Expert (P21). 402 zonder credits.
import { coachVoorstel } from '../../utils/agents/coach'
import { cijfers } from '../../utils/coaching'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'resultaten.zelfanalyse')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [u] = (await tx.execute(sql`select id, name, werkplek, team_id from users where id = ${ctx.gebruiker.id}`)).rows as any[]
    const c = await cijfers(tx, u)
    const verslagen = c.ruw.activiteiten.filter((a) => a.door === u.id && a.tekst).slice(-10).map((a) => a.tekst!)
    return { punten: await coachVoorstel(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, { id: u.id, naam: u.name }, { cijfers: { ...c.kpi, conversie: c.conversie }, team: c.team ?? {}, verslagen }, new Date(), { zelf: true }) }
  })
})
