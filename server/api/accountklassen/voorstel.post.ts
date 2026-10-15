// POST /api/accountklassen/voorstel {accountIds?, toepassen?}: klasse uit het aantal
// medewerkers (beheerder). "Pas toe" zet de klasse en schrijft herkomst per veld.
import { eq, inArray } from 'drizzle-orm'
import { klasseVoorOmvang, type Klasse } from '../../../shared/ritmematrix'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'matrix.beheer')
  const b = await readBody<{ accountIds?: string[]; toepassen?: boolean }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [k] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'klassen'))
    const klassen = ((k?.value as Klasse[]) ?? []).filter((x) => x.tabblad !== 'Klanten')
    const accounts = await tx.select().from(schema.accounts).where(b?.accountIds?.length ? inArray(schema.accounts.id, b.accountIds) : eq(schema.accounts.accountKind, 'prospect'))
    const voorstel = accounts.filter((a) => !a.klasse).map((a) => {
      const m = a.data?.medewerkers ?? (a.data?.customFields as any)?.aantal_monteurs
      return { accountId: a.id, naam: a.name, medewerkers: m ?? null, klasse: klasseVoorOmvang(m == null ? null : Number(m), klassen) }
    })
    if (b?.toepassen) {
      const op = new Date().toISOString()
      for (const v of voorstel.filter((x) => x.klasse)) {
        const a = accounts.find((x) => x.id === v.accountId)!
        await tx.update(schema.accounts).set({ klasse: v.klasse, data: { ...(a.data ?? {}), herkomst: { ...(a.data?.herkomst ?? {}), klasse: { bron: 'voorstel uit medewerkers', op, door: ctx.gebruiker.id } } }, updatedAt: op }).where(eq(schema.accounts.id, v.accountId))
      }
      await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'klassen.voorstel', resourceType: 'accounts', changes: { aantal: voorstel.filter((x) => x.klasse).length } })
    }
    return { zonderKlasse: voorstel.length, voorstel }
  })
})
