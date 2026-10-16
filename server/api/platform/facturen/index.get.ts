// GET /api/platform/facturen: alle facturen met status, marge per klant (gefactureerd tegen AI- en
// datakosten deze maand, geschat) en de extra credits die nog gefactureerd moeten worden. Founder.
import { sql } from 'drizzle-orm'
import { KOSTPRIJS_CENT_PER_CREDIT, marge } from '../../../../shared/platform'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const facturen = (await tx.execute(sql`select * from dealtrace_platform_facturen()`)).rows as any[]
    const open = (await tx.execute(sql`select * from dealtrace_platform_extra_open()`)).rows as any[]
    const maand = new Date().toISOString().slice(0, 7)
    const verbruik = (await tx.execute(sql`select organisation_id, sum(credits)::int as c from dealtrace_platform_verbruik(${maand}) group by 1`)).rows as any[]
    const orgs = [...new Map(facturen.map((f) => [f.organisation_id, f.naam])).entries()]
    return {
      facturen: facturen.map((f) => ({ id: f.id, organisatieId: f.organisation_id, klant: f.naam, nummer: f.nummer, bedragCent: f.bedrag_cent, btwCent: f.btw_cent, status: f.status, vervaltOp: f.vervalt_op, betaaldOp: f.betaald_op, moneybird: f.moneybird_id })),
      marge: orgs.map(([id, naam]) => {
        const kosten = (verbruik.find((v) => v.organisation_id === id)?.c ?? 0) * KOSTPRIJS_CENT_PER_CREDIT
        return { organisatieId: id, klant: naam, margeCent: marge(facturen.filter((f) => f.organisation_id === id).map((f) => ({ bedragCent: f.bedrag_cent, btwCent: f.btw_cent, status: f.status })), kosten), kostenCent: Math.round(kosten) }
      }),
      teFactureren: open.map((o) => ({ organisatieId: o.organisation_id, klant: o.naam, credits: Number(o.aantal), regels: Number(o.regels) })),
      achterstallig: [...new Set(facturen.filter((f) => f.status === 'achterstallig').map((f) => f.naam))],
    }
  })
})
