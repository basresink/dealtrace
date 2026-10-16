// POST /api/coaching/:gebruiker/voorstel: de Coach stelt hoogstens drie punten voor in de open sessie (niet gedeeld).
// 402 als de AI-credits op zijn; de kaart blijft bruikbaar met de berekende cijfers.
import { sql } from 'drizzle-orm'
import { coachVoorstel } from '../../../utils/agents/coach'
import { cijfers } from '../../../utils/coaching'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { vereisTeamlid } from '../../../utils/team'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'coaching.coachVoorstel')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const u = await vereisTeamlid(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, getRouterParam(event, 'gebruiker')!)
    const c = await cijfers(tx, u as any)
    const verslagen = c.ruw.activiteiten.filter((a) => a.door === u.id && a.tekst).slice(-10).map((a) => a.tekst!)
    const punten = await coachVoorstel(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, { id: u.id, naam: u.name }, { cijfers: { ...c.kpi, conversie: c.conversie }, team: c.team ?? {}, verslagen })
    let [s] = (await tx.execute(sql`select id from coaching_sessies where gebruiker_id = ${u.id} order by datum desc, created_at desc limit 1`)).rows as any[]
    if (!s) [s] = (await tx.execute(sql`insert into coaching_sessies (organisation_id, gebruiker_id, manager_id, datum, data) values (${ctx.organisatie.id}, ${u.id}, ${ctx.gebruiker.id}, current_date, '{"punten": []}'::jsonb) returning id`)).rows as any[]
    const nieuw = punten.map((p) => ({ ...p, gedeeld: false }))
    await tx.execute(sql`update coaching_sessies set data = data || ${JSON.stringify({ punten: nieuw })}::jsonb, updated_at = now() where id = ${s.id}`)
    return { sessieId: s.id, punten: nieuw }
  })
})
