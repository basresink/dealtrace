// GET /api/platform/klanten: alle klanten met gezondheid en meetlat (founder, aal2).
import { desc, ne, sql } from 'drizzle-orm'
import { schema } from '../../../utils/db'
import { herberekenGezondheid, verwerkProefperiodes } from '../../../utils/gezondheid'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const vernieuw = getQuery(event).vernieuw === '1'
  return alsPlatform(async (tx) => {
    const [laatste] = await tx.select({ op: schema.orgGezondheid.berekendOp }).from(schema.orgGezondheid).orderBy(desc(schema.orgGezondheid.berekendOp)).limit(1)
    if (vernieuw || !laatste || Date.now() - Date.parse(laatste.op) > 3600_000) {
      await verwerkProefperiodes(tx)
      await herberekenGezondheid(tx)
    }
    const orgs = await tx.select().from(schema.organisations).where(ne(schema.organisations.status, 'systeem')).orderBy(schema.organisations.name)
    const g = new Map((await tx.select().from(schema.orgGezondheid)).map((r) => [r.organisationId, r]))
    const open = await tx.select({ org: schema.gebruikersaanvragen.organisationId }).from(schema.gebruikersaanvragen).where(sql`status = 'open'`)
    const klanten = orgs.map((o) => {
      const h = g.get(o.id)
      return {
        id: o.id, naam: o.name, pakket: o.pakket, status: o.contract?.status ?? 'actief', einddatum: o.contract?.einddatum ?? null, seats: o.contract?.seats ?? null,
        gebruikers: h?.gebruikers ?? 0, metLogin: h?.metLogin ?? 0, laatstActief: h?.laatstActief ?? null,
        stand: h?.stand ?? 'leeg', redenen: h?.redenen ?? [], aiKosten: null,
        openAanvragen: open.filter((a) => a.org === o.id).length,
      }
    })
    const verdeling = { gezond: 0, let_op: 0, risico: 0, leeg: 0 } as Record<string, number>
    for (const k of klanten) verdeling[k.stand] = (verdeling[k.stand] ?? 0) + 1
    return {
      klanten,
      meetlat: {
        klanten: klanten.length, verdeling,
        gebruikersMetLogin: klanten.reduce((s, k) => s + k.metLogin, 0),
        gebruikers: klanten.reduce((s, k) => s + k.gebruikers, 0),
        maandomzet: null, aiKostprijs: null,
        aandacht: klanten.filter((k) => k.stand === 'risico' || k.stand === 'let_op').length + open.length,
      },
    }
  })
})
