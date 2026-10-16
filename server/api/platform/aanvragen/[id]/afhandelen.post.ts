// POST /api/platform/aanvragen/:id/afhandelen {besluit}: goedkeuren maakt de gebruiker
// aan (uitgenodigd; de mail komt met P27) en verhoogt zo nodig de seats.
import { and, eq, ne, sql } from 'drizzle-orm'
import { schema } from '../../../../utils/db'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder } from '../../../../utils/platform'
import { vergeetOrganisaties } from '../../../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  // De organisatiecontext staat in het korte geheugen; na deze wijziging opnieuw lezen.
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const { besluit } = await readBody<{ besluit?: string }>(event)
  if (besluit !== 'goedkeuren' && besluit !== 'afwijzen') throw createError({ statusCode: 400, statusMessage: 'Besluit is goedkeuren of afwijzen' })
  return alsPlatform(async (tx) => {
    const [a] = await tx.select().from(schema.gebruikersaanvragen).where(eq(schema.gebruikersaanvragen.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Aanvraag onbekend' })
    if (a.status !== 'open') throw createError({ statusCode: 409, statusMessage: 'Deze aanvraag is al afgehandeld' })
    const nu = new Date().toISOString()
    let gebruikerId: string | null = null
    if (besluit === 'goedkeuren') {
      const bestaand = await tx.execute(sql`select 1 from users where lower(email) = ${a.data.email.toLowerCase()}`)
      if (bestaand.rows.length) throw createError({ statusCode: 409, statusMessage: 'Dit e-mailadres bestaat al' })
      const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, a.organisationId))
      const actief = await tx.select({ id: schema.users.id }).from(schema.users)
        .where(and(eq(schema.users.organisationId, a.organisationId), ne(schema.users.status, 'gearchiveerd')))
      const seats = o?.contract?.seats ?? 0
      if (actief.length + 1 > seats) {
        await tx.update(schema.organisations).set({ contract: { ...(o!.contract ?? {}), seats: actief.length + 1 } }).where(eq(schema.organisations.id, a.organisationId))
      }
      gebruikerId = crypto.randomUUID()
      const rol = ['accountmanager', 'salesmanager', 'beheerder'].includes(a.data.rol) ? a.data.rol : 'accountmanager'
      await tx.insert(schema.users).values({
        id: gebruikerId, organisationId: a.organisationId, email: a.data.email.toLowerCase(), name: a.data.naam, role: rol,
        niveau: a.data.niveau ?? (rol === 'accountmanager' ? 'beginner' : 'expert'), teamId: a.data.teamId ?? null,
        werkplek: a.data.werkplek ?? 'binnendienst', status: 'uitgenodigd', data: {}, createdAt: nu, updatedAt: nu,
      })
    }
    await tx.update(schema.gebruikersaanvragen).set({ status: besluit === 'goedkeuren' ? 'goedgekeurd' : 'afgewezen', afgehandeldDoor: ctx.gebruiker.id, afgehandeldOp: nu })
      .where(eq(schema.gebruikersaanvragen.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: a.organisationId, handeling: `aanvraag.${besluit}`, object: id, na: { ...a.data, gebruikerId } })
    await meldBeheerders(tx, a.organisationId,
      besluit === 'goedkeuren' ? `${a.data.naam} is toegevoegd` : `Aanvraag voor ${a.data.naam} is afgewezen`,
      besluit === 'goedkeuren' ? 'De gebruiker staat op uitgenodigd.' : 'Neem contact op met Dealtrace als je vragen hebt.',
      '/instellingen/gebruikers')
    return { status: besluit === 'goedkeuren' ? 'goedgekeurd' : 'afgewezen', gebruikerId }
  })
})
