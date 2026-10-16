// GET /api/contacten/:id: de contactkaart met de stuurstrip van het account.
import { desc, eq } from 'drizzle-orm'
import { contactUit, effectiefNiveau, eigenVeldenVoor, kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, id))
    if (!c) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, c.accountId))
    const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
    const acts = await tx.select().from(schema.activiteiten).where(eq(schema.activiteiten.contactId, id)).orderBy(desc(schema.activiteiten.op)).limit(100)
    const accActs = await tx.select({ soort: schema.activiteiten.soort, op: schema.activiteiten.op }).from(schema.activiteiten).where(eq(schema.activiteiten.accountId, c.accountId)).orderBy(desc(schema.activiteiten.op)).limit(20)
    const namen = new Map((await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users)).map((u) => [u.id, u.naam]))
    return {
      ...contactUit(c, velden),
      account: a ? { id: a.id, naam: a.name, soort: a.accountKind, laatsteContactOp: a.laatsteContactOp, laatsteCall: accActs.find((x) => x.soort === 'gebeld')?.op ?? null } : null,
      eigenVelden: velden.map((v) => ({ sleutel: v.sleutel, naam: v.naam, type: v.type, sectie: v.sectie, opties: v.data.opties ?? [], hulp: v.data.hulp ?? null, bewerkbaarDoor: v.data.bewerkbaarDoor ?? 'iedereen' })),
      tijdlijn: acts.map((x) => ({ id: x.id, soort: x.soort, op: x.op, door: x.door ? namen.get(x.door) ?? x.door : null, tekst: (x.data as any)?.tekst ?? null, uitkomst: x.uitkomst })),
      openTakenAccount: 0,
      kan: { verhuizen: kan(ctx, 'contacten.verhuizen'), samenvoegen: kan(ctx, 'contacten.samenvoegen') },
    }
  })
})
