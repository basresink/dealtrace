// GET /api/leads/verbruik: meters (AI-credits, KvK-bevragingen, rondes vandaag) en de lijst van
// rondes en imports met gevonden, overgenomen, afgewezen en conversie naar afspraak.
// Een salesmanager en beheerder zien alle rondes; een accountmanager zijn eigen.
import { and, desc, eq, sql } from 'drizzle-orm'
import { GRENZEN } from '../../../shared/leadGenerator'
import { metOrganisatie, schema } from '../../utils/db'
import { creditsStandVoor } from '../../utils/agents/bewaker'
import { kvkStatus } from '../../utils/bronnen/kvk'
import { rondesVandaag } from '../../utils/leads'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.leadgenerator')
  const alles = ['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const rondes = await tx.select().from(schema.leadRondes).where(alles ? undefined : eq(schema.leadRondes.gebruikerId, ctx.gebruiker.id)).orderBy(desc(schema.leadRondes.gestartOp)).limit(50)
    const ids = rondes.map((r) => r.id)
    const tel = ids.length ? (await tx.execute(sql`select l.ronde_id, count(*)::int gevonden, count(*) filter (where l.status = 'overgenomen')::int overgenomen, count(*) filter (where l.status = 'afgewezen')::int afgewezen,
      count(distinct a.account_id)::int afspraak from leads l left join activiteiten a on a.account_id = l.account_id and a.uitkomst = 'afspraak' where l.ronde_id in ${ids} group by 1`)).rows as any[] : []
    const per = new Map(tel.map((t) => [t.ronde_id, t]))
    const namen = new Map((await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users)).map((u) => [u.id, u.naam]))
    const imports = await tx.select().from(schema.importBatches).where(and(eq(schema.importBatches.status, 'verwerkt'), alles ? undefined : eq(schema.importBatches.gebruikerId, ctx.gebruiker.id))).orderBy(desc(schema.importBatches.createdAt)).limit(20)
    const kvk = await kvkStatus(tx, ctx.organisatie!.pakket)
    const credits = await creditsStandVoor(tx, ctx.organisatie!.id)
    return {
      meters: { credits: { over: credits.over, pot: credits.pot }, kvk: { gebruikt: kvk.gebruikt, plafond: kvk.plafond, gekoppeld: kvk.gekoppeld }, rondes: { vandaag: await rondesVandaag(tx, ctx.gebruiker.id), grens: GRENZEN.rondesPerDag } },
      lijst: [
        ...rondes.map((r) => {
          const t = per.get(r.id) ?? { gevonden: 0, overgenomen: 0, afgewezen: 0, afspraak: 0 }
          return { id: r.id, soort: 'ronde', op: r.gestartOp, bron: r.bronnen.map((b) => (b === 'ai' ? 'AI-zoeker' : 'KvK')).join(' en '), door: namen.get(r.gebruikerId) ?? null, automatisch: r.automatisch,
            gevonden: t.gevonden, overgenomen: t.overgenomen, afgewezen: t.afgewezen, conversie: t.overgenomen ? Math.round((t.afspraak / t.overgenomen) * 100) : null, kosten: r.kosten }
        }),
        ...imports.map((b) => ({ id: b.id, soort: 'import', op: b.verwerktOp ?? b.createdAt, bron: `Import: ${b.bronLabel}`, door: namen.get(b.gebruikerId) ?? null, automatisch: false,
          gevonden: Number(b.rapport?.nieuw ?? 0) + Number(b.rapport?.samengevoegd ?? 0), overgenomen: Number(b.rapport?.nieuw ?? 0), afgewezen: Number(b.rapport?.overgeslagen ?? 0), conversie: null, kosten: {} })),
      ].sort((a, b) => b.op.localeCompare(a.op)),
    }
  })
})
