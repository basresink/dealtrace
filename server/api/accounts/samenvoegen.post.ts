// POST /api/accounts/samenvoegen {behoudId, samenvoegenId}: Expert. Contacten en
// activiteiten verhuizen, lege velden worden aangevuld, beide id's blijven bewaard.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { herbereken } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.samenvoegen')
  const { behoudId, samenvoegenId } = await readBody<{ behoudId?: string; samenvoegenId?: string }>(event)
  if (!behoudId || !samenvoegenId || behoudId === samenvoegenId) throw createError({ statusCode: 400, statusMessage: 'Kies twee verschillende accounts' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, behoudId))
    const [b] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, samenvoegenId))
    if (!a || !b) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    if (a.accountKind === 'prospect' && b.accountKind === 'klant') throw createError({ statusCode: 409, statusMessage: 'Een klant kan niet opgaan in een prospect; behoud de klant' })
    const data = { ...(b.data ?? {}), ...(a.data ?? {}) }
    data.customFields = { ...(b.data?.customFields ?? {}), ...(a.data?.customFields ?? {}) }
    data.samengevoegdUit = [...new Set([...(a.data?.samengevoegdUit ?? []), b.id, ...(b.data?.samengevoegdUit ?? [])])]
    await tx.update(schema.contacts).set({ accountId: a.id }).where(eq(schema.contacts.accountId, b.id))
    // De activiteitenlog is alleen toevoegen: die blijft op het oude id en de kaart leest samengevoegdUit mee.
    await tx.update(schema.accounts).set({
      data, kvk: a.kvk ?? b.kvk, domein: a.domein ?? b.domein, city: a.city ?? b.city, postcode: a.postcode ?? b.postcode, klasse: a.klasse ?? b.klasse,
    }).where(eq(schema.accounts.id, a.id))
    await tx.delete(schema.accounts).where(eq(schema.accounts.id, b.id))
    await herbereken(tx, a.id)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'account.samenvoegen', resourceType: 'accounts', resourceId: a.id, changes: { samengevoegd: b.id, naam: b.name } })
    return { id: a.id }
  })
})
