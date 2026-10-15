// GET /api/platform/klanten/:id: de klantflyout (founder, aal2). Gebruikers met rol,
// niveau en login; geen klantdata (accounts, contacten, activiteiten).
import { desc, eq, sql } from 'drizzle-orm'
import { FUNCTIES, pakketBevat } from '../../../../../shared/functies'
import { schema } from '../../../../utils/db'
import { STARTSET } from '../../../../utils/orgStarter'
import { alsPlatform, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const gebruikers = await tx.select({
      id: schema.users.id, naam: schema.users.name, email: schema.users.email, rol: schema.users.role, niveau: schema.users.niveau,
      status: schema.users.status, laatsteInlog: schema.users.laatsteInlog,
    }).from(schema.users).where(eq(schema.users.organisationId, id)).orderBy(schema.users.name)
    const aanvragen = await tx.select().from(schema.gebruikersaanvragen).where(eq(schema.gebruikersaanvragen.organisationId, id)).orderBy(desc(schema.gebruikersaanvragen.aangevraagdOp))
    const [g] = await tx.select().from(schema.orgGezondheid).where(eq(schema.orgGezondheid.organisationId, id))
    const audit = await tx.select().from(schema.platformAudit).where(eq(schema.platformAudit.actieveOrganisatie, id)).orderBy(desc(schema.platformAudit.op)).limit(20)
    const groepen: Record<string, { sleutel: string; naam: string; stand: 'live' | 'pakket te laag' }[]> = {}
    for (const f of FUNCTIES) {
      if (f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')) continue
      const groep = f.zijbalk?.groep ?? 'Overig'
      ;(groepen[groep] ??= []).push({ sleutel: f.sleutel, naam: f.naam, stand: pakketBevat({ pakket: o.pakket as any, features: o.features ?? {} }, f) ? 'live' : 'pakket te laag' })
    }
    const [dd] = (await tx.execute(sql`select status, instellingen->>'stand' as stand from koppelingen where organisation_id = ${id} and soort = 'dealdrive'`)).rows as any[]
    return {
      dealdrive: dd?.status === 'actief' ? dd.stand : 'uit',
      id: o.id, naam: o.name, pakket: o.pakket, contract: o.contract ?? {}, contact: o.data?.contact ?? {},
      gebruikersStand: o.data?.gebruikersStand ?? 'aanvragen', toegangLeverancier: o.data?.toegangLeverancier ?? 'altijd',
      gebruikers, aanvragen, gezondheid: g ?? null, functies: groepen,
      startset: STARTSET.map((s) => ({ sleutel: s.sleutel, naam: s.naam, op: (o.data?.startset as any)?.[s.sleutel] ?? null })),
      audit,
    }
  })
})
