// GET /api/instellingen/verbruik?maand=: AI-verbruik per soort en per gebruiker (credits, geen euro's),
// met plafonds, dagplafonds per soort en open aanvragen. Beheerder; salesmanager leest.
import { sql } from 'drizzle-orm'
import { AI_SOORT, AI_SOORTEN } from '../../../shared/credits'
import { kan } from '../../utils/accounts'
import { maandVan, stand } from '../../utils/credits'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'credits.verbruikLezen')
  const q = getQuery(event)
  const maand = typeof q.maand === 'string' && /^\d{4}-\d{2}$/.test(q.maand) ? q.maand : maandVan(new Date())
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const s = await stand(tx, ctx.organisatie.id)
    const perSoort = (await tx.execute(sql`select kosten->>'soort' as soort, count(*)::int as handelingen, sum((kosten->>'credits')::int)::int as credits from agent_runs
      where kosten is not null and uitkomst = 'uitgevoerd' and to_char(op at time zone 'Europe/Amsterdam', 'YYYY-MM') = ${maand} group by 1 order by 3 desc`)).rows as any[]
    const perGebruiker = (await tx.execute(sql`select u.id, u.name, u.role, coalesce(sum((r.kosten->>'credits')::int) filter (where r.kosten->>'door' = 'gebruiker'), 0)::int as credits, p.plafond
      from users u left join agent_runs r on r.gebruiker_id = u.id and r.kosten is not null and r.uitkomst = 'uitgevoerd' and to_char(r.op at time zone 'Europe/Amsterdam', 'YYYY-MM') = ${maand}
      left join ai_credit_plafonds p on p.gebruiker_id = u.id
      where u.status = 'actief' and u.role <> 'founder' group by u.id, u.name, u.role, p.plafond order by credits desc, u.name`)).rows as any[]
    const [dag] = (await tx.execute(sql`select value from org_settings where key = 'agentCreditsPerSoort'`)).rows as any[]
    const aanvragen = (await tx.execute(sql`select id, aantal, toelichting, status, op, besloten_op from credit_aanvragen order by op desc limit 10`)).rows
    return {
      maand, stand: { pot: s.pot, verbruikt: s.verbruikt, over: s.over, procent: s.procentVerbruikt, extra: s.extra },
      perSoort: perSoort.map((x) => ({ ...x, naam: AI_SOORT[x.soort as keyof typeof AI_SOORT]?.naam ?? x.soort })),
      perGebruiker: perGebruiker.map((u) => ({ id: u.id, naam: u.name, rol: u.role, credits: u.credits, plafond: u.plafond == null ? null : Number(u.plafond) })),
      dagplafonds: dag?.value ?? {}, soorten: AI_SOORTEN.map((k) => ({ sleutel: k, naam: AI_SOORT[k].naam })), aanvragen,
      kan: { beheer: kan(ctx, 'credits.beheer') },
    }
  })
})
